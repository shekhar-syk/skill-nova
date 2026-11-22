import { Router } from 'express';
import { query, queryOne } from '../db/index.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { createNotification } from '../services/auditService.js';

const router = Router();

// Notification Center feed + unread count
router.get('/notifications/center', authenticate, async (req, res, next) => {
  try {
    const category = String(req.query.category || '').trim();
    const params = [req.user.id];
    let catClause = '';
    if (category) {
      params.push(category);
      catClause = ' AND category = $2';
    }

    const list = (
      await query(
        `SELECT * FROM user_notifications WHERE user_id = $1${catClause} ORDER BY id DESC LIMIT 40`,
        params
      )
    ).rows;

    const unreadRow = await queryOne(
      'SELECT COUNT(*) AS cnt FROM user_notifications WHERE user_id = $1 AND is_read = $2',
      [req.user.id, false]
    );

    res.json({
      success: true,
      notifications: list,
      unreadCount: Number(unreadRow?.cnt || 0),
    });
  } catch (err) {
    next(err);
  }
});

// Mark single notification read (ownership check)
router.patch('/notifications/center/:id/read', authenticate, async (req, res, next) => {
  try {
    await query('UPDATE user_notifications SET is_read = $1 WHERE id = $2 AND user_id = $3', [
      true,
      Number(req.params.id),
      req.user.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Mark all notifications read
router.post('/notifications/center/read-all', authenticate, async (req, res, next) => {
  try {
    await query('UPDATE user_notifications SET is_read = $1 WHERE user_id = $2', [true, req.user.id]);
    await query('UPDATE notifications SET is_read = $1 WHERE user_id = $2', [true, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Notification preferences GET / PUT
router.get('/notifications/preferences', authenticate, async (req, res, next) => {
  try {
    let prefs = await queryOne('SELECT * FROM notification_preferences WHERE user_id = $1', [req.user.id]);
    if (!prefs) {
      prefs = await queryOne(
        'INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING *',
        [req.user.id]
      );
    }
    res.json({
      success: true,
      preferences: {
        announcements: Boolean(prefs.announcements),
        liveReminders: Boolean(prefs.live_reminders),
        assignmentDeadlines: Boolean(prefs.assignment_deadlines),
        quizResults: Boolean(prefs.quiz_results),
        mentorFeedback: Boolean(prefs.mentor_feedback),
        paymentUpdates: Boolean(prefs.payment_updates),
        placementUpdates: Boolean(prefs.placement_updates),
        emailDigest: Boolean(prefs.email_digest),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put('/notifications/preferences', authenticate, async (req, res, next) => {
  try {
    const p = req.body || {};
    await query(
      `INSERT INTO notification_preferences (
        user_id, announcements, live_reminders, assignment_deadlines,
        quiz_results, mentor_feedback, payment_updates, placement_updates, email_digest
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) DO UPDATE SET
        announcements = $2, live_reminders = $3, assignment_deadlines = $4,
        quiz_results = $5, mentor_feedback = $6, payment_updates = $7,
        placement_updates = $8, email_digest = $9, updated_at = CURRENT_TIMESTAMP`,
      [
        req.user.id,
        p.announcements !== false,
        p.liveReminders !== false,
        p.assignmentDeadlines !== false,
        p.quizResults !== false,
        p.mentorFeedback !== false,
        p.paymentUpdates !== false,
        p.placementUpdates !== false,
        p.emailDigest !== false,
      ]
    );
    res.json({ success: true, message: 'Notification preferences saved.' });
  } catch (err) {
    next(err);
  }
});

// Admin: Broadcast announcement notification
router.post('/admin/notifications/broadcast', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { title, message, audience = 'ALL_STUDENTS', courseId = null, category = 'ANNOUNCEMENT' } = req.body;
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }

    let recipients = [];
    if (audience === 'COURSE_ENROLLED' && courseId) {
      recipients = (await query('SELECT user_id AS id FROM enrollments WHERE course_id = $1', [Number(courseId)])).rows;
    } else if (audience === 'ALL_INSTRUCTORS') {
      recipients = (await query("SELECT id FROM users WHERE role = 'INSTRUCTOR' AND is_active = $1", [true])).rows;
    } else if (audience === 'ALL_USERS') {
      recipients = (await query('SELECT id FROM users WHERE is_active = $1', [true])).rows;
    } else {
      recipients = (await query("SELECT id FROM users WHERE role = 'STUDENT' AND is_active = $1", [true])).rows;
    }

    for (const r of recipients) {
      await createNotification({
        userId: r.id,
        title: title.trim(),
        message: message.trim(),
        type: 'INFO',
        category,
        actionUrl: '/student',
      });
    }

    res.status(201).json({
      success: true,
      sentCount: recipients.length,
      message: `Notification broadcast delivered to ${recipients.length} users.`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
