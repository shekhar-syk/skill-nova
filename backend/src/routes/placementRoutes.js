import { Router } from 'express';
import { query, queryOne } from '../db/index.js';
import { authenticate, authorizeRoles, optionalAuth } from '../middleware/authMiddleware.js';
import { createNotification } from '../services/auditService.js';
import { uploadBufferToMedia, uploadMiddleware } from '../services/cloudinaryService.js';

const router = Router();

function safeJson(val, fallback) {
  if (Array.isArray(val)) return val;
  try {
    return JSON.parse(val || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

// List companies (public / authenticated)
router.get('/placements/companies', async (_req, res, next) => {
  try {
    const rows = (await query('SELECT * FROM companies ORDER BY name ASC')).rows;
    res.json({ success: true, companies: rows });
  } catch (err) {
    next(err);
  }
});

// List job & internship opportunities with filtering
router.get('/placements/jobs', optionalAuth, async (req, res, next) => {
  try {
    const { type = '', search = '', status = 'OPEN' } = req.query;
    const isAdmin = req.user && ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
    const conditions = [];
    const params = [];

    if (!isAdmin || status) {
      if (status !== 'ALL') {
        params.push(status || 'OPEN');
        conditions.push(`j.status = $${params.length}`);
      }
    }
    if (type && ['JOB', 'INTERNSHIP'].includes(type)) {
      params.push(type);
      conditions.push(`j.opportunity_type = $${params.length}`);
    }
    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(j.title) LIKE $${params.length} OR LOWER(c.name) LIKE $${params.length} OR LOWER(j.required_skills) LIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = (
      await query(
        `SELECT j.*, c.name AS company_name, c.industry AS company_industry, c.location AS company_location, c.website_url AS company_website
         FROM job_opportunities j
         JOIN companies c ON c.id = j.company_id
         ${where}
         ORDER BY j.id DESC`,
        params
      )
    ).rows;

    let appliedMap = new Map();
    if (req.user) {
      const apps = (await query('SELECT opportunity_id, status FROM job_applications WHERE user_id = $1', [req.user.id])).rows;
      appliedMap = new Map(apps.map((a) => [a.opportunity_id, a.status]));
    }

    res.json({
      success: true,
      opportunities: rows.map((r) => ({
        ...r,
        required_skills: safeJson(r.required_skills, []),
        myApplicationStatus: appliedMap.get(r.id) || null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Student: Apply to Job/Internship (supports resume file upload or resume URL)
router.post('/placements/jobs/:id/apply', authenticate, uploadMiddleware.single('resume'), async (req, res, next) => {
  try {
    const opportunityId = Number(req.params.id);
    const job = await queryOne(
      'SELECT j.*, c.name AS company_name FROM job_opportunities j JOIN companies c ON c.id = j.company_id WHERE j.id = $1',
      [opportunityId]
    );
    if (!job || job.status !== 'OPEN') {
      return res.status(404).json({ success: false, message: 'This opportunity is not open for applications.' });
    }

    const existing = await queryOne(
      'SELECT id FROM job_applications WHERE opportunity_id = $1 AND user_id = $2',
      [opportunityId, req.user.id]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already applied to this opportunity.' });
    }

    let resumeUrl = req.body.resumeUrl?.trim() || '';
    let resumeFilename = null;
    if (req.file) {
      const uploaded = await uploadBufferToMedia(req.file, 'skillnova/resumes');
      resumeUrl = uploaded.url;
      resumeFilename = uploaded.originalName;
    }

    if (!resumeUrl) {
      return res.status(400).json({ success: false, message: 'Please upload your resume (PDF) or provide a resume link.' });
    }

    const appRow = await queryOne(
      `INSERT INTO job_applications (
        opportunity_id, user_id, resume_url, resume_filename, cover_note, portfolio_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'APPLIED') RETURNING *`,
      [
        opportunityId,
        req.user.id,
        resumeUrl,
        resumeFilename,
        req.body.coverNote || '',
        req.body.portfolioUrl || null,
      ]
    );

    await createNotification({
      userId: req.user.id,
      title: `Application Submitted: ${job.title}`,
      message: `Your application to ${job.company_name} has been received.`,
      type: 'SUCCESS',
      category: 'PLACEMENT',
      actionUrl: '/student',
    });

    res.status(201).json({ success: true, application: appRow });
  } catch (err) {
    next(err);
  }
});

// Student: View My Applications & Mentor Recommendations
router.get('/placements/my-applications', authenticate, async (req, res, next) => {
  try {
    const apps = (
      await query(
        `SELECT ja.*, j.title AS job_title, j.opportunity_type, j.location, j.stipend_or_ctc,
                c.name AS company_name, rec.full_name AS recommender_name
         FROM job_applications ja
         JOIN job_opportunities j ON j.id = ja.opportunity_id
         JOIN companies c ON c.id = j.company_id
         LEFT JOIN users rec ON rec.id = ja.recommended_by
         WHERE ja.user_id = $1
         ORDER BY ja.applied_at DESC`,
        [req.user.id]
      )
    ).rows;

    const recs = (
      await query(
        `SELECT sr.*, u.full_name AS instructor_name, c.title AS course_title, jo.title AS job_title
         FROM student_recommendations sr
         JOIN users u ON u.id = sr.instructor_id
         LEFT JOIN courses c ON c.id = sr.course_id
         LEFT JOIN job_opportunities jo ON jo.id = sr.opportunity_id
         WHERE sr.student_id = $1
         ORDER BY sr.created_at DESC`,
        [req.user.id]
      )
    ).rows;

    res.json({ success: true, applications: apps, recommendations: recs });
  } catch (err) {
    next(err);
  }
});

// Instructor: Recommend eligible student for placement
router.post('/placements/recommend', authenticate, authorizeRoles('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { studentId, opportunityId = null, courseId = null, endorsementNote } = req.body;
    if (!studentId || !endorsementNote?.trim()) {
      return res.status(400).json({ success: false, message: 'Student and endorsement note are required.' });
    }

    const student = await queryOne("SELECT id, full_name FROM users WHERE id = $1 AND role = 'STUDENT'", [Number(studentId)]);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    const rec = await queryOne(
      `INSERT INTO student_recommendations (student_id, instructor_id, opportunity_id, course_id, endorsement_note)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        Number(studentId),
        req.user.id,
        opportunityId ? Number(opportunityId) : null,
        courseId ? Number(courseId) : null,
        endorsementNote.trim(),
      ]
    );

    if (opportunityId) {
      await query(
        `UPDATE job_applications SET recommended_by = $1, recommendation_note = $2, updated_at = CURRENT_TIMESTAMP
         WHERE opportunity_id = $3 AND user_id = $4`,
        [req.user.id, endorsementNote.trim(), Number(opportunityId), Number(studentId)]
      );
    }

    await createNotification({
      userId: student.id,
      title: 'Mentor Placement Recommendation',
      message: `${req.user.fullName} endorsed you for placement opportunities.`,
      type: 'SUCCESS',
      category: 'PLACEMENT',
      actionUrl: '/student',
    });

    res.status(201).json({ success: true, recommendation: rec });
  } catch (err) {
    next(err);
  }
});

// Admin: Create Company
router.post('/admin/placements/companies', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { name, industry, location, websiteUrl = '', description } = req.body;
    if (!name?.trim() || !industry?.trim() || !location?.trim() || !description?.trim()) {
      return res.status(400).json({ success: false, message: 'Name, industry, location, and description are required.' });
    }
    const row = await queryOne(
      `INSERT INTO companies (name, industry, location, website_url, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), industry.trim(), location.trim(), websiteUrl.trim() || null, description.trim()]
    );
    res.status(201).json({ success: true, company: row });
  } catch (err) {
    next(err);
  }
});

// Admin: Create Job/Internship Opportunity
router.post('/admin/placements/jobs', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const {
      companyId,
      title,
      opportunityType = 'JOB',
      location,
      workMode = 'Hybrid',
      stipendOrCtc,
      eligibility,
      requiredSkills = [],
      description,
      applicationDeadline,
    } = req.body;

    if (!companyId || !title?.trim() || !location?.trim() || !stipendOrCtc?.trim() || !eligibility?.trim() || !description?.trim() || !applicationDeadline) {
      return res.status(400).json({ success: false, message: 'All job opportunity fields are required.' });
    }

    const row = await queryOne(
      `INSERT INTO job_opportunities (
        company_id, title, opportunity_type, location, work_mode, stipend_or_ctc,
        eligibility, required_skills, description, application_deadline, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'OPEN') RETURNING *`,
      [
        Number(companyId),
        title.trim(),
        opportunityType === 'INTERNSHIP' ? 'INTERNSHIP' : 'JOB',
        location.trim(),
        workMode,
        stipendOrCtc.trim(),
        eligibility.trim(),
        JSON.stringify(Array.isArray(requiredSkills) ? requiredSkills : String(requiredSkills).split(',').map((s) => s.trim()).filter(Boolean)),
        description.trim(),
        applicationDeadline,
      ]
    );
    res.status(201).json({ success: true, opportunity: row });
  } catch (err) {
    next(err);
  }
});

// Admin: Update Job status
router.patch('/admin/placements/jobs/:id/status', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const status = req.body.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
    const updated = await queryOne(
      'UPDATE job_opportunities SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, Number(req.params.id)]
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Opportunity not found.' });
    res.json({ success: true, opportunity: updated });
  } catch (err) {
    next(err);
  }
});

// Admin: List all job applications
router.get('/admin/placements/applications', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (_req, res, next) => {
  try {
    const rows = (
      await query(
        `SELECT ja.*, u.full_name AS student_name, u.email AS student_email,
                j.title AS job_title, j.opportunity_type, c.name AS company_name,
                rec.full_name AS recommender_name
         FROM job_applications ja
         JOIN users u ON u.id = ja.user_id
         JOIN job_opportunities j ON j.id = ja.opportunity_id
         JOIN companies c ON c.id = j.company_id
         LEFT JOIN users rec ON rec.id = ja.recommended_by
         ORDER BY ja.applied_at DESC`
      )
    ).rows;
    res.json({ success: true, applications: rows });
  } catch (err) {
    next(err);
  }
});

// Admin: Update application status
router.patch('/admin/placements/applications/:id/status', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const allowed = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED'];
    const { status, adminRemarks = '' } = req.body;
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid application status.' });
    }

    const updated = await queryOne(
      `UPDATE job_applications SET status = $1, admin_remarks = COALESCE($2, admin_remarks), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [status, adminRemarks || null, Number(req.params.id)]
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Application not found.' });

    await createNotification({
      userId: updated.user_id,
      title: `Placement Update: ${status.replace(/_/g, ' ')}`,
      message: adminRemarks || `Your job application status changed to ${status.replace(/_/g, ' ')}.`,
      type: status === 'SELECTED' || status === 'SHORTLISTED' ? 'SUCCESS' : 'INFO',
      category: 'PLACEMENT',
      actionUrl: '/student',
    });

    res.json({ success: true, application: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
