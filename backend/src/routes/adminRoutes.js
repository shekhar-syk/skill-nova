import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { query, queryOne } from '../db/index.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { logAudit } from '../services/auditService.js';
import { uploadBufferToMedia, uploadMiddleware } from '../services/cloudinaryService.js';

const router = Router();

// Media upload endpoint (Cloudinary stream or inline preview fallback)
router.post('/uploads', authenticate, uploadMiddleware.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const folder = req.body.folder || 'skillnova/media';
    const result = await uploadBufferToMedia(req.file, folder);
    res.json({ success: true, file: result });
  } catch (err) {
    next(err);
  }
});

// User Profile Update (with optional avatar upload)
router.put('/users/profile', authenticate, async (req, res, next) => {
  try {
    const {
      fullName,
      phone,
      avatarUrl,
      whatsappNumber,
      collegeName,
      department,
      yearOfStudy,
      state,
      educationLevel,
      bio,
      githubUrl,
      linkedinUrl,
    } = req.body;

    const updatedUser = await queryOne(
      `UPDATE users SET
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        avatar_url = COALESCE($3, avatar_url),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING id, full_name, email, role, phone, avatar_url`,
      [fullName || null, phone || null, avatarUrl || null, req.user.id]
    );

    if (req.user.role === 'STUDENT') {
      await query(
        `INSERT INTO student_profiles (user_id, whatsapp_number, college_name, department, year_of_study, state, education_level, bio, github_url, linkedin_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id) DO UPDATE SET
           whatsapp_number = COALESCE($2, student_profiles.whatsapp_number),
           college_name = COALESCE($3, student_profiles.college_name),
           department = COALESCE($4, student_profiles.department),
           year_of_study = COALESCE($5, student_profiles.year_of_study),
           state = COALESCE($6, student_profiles.state),
           education_level = COALESCE($7, student_profiles.education_level),
           bio = COALESCE($8, student_profiles.bio),
           github_url = COALESCE($9, student_profiles.github_url),
           linkedin_url = COALESCE($10, student_profiles.linkedin_url),
           updated_at = CURRENT_TIMESTAMP`,
        [
          req.user.id,
          whatsappNumber || null,
          collegeName || null,
          department || null,
          yearOfStudy || null,
          state || null,
          educationLevel || null,
          bio || null,
          githubUrl || null,
          linkedinUrl || null,
        ]
      );
    }

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    next(err);
  }
});

