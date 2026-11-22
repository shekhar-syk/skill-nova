import { Router } from 'express';
import { config } from '../config/env.js';
import { query, queryOne } from '../db/index.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { logAudit } from '../services/auditService.js';
import { emailTemplates, sendTransactionalEmail } from '../services/emailService.js';
import { enquirySchema } from '../validators/schemas.js';

const router = Router();

// Public: Submit course enquiry
router.post('/', async (req, res, next) => {
  try {
    const data = enquirySchema.parse(req.body);
    const created = await queryOne(
      `INSERT INTO enquiries (full_name, email, mobile_number, course_id, course_interest, learning_preference, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEW') RETURNING *`,
      [
        data.fullName,
        data.email,
        data.mobileNumber,
        data.courseId || null,
        data.courseInterest,
        data.learningPreference,
        data.message,
      ]
    );

    const mail = emailTemplates.adminEnquiryAlert(data);
    await sendTransactionalEmail({ to: config.resend.adminEmail, ...mail });

    res.status(201).json({
      success: true,
      message: 'Your enquiry has been received. An academic counsellor will contact you shortly.',
      enquiry: {
        id: created.id,
        fullName: created.full_name,
        courseInterest: created.course_interest,
        status: created.status,
        createdAt: created.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Admin: List and filter enquiries
router.get('/', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { status = '', search = '' } = req.query;
    const conditions = [];
    const params = [];

    if (status.trim()) {
      params.push(status.trim());
      conditions.push(`e.status = $${params.length}`);
    }
    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(e.full_name) LIKE $${params.length} OR LOWER(e.email) LIKE $${params.length} OR LOWER(e.course_interest) LIKE $${params.length})`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const list = await query(
      `SELECT e.*, u.full_name AS counsellor_name
       FROM enquiries e
       LEFT JOIN users u ON u.id = e.assigned_counsellor_id
       ${whereClause}
       ORDER BY e.id DESC`,
      params
    );

    const notesRes = await query(
      `SELECT en.*, u.full_name AS author_name
       FROM enquiry_notes en
       LEFT JOIN users u ON u.id = en.author_id
       ORDER BY en.id DESC`
    );

    res.json({
      success: true,
      enquiries: list.rows.map((e) => ({
        id: e.id,
        fullName: e.full_name,
        email: e.email,
        mobileNumber: e.mobile_number,
        courseId: e.course_id,
        courseInterest: e.course_interest,
        learningPreference: e.learning_preference,
        message: e.message,
        status: e.status,
        assignedCounsellorId: e.assigned_counsellor_id,
        counsellorName: e.counsellor_name,
        followUpDate: e.follow_up_date,
        createdAt: e.created_at,
        notes: notesRes.rows
          .filter((n) => n.enquiry_id === e.id)
          .map((n) => ({
            id: n.id,
            note: n.note,
            authorName: n.author_name || 'Admin',
            createdAt: n.created_at,
          })),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Update enquiry status, counsellor, or follow-up date
router.patch('/:id', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, assignedCounsellorId, followUpDate } = req.body;
    const existing = await queryOne('SELECT * FROM enquiries WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Enquiry not found.' });

    const updated = await queryOne(
      `UPDATE enquiries SET
        status = $1,
        assigned_counsellor_id = $2,
        follow_up_date = $3,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [
        status || existing.status,
        assignedCounsellorId !== undefined ? assignedCounsellorId : existing.assigned_counsellor_id,
        followUpDate !== undefined ? followUpDate : existing.follow_up_date,
        id,
      ]
    );

    await logAudit({
      actorUserId: req.user.id,
      action: 'ENQUIRY_UPDATED',
      entityType: 'ENQUIRY',
      entityId: id,
      details: { status: updated.status },
      ipAddress: req.ip,
    });

    res.json({ success: true, enquiry: updated });
  } catch (err) {
    next(err);
  }
});

// Admin: Add internal counsellor note
router.post('/:id/notes', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ success: false, message: 'Note text is required.' });

    const created = await queryOne(
      `INSERT INTO enquiry_notes (enquiry_id, author_id, note) VALUES ($1, $2, $3) RETURNING *`,
      [id, req.user.id, note.trim()]
    );
    res.status(201).json({
      success: true,
      note: {
        id: created.id,
        note: created.note,
        authorName: req.user.fullName,
        createdAt: created.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
