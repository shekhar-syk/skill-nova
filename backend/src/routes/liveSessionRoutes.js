import { Router } from 'express';
import { query, queryOne } from '../db/index.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { createNotification } from '../services/auditService.js';
import { recordLearningActivity } from '../services/gamificationService.js';

const router = Router();

function isValidMeetingUrl(raw) {
  try {
    const parsed = new URL(String(raw || '').trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// List live sessions scoped by role
router.get('/live-sessions', authenticate, async (req, res, next) => {
  try {
    let rows = [];
    if (['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      rows = (
        await query(
          `SELECT ls.*, c.title AS course_title, u.full_name AS instructor_name,
                  (SELECT COUNT(*) FROM attendance a WHERE a.session_id = ls.id) AS attended_count
           FROM live_sessions ls
           JOIN courses c ON c.id = ls.course_id
           LEFT JOIN users u ON u.id = ls.instructor_id
           ORDER BY ls.scheduled_at DESC`
        )
      ).rows;
    } else if (req.user.role === 'INSTRUCTOR') {
      rows = (
        await query(
          `SELECT ls.*, c.title AS course_title, u.full_name AS instructor_name,
                  (SELECT COUNT(*) FROM attendance a WHERE a.session_id = ls.id) AS attended_count
           FROM live_sessions ls
           JOIN courses c ON c.id = ls.course_id
           LEFT JOIN users u ON u.id = ls.instructor_id
           WHERE c.instructor_id = $1 OR ls.instructor_id = $1
           ORDER BY ls.scheduled_at DESC`,
          [req.user.id]
        )
      ).rows;
    } else {
      rows = (
        await query(
          `SELECT ls.*, c.title AS course_title, u.full_name AS instructor_name,
                  att.status AS my_attendance_status, att.joined_at AS my_joined_at
           FROM live_sessions ls
           JOIN courses c ON c.id = ls.course_id
           JOIN enrollments e ON e.course_id = ls.course_id AND e.user_id = $1
           LEFT JOIN users u ON u.id = ls.instructor_id
           LEFT JOIN attendance att ON att.session_id = ls.id AND att.user_id = $1
           ORDER BY ls.scheduled_at DESC`,
          [req.user.id]
        )
      ).rows;
    }

    res.json({ success: true, sessions: rows });
  } catch (err) {
    next(err);
  }
});

// Student attendance history
router.get('/live-sessions/my-attendance', authenticate, async (req, res, next) => {
  try {
    const rows = (
      await query(
        `SELECT att.*, ls.title AS session_title, ls.scheduled_at, ls.meeting_platform, c.title AS course_title
         FROM attendance att
         JOIN live_sessions ls ON ls.id = att.session_id
         JOIN courses c ON c.id = ls.course_id
         WHERE att.user_id = $1
         ORDER BY att.joined_at DESC`,
        [req.user.id]
      )
    ).rows;
    res.json({ success: true, attendance: rows });
  } catch (err) {
    next(err);
  }
});

// Instructor / Admin: Schedule Live Session
router.post('/live-sessions', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const {
      courseId,
      title,
      description,
      meetingUrl,
      meetingPlatform = 'Google Meet',
      scheduledAt,
      durationMinutes = 60,
    } = req.body;

    if (!courseId || !title?.trim() || !description?.trim() || !scheduledAt || !isValidMeetingUrl(meetingUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Course, title, description, schedule date/time, and a valid HTTPS meeting link (Zoom/Google Meet) are required.',
      });
    }

    const course = await queryOne('SELECT id, title, instructor_id FROM courses WHERE id = $1', [Number(courseId)]);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

    if (req.user.role === 'INSTRUCTOR' && course.instructor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only schedule live sessions for courses assigned to you.' });
    }

    const session = await queryOne(
      `INSERT INTO live_sessions (
        course_id, instructor_id, title, description, meeting_url, meeting_platform, scheduled_at, duration_minutes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SCHEDULED') RETURNING *`,
      [
        Number(courseId),
        course.instructor_id || req.user.id,
        title.trim(),
        description.trim(),
        meetingUrl.trim(),
        meetingPlatform,
        scheduledAt,
        Number(durationMinutes) || 60,
      ]
    );

    // Notify enrolled students
    const enrolled = (await query('SELECT user_id FROM enrollments WHERE course_id = $1', [course.id])).rows;
    for (const enr of enrolled) {
      await createNotification({
        userId: enr.user_id,
        title: `New Live Class: ${session.title}`,
        message: `${course.title} · Scheduled for ${new Date(scheduledAt).toLocaleString('en-IN')}`,
        type: 'INFO',
        category: 'LIVE_CLASS',
        actionUrl: '/student',
      });
    }

    res.status(201).json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

// Instructor / Admin: Edit Live Session
router.put('/live-sessions/:id', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await queryOne(
      'SELECT ls.*, c.instructor_id AS course_instructor_id FROM live_sessions ls JOIN courses c ON c.id = ls.course_id WHERE ls.id = $1',
      [id]
    );
    if (!existing) return res.status(404).json({ success: false, message: 'Live session not found.' });

    if (req.user.role === 'INSTRUCTOR' && existing.course_instructor_id !== req.user.id && existing.instructor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this live session.' });
    }

    const { title, description, meetingUrl, meetingPlatform, scheduledAt, durationMinutes, status } = req.body;
    if (meetingUrl && !isValidMeetingUrl(meetingUrl)) {
      return res.status(400).json({ success: false, message: 'Meeting URL must use https://.' });
    }

    const updated = await queryOne(
      `UPDATE live_sessions SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        meeting_url = COALESCE($3, meeting_url),
        meeting_platform = COALESCE($4, meeting_platform),
        scheduled_at = COALESCE($5, scheduled_at),
        duration_minutes = COALESCE($6, duration_minutes),
        status = COALESCE($7, status),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [
        title || null,
        description || null,
        meetingUrl || null,
        meetingPlatform || null,
        scheduledAt || null,
        durationMinutes ? Number(durationMinutes) : null,
        status || null,
        id,
      ]
    );

    res.json({ success: true, session: updated });
  } catch (err) {
    next(err);
  }
});

// Instructor / Admin: Cancel Live Session
router.patch('/live-sessions/:id/cancel', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await queryOne(
      'SELECT ls.*, c.instructor_id AS course_instructor_id, c.title AS course_title FROM live_sessions ls JOIN courses c ON c.id = ls.course_id WHERE ls.id = $1',
      [id]
    );
    if (!existing) return res.status(404).json({ success: false, message: 'Live session not found.' });

    if (req.user.role === 'INSTRUCTOR' && existing.course_instructor_id !== req.user.id && existing.instructor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this session.' });
    }

    const reason = req.body.reason || 'Rescheduled by instructor';
    const updated = await queryOne(
      `UPDATE live_sessions SET status = 'CANCELLED', cancel_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [reason, id]
    );

    const enrolled = (await query('SELECT user_id FROM enrollments WHERE course_id = $1', [existing.course_id])).rows;
    for (const enr of enrolled) {
      await createNotification({
        userId: enr.user_id,
        title: `Live Class Cancelled: ${existing.title}`,
        message: `${existing.course_title}: ${reason}`,
        type: 'WARNING',
        category: 'LIVE_CLASS',
        actionUrl: '/student',
      });
    }

    res.json({ success: true, session: updated });
  } catch (err) {
    next(err);
  }
});

// Student: Join session & record attendance
router.post('/live-sessions/:id/attend', authenticate, async (req, res, next) => {
  try {
    const sessionId = Number(req.params.id);
    const session = await queryOne('SELECT * FROM live_sessions WHERE id = $1', [sessionId]);
    if (!session) return res.status(404).json({ success: false, message: 'Live session not found.' });
    if (session.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'This live session has been cancelled.' });
    }

    const isStaff = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'].includes(req.user.role);
    const enrolled = await queryOne('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [
      req.user.id,
      session.course_id,
    ]);
    if (!enrolled && !isStaff) {
      return res.status(403).json({ success: false, message: 'Enroll in this course to join its live sessions.' });
    }

    const startTime = new Date(session.scheduled_at).getTime();
    const isLate = !Number.isNaN(startTime) && Date.now() - startTime > 15 * 60 * 1000;
    const status = isLate ? 'LATE' : 'PRESENT';

    await query(
      `INSERT INTO attendance (session_id, user_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_id, user_id) DO UPDATE SET joined_at = CURRENT_TIMESTAMP`,
      [sessionId, req.user.id, status]
    );

    await recordLearningActivity(req.user.id, 30);

    res.json({
      success: true,
      attendanceStatus: status,
      meetingUrl: session.meeting_url,
    });
  } catch (err) {
    next(err);
  }
});

