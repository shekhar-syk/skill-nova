import { Router } from 'express';
import { query, queryOne } from '../db/index.js';
import { authenticate, authorizeRoles, optionalAuth } from '../middleware/authMiddleware.js';
import { logAudit } from '../services/auditService.js';
import { courseUpsertSchema } from '../validators/schemas.js';

const router = Router();

function safeJsonParse(val, fallback) {
  if (Array.isArray(val) || (typeof val === 'object' && val !== null)) return val;
  try {
    return JSON.parse(val || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function formatCourse(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortSummary: row.short_summary,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    instructorId: row.instructor_id,
    instructorName: row.instructor_name || 'SkillNova Faculty',
    instructorHeadline: row.instructor_headline || 'Senior Industry Mentor',
    instructorCompany: row.instructor_company || 'SkillNova Engineering',
    instructorBio: row.instructor_bio || '',
    thumbnailUrl: row.thumbnail_url,
    technologies: safeJsonParse(row.technologies, []),
    skillLevel: row.skill_level,
    duration: row.duration,
    durationWeeks: row.duration_weeks,
    courseFee: row.course_fee,
    advanceAmount: row.advance_amount,
    fullAmount: row.full_amount,
    learningOutcomes: safeJsonParse(row.learning_outcomes, []),
    internshipAvailable: Boolean(row.internship_available),
    internshipDetails: row.internship_details,
    faqs: safeJsonParse(row.faqs, []),
    status: row.status,
    featured: Boolean(row.featured),
    isFree: Number(row.course_fee || 0) === 0,
    ratingAvg: Number(row.rating_avg || 4.8),
    enrolledCount: Number(row.enrolled_count || 0),
    liveSessionInfo: row.live_session_info,
    createdAt: row.created_at,
  };
}

// Public categories list with course count
router.get('/categories', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT cc.*, COUNT(c.id) AS course_count
       FROM course_categories cc
       LEFT JOIN courses c ON c.category_id = cc.id AND c.status = 'PUBLISHED'
       GROUP BY cc.id
       ORDER BY cc.sort_order ASC, cc.id ASC`
    );
    res.json({
      success: true,
      categories: result.rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        iconName: r.icon_name,
        sortOrder: r.sort_order,
        courseCount: Number(r.course_count || 0),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Public CMS content (testimonials, FAQs, site settings, platform stats)
router.get('/public/cms', async (_req, res, next) => {
  try {
    const testimonials = await query(
      'SELECT * FROM testimonials WHERE is_published = $1 ORDER BY id ASC',
      [true]
    );
    const faqs = await query(
      'SELECT * FROM faqs WHERE is_published = $1 ORDER BY sort_order ASC, id ASC',
      [true]
    );
    const settingsRes = await query('SELECT setting_key, setting_value FROM site_settings');
    const settings = {};
    for (const s of settingsRes.rows) {
      settings[s.setting_key] = s.setting_value;
    }

    const courseCountRow = await queryOne("SELECT COUNT(*) AS cnt FROM courses WHERE status = 'PUBLISHED'");
    const categoryCountRow = await queryOne('SELECT COUNT(*) AS cnt FROM course_categories');
    const studentCountRow = await queryOne("SELECT COUNT(*) AS cnt FROM users WHERE role = 'STUDENT'");
    const enrollmentSumRow = await queryOne('SELECT COALESCE(SUM(enrolled_count), 0) AS total FROM courses');

    res.json({
      success: true,
      testimonials: testimonials.rows.map((t) => ({
        id: t.id,
        studentName: t.student_name,
        roleTitle: t.role_title,
        companyName: t.company_name,
        courseTitle: t.course_title,
        quote: t.quote,
        outcomeMetric: t.outcome_metric,
      })),
      faqs: faqs.rows.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        category: f.category,
      })),
      settings,
      stats: {
        totalCourses: Number(courseCountRow?.cnt || 45),
        totalCategories: Number(categoryCountRow?.cnt || 15),
        registeredStudents: Number(studentCountRow?.cnt || 0),
        totalCohortSeats: Number(enrollmentSumRow?.total || 5400),
        practicalRatio: '80%',
        placementSupport: '100%',
      },
    });
  } catch (err) {
    next(err);
  }
});

// List courses with search, category, level, duration, price sort & pagination
router.get('/courses', optionalAuth, async (req, res, next) => {
  try {
    const {
      search = '',
      category = '',
      level = '',
      duration = '',
      featured = '',
      free = '',
      sort = 'featured',
      includeAll = 'false',
      page = '1',
      limit = '12',
    } = req.query;

    const isAdminOrInstructor = req.user && ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'].includes(req.user.role);
    const showAll = includeAll === 'true' && isAdminOrInstructor;

    const conditions = [];
    const params = [];

    if (!showAll) {
      params.push('PUBLISHED');
      conditions.push(`c.status = $${params.length}`);
    }

    if (search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term);
      conditions.push(`(LOWER(c.title) LIKE $${params.length} OR LOWER(c.technologies) LIKE $${params.length} OR LOWER(c.short_summary) LIKE $${params.length})`);
    }

    if (category.trim()) {
      params.push(category.trim());
      conditions.push(`(cc.slug = $${params.length} OR CAST(cc.id AS TEXT) = $${params.length})`);
    }

    if (level.trim()) {
      params.push(level.trim());
      conditions.push(`c.skill_level = $${params.length}`);
    }

    if (duration.trim()) {
      if (duration === 'short') {
        conditions.push('c.duration_weeks <= 10');
      } else if (duration === 'medium') {
        conditions.push('c.duration_weeks > 10 AND c.duration_weeks <= 14');
      } else if (duration === 'long') {
        conditions.push('c.duration_weeks >= 16');
      }
    }

    if (featured === 'true') {
      params.push(true);
      conditions.push(`c.featured = $${params.length}`);
    }

    if (free === 'true') {
      conditions.push('c.course_fee = 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'c.featured DESC, c.id ASC';
    if (sort === 'price_asc') orderBy = 'c.course_fee ASC, c.id ASC';
    else if (sort === 'price_desc') orderBy = 'c.course_fee DESC, c.id ASC';
    else if (sort === 'popular') orderBy = 'c.enrolled_count DESC, c.id ASC';
    else if (sort === 'newest') orderBy = 'c.id DESC';

    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.min(100, Math.max(1, Number(limit) || 12));
    const offset = (pageNum - 1) * pageLimit;

    const countRow = await queryOne(
      `SELECT COUNT(*) AS total
       FROM courses c
       JOIN course_categories cc ON cc.id = c.category_id
       ${whereClause}`,
      params
    );

    const dataParams = [...params, pageLimit, offset];
    const rowsRes = await query(
      `SELECT c.*, cc.name AS category_name, cc.slug AS category_slug,
              u.full_name AS instructor_name,
              ip.headline AS instructor_headline, ip.company_background AS instructor_company, ip.bio AS instructor_bio
       FROM courses c
       JOIN course_categories cc ON cc.id = c.category_id
       LEFT JOIN users u ON u.id = c.instructor_id
       LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );

    const total = Number(countRow?.total || 0);
    res.json({
      success: true,
      courses: rowsRes.rows.map(formatCourse),
      pagination: {
        total,
        page: pageNum,
        limit: pageLimit,
        totalPages: Math.max(1, Math.ceil(total / pageLimit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Single course detail with full modules & lessons
router.get('/courses/:slugOrId', optionalAuth, async (req, res, next) => {
  try {
    const key = req.params.slugOrId;
    const isNumeric = /^\d+$/.test(key);
    const courseRow = await queryOne(
      `SELECT c.*, cc.name AS category_name, cc.slug AS category_slug,
              u.full_name AS instructor_name, u.avatar_url AS instructor_avatar,
              ip.headline AS instructor_headline, ip.company_background AS instructor_company,
              ip.bio AS instructor_bio, ip.years_experience AS instructor_years
       FROM courses c
       JOIN course_categories cc ON cc.id = c.category_id
       LEFT JOIN users u ON u.id = c.instructor_id
       LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
       WHERE ${isNumeric ? 'c.id = $1' : 'c.slug = $1'}`,
      [isNumeric ? Number(key) : key]
    );

    if (!courseRow) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const modulesRes = await query(
      'SELECT * FROM course_modules WHERE course_id = $1 ORDER BY module_order ASC, id ASC',
      [courseRow.id]
    );
    const lessonsRes = await query(
      'SELECT id, module_id, title, lesson_type, duration_minutes, lesson_order, is_free_preview FROM lessons WHERE course_id = $1 ORDER BY lesson_order ASC, id ASC',
      [courseRow.id]
    );

    const modules = modulesRes.rows.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      moduleOrder: m.module_order,
      lessons: lessonsRes.rows
        .filter((l) => l.module_id === m.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          lessonType: l.lesson_type,
          durationMinutes: l.duration_minutes,
          lessonOrder: l.lesson_order,
          isFreePreview: Boolean(l.is_free_preview),
        })),
    }));

    const course = formatCourse(courseRow);
    course.instructorYears = courseRow.instructor_years || 8;
    course.instructorAvatar = courseRow.instructor_avatar || null;
    course.modules = modules;

    res.json({ success: true, course });
  } catch (err) {
    next(err);
  }
});

// Admin: Create course
router.post('/courses', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = courseUpsertSchema.parse(req.body);
    const slug =
      data.slug ||
      `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString().slice(-4)}`;

    const created = await queryOne(
      `INSERT INTO courses (
        title, slug, short_summary, description, category_id, instructor_id,
        thumbnail_url, technologies, skill_level, duration, duration_weeks,
        course_fee, advance_amount, full_amount, learning_outcomes,
        internship_available, internship_details, status, featured, live_session_info
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20
      ) RETURNING *`,
      [
        data.title,
        slug,
        data.shortSummary,
        data.description,
        data.categoryId,
        data.instructorId || null,
        data.thumbnailUrl,
        JSON.stringify(data.technologies),
        data.skillLevel,
        data.duration,
        data.durationWeeks,
        data.courseFee,
        data.advanceAmount,
        data.courseFee,
        JSON.stringify(data.learningOutcomes),
        data.internshipAvailable,
        data.internshipDetails || null,
        data.status,
        data.featured,
        data.liveSessionInfo || 'Live Sessions: Weekend Cohort',
      ]
    );

    // Create default first module so LMS has structure immediately
    await query(
      `INSERT INTO course_modules (course_id, title, description, module_order)
       VALUES ($1, 'Module 1: Core Foundations', 'Initial onboarding and core concepts.', 1)`,
      [created.id]
    );

    await logAudit({
      actorUserId: req.user.id,
      action: 'COURSE_CREATED',
      entityType: 'COURSE',
      entityId: created.id,
      details: { title: created.title },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, course: created });
  } catch (err) {
    next(err);
  }
});