// Notifications
router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 20', [req.user.id]);
    res.json({ success: true, notifications: rows.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
    await query('UPDATE notifications SET is_read = $1 WHERE id = $2 AND user_id = $3', [
      true,
      Number(req.params.id),
      req.user.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// INSTRUCTOR WORKSPACE
router.get('/instructors/workspace', authenticate, authorizeRoles('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const isInstructorOnly = req.user.role === 'INSTRUCTOR';
    const coursesRes = await query(
      `SELECT c.*, cc.name AS category_name,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS active_students
       FROM courses c
       JOIN course_categories cc ON cc.id = c.category_id
       ${isInstructorOnly ? 'WHERE c.instructor_id = $1' : ''}
       ORDER BY c.id ASC`,
      isInstructorOnly ? [req.user.id] : []
    );

    const studentsRes = await query(
      `SELECT e.*, u.full_name, u.email, u.phone, c.title AS course_title
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN courses c ON c.id = e.course_id
       ${isInstructorOnly ? 'WHERE c.instructor_id = $1' : ''}
       ORDER BY e.enrolled_at DESC`,
      isInstructorOnly ? [req.user.id] : []
    );

    const submissionsRes = await query(
      `SELECT s.*, a.title AS assignment_title, a.max_score, c.title AS course_title, u.full_name AS student_name, u.email AS student_email
       FROM assignment_submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN courses c ON c.id = a.course_id
       JOIN users u ON u.id = s.user_id
       ${isInstructorOnly ? 'WHERE c.instructor_id = $1' : ''}
       ORDER BY s.submitted_at DESC`,
      isInstructorOnly ? [req.user.id] : []
    );

    const assignmentsRes = await query(
      `SELECT a.*, c.title AS course_title
       FROM assignments a JOIN courses c ON c.id = a.course_id
       ${isInstructorOnly ? 'WHERE c.instructor_id = $1' : ''}
       ORDER BY a.id DESC`,
      isInstructorOnly ? [req.user.id] : []
    );

    const quizzesRes = await query(
      `SELECT q.*, c.title AS course_title,
              (SELECT COUNT(*) FROM questions qs WHERE qs.quiz_id = q.id) AS question_count
       FROM quizzes q JOIN courses c ON c.id = q.course_id
       ${isInstructorOnly ? 'WHERE c.instructor_id = $1' : ''}
       ORDER BY q.id DESC`,
      isInstructorOnly ? [req.user.id] : []
    );

    res.json({
      success: true,
      courses: coursesRes.rows,
      students: studentsRes.rows,
      submissions: submissionsRes.rows,
      assignments: assignmentsRes.rows,
      quizzes: quizzesRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/instructors/courses/:id/live-info', authenticate, authorizeRoles('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const courseId = Number(req.params.id);
    const course = await queryOne('SELECT id, instructor_id FROM courses WHERE id = $1', [courseId]);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });
    if (req.user.role === 'INSTRUCTOR' && course.instructor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only update live info for courses assigned to you.' });
    }
    const { liveSessionInfo } = req.body;
    await query('UPDATE courses SET live_session_info = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      liveSessionInfo,
      courseId,
    ]);
    res.json({ success: true, message: 'Live session details updated.' });
  } catch (err) {
    next(err);
  }
});

// ADMIN OVERVIEW & ANALYTICS
router.get('/admin/overview', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (_req, res, next) => {
  try {
    const studentsCount = await queryOne("SELECT COUNT(*) AS cnt FROM users WHERE role = 'STUDENT'");
    const instructorsCount = await queryOne("SELECT COUNT(*) AS cnt FROM users WHERE role = 'INSTRUCTOR'");
    const coursesCount = await queryOne('SELECT COUNT(*) AS cnt FROM courses');
    const enrollmentsCount = await queryOne('SELECT COUNT(*) AS cnt FROM enrollments');
    const revenueRow = await queryOne("SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt FROM payments WHERE status = 'SUCCESS'");
    const pendingEnquiries = await queryOne("SELECT COUNT(*) AS cnt FROM enquiries WHERE status IN ('NEW', 'CONTACTED', 'FOLLOW_UP')");
    const pendingAdmissions = await queryOne("SELECT COUNT(*) AS cnt FROM admissions WHERE status IN ('PENDING', 'PAYMENT_PENDING', 'ADVANCE_PAID')");

    const recentRegistrations = await query(
      `SELECT id, full_name, email, role, is_active, created_at FROM users WHERE role = 'STUDENT' ORDER BY id DESC LIMIT 6`
    );

    const categoryPopularity = await query(
      `SELECT cc.name AS category, COUNT(c.id) AS courses, COALESCE(SUM(c.enrolled_count), 0) AS enrollments
       FROM course_categories cc
       LEFT JOIN courses c ON c.category_id = cc.id
       GROUP BY cc.id, cc.name
       ORDER BY enrollments DESC
       LIMIT 8`
    );

    const paymentsByCourse = await query(
      `SELECT c.title, COALESCE(SUM(p.amount), 0) AS revenue, COUNT(p.id) AS transactions
       FROM payments p
       JOIN courses c ON c.id = p.course_id
       WHERE p.status = 'SUCCESS'
       GROUP BY c.id, c.title
       ORDER BY revenue DESC
       LIMIT 6`
    );

    // Real DB-derived monthly activity & revenue across the last 6 calendar months
    const liveRevenue = Number(revenueRow?.total || 0);
    const paidRows = (await query("SELECT amount, paid_at, created_at FROM payments WHERE status = 'SUCCESS'")).rows;
    const enrRows = (await query('SELECT enrolled_at FROM enrollments')).rows;
    const stuRows = (await query("SELECT created_at FROM users WHERE role = 'STUDENT'")).rows;

    const now = new Date();
    const monthlySeries = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const ym = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });

      const monthRevenue = paidRows
        .filter((p) => String(p.paid_at || p.created_at || '').slice(0, 7) === ym)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const monthEnrollments = enrRows.filter((e) => String(e.enrolled_at || '').slice(0, 7) === ym).length;
      const monthStudents = stuRows.filter((s) => String(s.created_at || '').slice(0, 7) === ym).length;

      monthlySeries.push({
        month: label,
        ym,
        revenue: monthRevenue,
        enrollments: monthEnrollments,
        students: monthStudents,
      });
    }

    res.json({
      success: true,
      kpis: {
        totalStudents: Number(studentsCount?.cnt || 0),
        totalInstructors: Number(instructorsCount?.cnt || 0),
        totalCourses: Number(coursesCount?.cnt || 0),
        totalEnrollments: Number(enrollmentsCount?.cnt || 0),
        totalRevenue: liveRevenue,
        successfulPayments: Number(revenueRow?.cnt || 0),
        pendingEnquiries: Number(pendingEnquiries?.cnt || 0),
        pendingAdmissions: Number(pendingAdmissions?.cnt || 0),
      },
      recentRegistrations: recentRegistrations.rows,
      categoryPopularity: categoryPopularity.rows.map((r) => ({
        category: r.category.length > 20 ? `${r.category.slice(0, 18)}…` : r.category,
        fullCategory: r.category,
        enrollments: Number(r.enrollments || 0),
        courses: Number(r.courses || 0),
      })),
      paymentsByCourse: paymentsByCourse.rows,
      monthlySeries,
    });
  } catch (err) {
    next(err);
  }
});