// Instructor / Admin: View session attendance roster
router.get('/live-sessions/:id/attendance', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const sessionId = Number(req.params.id);
    const session = await queryOne('SELECT * FROM live_sessions WHERE id = $1', [sessionId]);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

    const roster = (
      await query(
        `SELECT u.id AS user_id, u.full_name, u.email,
                COALESCE(a.status, 'ABSENT') AS status, a.joined_at, a.notes
         FROM enrollments e
         JOIN users u ON u.id = e.user_id
         LEFT JOIN attendance a ON a.session_id = $1 AND a.user_id = u.id
         WHERE e.course_id = $2
         ORDER BY u.full_name ASC`,
        [sessionId, session.course_id]
      )
    ).rows;

    res.json({ success: true, session, roster });
  } catch (err) {
    next(err);
  }
});

// Instructor / Admin: Mark attendance manually
router.post('/live-sessions/:id/attendance/mark', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const sessionId = Number(req.params.id);
    const { userId, status = 'PRESENT', notes = '' } = req.body;
    if (!['PRESENT', 'LATE', 'ABSENT'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid attendance status.' });
    }
    await query(
      `INSERT INTO attendance (session_id, user_id, status, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, user_id) DO UPDATE SET status = $3, notes = $4`,
      [sessionId, Number(userId), status, notes]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