// Admin: Update course
router.put('/courses/:id', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const courseId = Number(req.params.id);
    const data = courseUpsertSchema.partial().parse(req.body);
    const existing = await queryOne('SELECT * FROM courses WHERE id = $1', [courseId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Course not found.' });

    const nextFee = data.courseFee ?? existing.course_fee;
    const updated = await queryOne(
      `UPDATE courses SET
        title = $1,
        short_summary = $2,
        description = $3,
        category_id = $4,
        instructor_id = $5,
        thumbnail_url = $6,
        technologies = $7,
        skill_level = $8,
        duration = $9,
        duration_weeks = $10,
        course_fee = $11,
        advance_amount = $12,
        full_amount = $13,
        learning_outcomes = $14,
        internship_available = $15,
        internship_details = $16,
        status = $17,
        featured = $18,
        live_session_info = $19,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $20 RETURNING *`,
      [
        data.title ?? existing.title,
        data.shortSummary ?? existing.short_summary,
        data.description ?? existing.description,
        data.categoryId ?? existing.category_id,
        data.instructorId !== undefined ? data.instructorId : existing.instructor_id,
        data.thumbnailUrl ?? existing.thumbnail_url,
        data.technologies ? JSON.stringify(data.technologies) : existing.technologies,
        data.skillLevel ?? existing.skill_level,
        data.duration ?? existing.duration,
        data.durationWeeks ?? existing.duration_weeks,
        nextFee,
        data.advanceAmount ?? existing.advance_amount,
        nextFee,
        data.learningOutcomes ? JSON.stringify(data.learningOutcomes) : existing.learning_outcomes,
        data.internshipAvailable !== undefined ? data.internshipAvailable : Boolean(existing.internship_available),
        data.internshipDetails !== undefined ? data.internshipDetails : existing.internship_details,
        data.status ?? existing.status,
        data.featured !== undefined ? data.featured : Boolean(existing.featured),
        data.liveSessionInfo !== undefined ? data.liveSessionInfo : existing.live_session_info,
        courseId,
      ]
    );

    await logAudit({
      actorUserId: req.user.id,
      action: 'COURSE_UPDATED',
      entityType: 'COURSE',
      entityId: courseId,
      ipAddress: req.ip,
    });

    res.json({ success: true, course: updated });
  } catch (err) {
    next(err);
  }
});