// ADMIN: Student Management
router.get('/admin/students', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const params = [];
    let filter = "WHERE u.role = 'STUDENT'";
    if (search) {
      params.push(`%${search}%`);
      filter += ` AND (LOWER(u.full_name) LIKE $1 OR LOWER(u.email) LIKE $1)`;
    }

    const rows = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.created_at,
              sp.college_name, sp.department, sp.state,
              (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS enrollment_count,
              (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.user_id = u.id AND p.status = 'SUCCESS') AS total_paid
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       ${filter}
       ORDER BY u.id DESC`,
      params
    );
    res.json({ success: true, students: rows.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/admin/users/:id/active', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { isActive } = req.body;
    const updated = await queryOne(
      'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, is_active',
      [Boolean(isActive), id]
    );
    if (!updated) return res.status(404).json({ success: false, message: 'User not found.' });

    await logAudit({
      actorUserId: req.user.id,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'USER',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true, user: updated });
  } catch (err) {
    next(err);
  }
});

// ADMIN: Instructor Management
router.get('/admin/instructors', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active,
              ip.headline, ip.expertise, ip.years_experience, ip.company_background, ip.bio,
              (SELECT COUNT(*) FROM courses c WHERE c.instructor_id = u.id) AS assigned_courses
       FROM users u
       LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
       WHERE u.role = 'INSTRUCTOR'
       ORDER BY u.id ASC`
    );
    res.json({ success: true, instructors: rows.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/instructors', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { fullName, email, password, phone, headline, expertise = [], yearsExperience = 5, companyBackground = '', bio = '' } = req.body;
    if (!fullName || !email || !password || !headline) {
      return res.status(400).json({ success: false, message: 'Full name, email, password, and headline are required.' });
    }
    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ success: false, message: 'Email already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const user = await queryOne(
      `INSERT INTO users (full_name, email, password_hash, role, phone, is_active)
       VALUES ($1, $2, $3, 'INSTRUCTOR', $4, $5) RETURNING id, full_name, email, role`,
      [fullName.trim(), email.toLowerCase().trim(), hash, phone || null, true]
    );
    await query(
      `INSERT INTO instructor_profiles (user_id, headline, expertise, years_experience, company_background, bio)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, headline.trim(), JSON.stringify(expertise), Number(yearsExperience), companyBackground, bio]
    );
    res.status(201).json({ success: true, instructor: user });
  } catch (err) {
    next(err);
  }
});

router.patch('/admin/instructors/:id/assign-course', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const instructorId = Number(req.params.id);
    const courseId = Number(req.body.courseId);
    await query('UPDATE courses SET instructor_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      instructorId,
      courseId,
    ]);
    res.json({ success: true, message: 'Course assigned to instructor.' });
  } catch (err) {
    next(err);
  }
});

// ADMIN: CMS Content Management (Site Settings, Testimonials, FAQs)
router.put('/admin/cms/settings', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const updates = req.body || {};
    for (const [key, val] of Object.entries(updates)) {
      await query(
        `INSERT INTO site_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, String(val)]
      );
    }
    res.json({ success: true, message: 'Site settings updated.' });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/cms/testimonials', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { studentName, roleTitle, companyName, courseTitle, quote, outcomeMetric } = req.body;
    const row = await queryOne(
      `INSERT INTO testimonials (student_name, role_title, company_name, course_title, quote, outcome_metric)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [studentName, roleTitle, companyName, courseTitle, quote, outcomeMetric]
    );
    res.status(201).json({ success: true, testimonial: row });
  } catch (err) {
    next(err);
  }
});

router.delete('/admin/cms/testimonials/:id', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    await query('DELETE FROM testimonials WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/cms/faqs', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { question, answer, category = 'General' } = req.body;
    const row = await queryOne(
      `INSERT INTO faqs (question, answer, category) VALUES ($1, $2, $3) RETURNING *`,
      [question, answer, category]
    );
    res.status(201).json({ success: true, faq: row });
  } catch (err) {
    next(err);
  }
});

router.delete('/admin/cms/faqs/:id', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    await query('DELETE FROM faqs WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ADMIN: Export CSV Reports
router.get('/analytics/export/:type', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const type = req.params.type;
    let rows = [];
    let headers = [];

    if (type === 'payments') {
      const r = await query(
        `SELECT p.receipt_number, a.registration_id, a.full_name, a.email, c.title AS course, p.payment_type, p.amount, p.status, p.razorpay_order_id, p.paid_at
         FROM payments p JOIN admissions a ON a.id = p.admission_id JOIN courses c ON c.id = p.course_id ORDER BY p.id DESC`
      );
      headers = ['Receipt', 'RegistrationID', 'Student', 'Email', 'Course', 'Type', 'AmountINR', 'Status', 'OrderID', 'PaidAt'];
      rows = r.rows.map((x) => [x.receipt_number, x.registration_id, x.full_name, x.email, x.course, x.payment_type, x.amount, x.status, x.razorpay_order_id, x.paid_at || '']);
    } else if (type === 'admissions') {
      const r = await query(
        `SELECT a.registration_id, a.full_name, a.email, a.mobile_number, a.college_name, c.title AS course, a.total_fee, a.amount_paid, a.remaining_balance, a.status, a.created_at
         FROM admissions a JOIN courses c ON c.id = a.course_id ORDER BY a.id DESC`
      );
      headers = ['RegistrationID', 'Name', 'Email', 'Mobile', 'College', 'Course', 'TotalFee', 'Paid', 'Balance', 'Status', 'SubmittedAt'];
      rows = r.rows.map((x) => [x.registration_id, x.full_name, x.email, x.mobile_number, x.college_name, x.course, x.total_fee, x.amount_paid, x.remaining_balance, x.status, x.created_at]);
    } else if (type === 'student-performance') {
      const r = await query(
        `SELECT u.id, u.full_name, u.email,
                COALESCE((SELECT SUM(points) FROM student_points sp WHERE sp.user_id = u.id), 0) AS total_xp,
                COALESCE(ls.current_streak, 0) AS current_streak,
                (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS enrollments_count,
                COALESCE((SELECT AVG(progress_percent) FROM enrollments e WHERE e.user_id = u.id), 0) AS avg_completion,
                COALESCE((SELECT AVG(percentage) FROM quiz_attempts qa WHERE qa.user_id = u.id), 0) AS avg_quiz_pct,
                (SELECT COUNT(*) FROM assignment_submissions s WHERE s.user_id = u.id) AS assignments_submitted
         FROM users u
         LEFT JOIN learning_streaks ls ON ls.user_id = u.id
         WHERE u.role = 'STUDENT'
         ORDER BY total_xp DESC`
      );
      headers = ['StudentID', 'Name', 'Email', 'TotalXP', 'CurrentStreak', 'Enrollments', 'AvgCompletionPct', 'AvgQuizPct', 'AssignmentsSubmitted'];
      rows = r.rows.map((x) => [
        x.id,
        x.full_name,
        x.email,
        Number(x.total_xp || 0),
        Number(x.current_streak || 0),
        Number(x.enrollments_count || 0),
        Math.round(Number(x.avg_completion || 0)),
        Math.round(Number(x.avg_quiz_pct || 0)),
        Number(x.assignments_submitted || 0),
      ]);
    } else if (type === 'course-completion') {
      const r = await query(
        `SELECT c.id, c.title, cc.name AS category, c.skill_level,
                (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS active_enrollments,
                (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.progress_percent >= 100) AS completed_enrollments,
                COALESCE((SELECT AVG(progress_percent) FROM enrollments e WHERE e.course_id = c.id), 0) AS avg_progress,
                COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.course_id = c.id AND p.status = 'SUCCESS'), 0) AS revenue
         FROM courses c
         JOIN course_categories cc ON cc.id = c.category_id
         ORDER BY active_enrollments DESC, c.id ASC`
      );
      headers = ['CourseID', 'CourseTitle', 'Category', 'Level', 'EnrolledStudents', 'CompletedStudents', 'AvgProgressPct', 'RevenueINR'];
      rows = r.rows.map((x) => [
        x.id,
        x.title,
        x.category,
        x.skill_level,
        Number(x.active_enrollments || 0),
        Number(x.completed_enrollments || 0),
        Math.round(Number(x.avg_progress || 0)),
        Number(x.revenue || 0),
      ]);
    } else {
      const r = await query(
        `SELECT c.title, cc.name AS category, c.skill_level, c.duration, c.course_fee, c.advance_amount, c.enrolled_count, c.status
         FROM courses c JOIN course_categories cc ON cc.id = c.category_id ORDER BY c.id ASC`
      );
      headers = ['Title', 'Category', 'Level', 'Duration', 'Fee', 'Advance', 'EnrolledCount', 'Status'];
      rows = r.rows.map((x) => [x.title, x.category, x.skill_level, x.duration, x.course_fee, x.advance_amount, x.enrolled_count, x.status]);
    }

    const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="skillnova-${type}-report.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