// Admin: Toggle publish status
router.patch('/courses/:id/status', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const courseId = Number(req.params.id);
    const { status } = req.body;
    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid course status.' });
    }
    const updated = await queryOne(
      'UPDATE courses SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, status',
      [status, courseId]
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Course not found.' });
    res.json({ success: true, course: updated });
  } catch (err) {
    next(err);
  }
});

// Admin: Delete course
router.delete('/courses/:id', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const courseId = Number(req.params.id);
    const admCount = await queryOne('SELECT COUNT(*) AS cnt FROM admissions WHERE course_id = $1', [courseId]);
    if (Number(admCount?.cnt || 0) > 0) {
      await query("UPDATE courses SET status = 'ARCHIVED' WHERE id = $1", [courseId]);
      return res.json({ success: true, archived: true, message: 'Course has active admissions and was archived instead of deleted.' });
    }
    await query('DELETE FROM courses WHERE id = $1', [courseId]);
    res.json({ success: true, message: 'Course deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// Admin: Create category
router.post('/categories', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { name, description, iconName = 'Layers' } = req.body;
    if (!name || !description) {
      return res.status(400).json({ success: false, message: 'Category name and description required.' });
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const cat = await queryOne(
      `INSERT INTO course_categories (name, slug, description, icon_name) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), slug, description.trim(), iconName]
    );
    res.status(201).json({ success: true, category: cat });
  } catch (err) {
    next(err);
  }
});

// Admin / Instructor: Add module to course (ownership verified for instructors)
router.post('/courses/:id/modules', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const courseId = Number(req.params.id);
    const course = await queryOne('SELECT id, instructor_id FROM courses WHERE id = $1', [courseId]);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });
    if (req.user.role === 'INSTRUCTOR' && course.instructor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only manage curriculum for courses assigned to you.' });
    }

    const { title, description = '' } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Module title required.' });

    const maxOrder = await queryOne('SELECT COALESCE(MAX(module_order), 0) AS max_ord FROM course_modules WHERE course_id = $1', [courseId]);
    const mod = await queryOne(
      `INSERT INTO course_modules (course_id, title, description, module_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [courseId, title.trim(), description.trim(), Number(maxOrder?.max_ord || 0) + 1]
    );
    res.status(201).json({ success: true, module: mod });
  } catch (err) {
    next(err);
  }
});

// Admin / Instructor: Add lesson to module (ownership verified for instructors)
router.post('/modules/:moduleId/lessons', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const moduleId = Number(req.params.moduleId);
    const mod = await queryOne(
      `SELECT m.id, m.course_id, c.instructor_id
       FROM course_modules m JOIN courses c ON c.id = m.course_id
       WHERE m.id = $1`,
      [moduleId]
    );
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found.' });
    if (req.user.role === 'INSTRUCTOR' && mod.instructor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only add lessons to courses assigned to you.' });
    }

    const { title, lessonType = 'VIDEO', videoUrl = null, content, resourceUrl = null, durationMinutes = 30, isFreePreview = false } = req.body;
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ success: false, message: 'Lesson title and content are required.' });
    }

    const maxOrd = await queryOne('SELECT COALESCE(MAX(lesson_order), 0) AS max_ord FROM lessons WHERE module_id = $1', [moduleId]);
    const lesson = await queryOne(
      `INSERT INTO lessons (module_id, course_id, title, lesson_type, video_url, content, resource_url, duration_minutes, lesson_order, is_free_preview)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        moduleId,
        mod.course_id,
        title.trim(),
        lessonType,
        videoUrl,
        content.trim(),
        resourceUrl,
        Number(durationMinutes) || 30,
        Number(maxOrd?.max_ord || 0) + 1,
        Boolean(isFreePreview),
      ]
    );
    res.status(201).json({ success: true, lesson });
  } catch (err) {
    next(err);
  }
});

export default router;
