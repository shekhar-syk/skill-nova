import { Router } from 'express';
import { query, queryOne } from '../db/index.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { createNotification } from '../services/auditService.js';
import { awardXp } from '../services/gamificationService.js';

const router = Router();

function safeJson(val, fallback) {
  if (Array.isArray(val)) return val;
  try {
    return JSON.parse(val || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

// List course discussions with search & pagination
router.get('/community/discussions', authenticate, async (req, res, next) => {
  try {
    const { courseId = '', search = '', page = '1', limit = '15' } = req.query;
    const isMod = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'].includes(req.user.role);
    const conditions = [];
    const params = [];

    if (!isMod) {
      params.push(false);
      conditions.push(`d.is_hidden = $${params.length}`);
    }
    if (courseId) {
      params.push(Number(courseId));
      conditions.push(`d.course_id = $${params.length}`);
    }
    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(d.title) LIKE $${params.length} OR LOWER(d.content) LIKE $${params.length} OR LOWER(d.tags) LIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.min(50, Math.max(1, Number(limit) || 15));
    const offset = (pageNum - 1) * pageLimit;

    const countRow = await queryOne(`SELECT COUNT(*) AS cnt FROM discussions d ${where}`, params);
    const dataParams = [...params, pageLimit, offset];
    const rows = (
      await query(
        `SELECT d.*, u.full_name AS author_name, u.role AS author_role, c.title AS course_title
         FROM discussions d
         JOIN users u ON u.id = d.user_id
         JOIN courses c ON c.id = d.course_id
         ${where}
         ORDER BY d.is_pinned DESC, d.id DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        dataParams
      )
    ).rows;

    const likedRows = (
      await query("SELECT target_id FROM discussion_likes WHERE user_id = $1 AND target_type = 'DISCUSSION'", [req.user.id])
    ).rows;
    const likedSet = new Set(likedRows.map((r) => r.target_id));

    const total = Number(countRow?.cnt || 0);
    res.json({
      success: true,
      discussions: rows.map((d) => ({
        ...d,
        tags: safeJson(d.tags, []),
        likedByMe: likedSet.has(d.id),
      })),
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

// Get discussion detail + nested replies
router.get('/community/discussions/:id', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const discussion = await queryOne(
      `SELECT d.*, u.full_name AS author_name, u.role AS author_role, c.title AS course_title
       FROM discussions d
       JOIN users u ON u.id = d.user_id
       JOIN courses c ON c.id = d.course_id
       WHERE d.id = $1`,
      [id]
    );
    if (!discussion) return res.status(404).json({ success: false, message: 'Discussion thread not found.' });

    const isMod = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'].includes(req.user.role);
    if (discussion.is_hidden && !isMod) {
      return res.status(404).json({ success: false, message: 'Discussion thread is unavailable.' });
    }

    const replies = (
      await query(
        `SELECT r.*, u.full_name AS author_name, u.role AS author_role
         FROM discussion_replies r
         JOIN users u ON u.id = r.user_id
         WHERE r.discussion_id = $1 ${isMod ? '' : 'AND r.is_hidden = FALSE'}
         ORDER BY r.is_accepted DESC, r.id ASC`,
        [id]
      )
    ).rows;

    const likedReplies = (
      await query("SELECT target_id FROM discussion_likes WHERE user_id = $1 AND target_type = 'REPLY'", [req.user.id])
    ).rows;
    const likedSet = new Set(likedReplies.map((r) => r.target_id));

    res.json({
      success: true,
      discussion: { ...discussion, tags: safeJson(discussion.tags, []) },
      replies: replies.map((r) => ({ ...r, likedByMe: likedSet.has(r.id) })),
    });
  } catch (err) {
    next(err);
  }
});

// Create new discussion question
router.post('/community/discussions', authenticate, async (req, res, next) => {
  try {
    const { courseId, title, content, tags = [] } = req.body;
    if (!courseId || !title?.trim() || !content?.trim()) {
      return res.status(400).json({ success: false, message: 'Course, title, and question details are required.' });
    }

    const isStaff = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'].includes(req.user.role);
    const enrolled = await queryOne('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [
      req.user.id,
      Number(courseId),
    ]);
    if (!enrolled && !isStaff) {
      return res.status(403).json({ success: false, message: 'Enroll in this course to post in its community forum.' });
    }

    const tagsArr = Array.isArray(tags)
      ? tags
      : String(tags).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5);

    const created = await queryOne(
      `INSERT INTO discussions (course_id, user_id, title, content, tags)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [Number(courseId), req.user.id, title.trim(), content.trim(), JSON.stringify(tagsArr)]
    );

    res.status(201).json({ success: true, discussion: created });
  } catch (err) {
    next(err);
  }
});

// Post answer or nested reply
router.post('/community/discussions/:id/replies', authenticate, async (req, res, next) => {
  try {
    const discussionId = Number(req.params.id);
    const { content, parentReplyId = null } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Reply content cannot be empty.' });
    }

    const disc = await queryOne('SELECT * FROM discussions WHERE id = $1', [discussionId]);
    if (!disc) return res.status(404).json({ success: false, message: 'Discussion not found.' });
    if (disc.is_locked) return res.status(403).json({ success: false, message: 'This thread is locked.' });

    const reply = await queryOne(
      `INSERT INTO discussion_replies (discussion_id, parent_reply_id, user_id, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [discussionId, parentReplyId ? Number(parentReplyId) : null, req.user.id, content.trim()]
    );

    await query('UPDATE discussions SET replies_count = replies_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [
      discussionId,
    ]);

    if (disc.user_id !== req.user.id) {
      await createNotification({
        userId: disc.user_id,
        title: 'New Reply to Your Discussion',
        message: `${req.user.fullName} replied on "${disc.title}".`,
        type: 'INFO',
        category: 'ANNOUNCEMENT',
        actionUrl: '/student',
      });
    }

    res.status(201).json({ success: true, reply });
  } catch (err) {
    next(err);
  }
});

// Toggle upvote/like on discussion or reply
router.post('/community/likes', authenticate, async (req, res, next) => {
  try {
    const { targetType, targetId } = req.body;
    if (!['DISCUSSION', 'REPLY'].includes(targetType) || !targetId) {
      return res.status(400).json({ success: false, message: 'Invalid like target.' });
    }
    const id = Number(targetId);
    const existing = await queryOne(
      'SELECT id FROM discussion_likes WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
      [req.user.id, targetType, id]
    );

    let liked = false;
    if (existing) {
      await query('DELETE FROM discussion_likes WHERE id = $1', [existing.id]);
    } else {
      await query('INSERT INTO discussion_likes (user_id, target_type, target_id) VALUES ($1, $2, $3)', [
        req.user.id,
        targetType,
        id,
      ]);
      liked = true;
    }

    const cntRow = await queryOne(
      'SELECT COUNT(*) AS cnt FROM discussion_likes WHERE target_type = $1 AND target_id = $2',
      [targetType, id]
    );
    const count = Number(cntRow?.cnt || 0);
    const table = targetType === 'DISCUSSION' ? 'discussions' : 'discussion_replies';
    await query(`UPDATE ${table} SET likes_count = $1 WHERE id = $2`, [count, id]);

    res.json({ success: true, liked, likesCount: count });
  } catch (err) {
    next(err);
  }
});

// Mark accepted answer (thread author or instructor/admin)
router.patch('/community/replies/:replyId/accept', authenticate, async (req, res, next) => {
  try {
    const replyId = Number(req.params.replyId);
    const reply = await queryOne('SELECT * FROM discussion_replies WHERE id = $1', [replyId]);
    if (!reply) return res.status(404).json({ success: false, message: 'Reply not found.' });

    const disc = await queryOne('SELECT * FROM discussions WHERE id = $1', [reply.discussion_id]);
    const isStaff = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'].includes(req.user.role);
    if (disc.user_id !== req.user.id && !isStaff) {
      return res.status(403).json({ success: false, message: 'Only the thread author or an instructor can accept an answer.' });
    }

    await query('UPDATE discussion_replies SET is_accepted = $1 WHERE discussion_id = $2', [false, disc.id]);
    await query('UPDATE discussion_replies SET is_accepted = $1 WHERE id = $2', [true, replyId]);
    await query('UPDATE discussions SET accepted_reply_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      replyId,
      disc.id,
    ]);

    if (reply.user_id !== disc.user_id) {
      await awardXp({
        userId: reply.user_id,
        eventType: 'COMMUNITY_HELP',
        eventKey: `ACCEPTED_REPLY:${replyId}`,
        points: 15,
        description: `Answer accepted on "${disc.title}"`,
        activityMinutes: 10,
      });
    }

    res.json({ success: true, acceptedReplyId: replyId });
  } catch (err) {
    next(err);
  }
});

// Report inappropriate thread or reply
router.post('/community/report', authenticate, async (req, res, next) => {
  try {
    const { targetType, targetId, reason = 'Inappropriate content' } = req.body;
    const table = targetType === 'REPLY' ? 'discussion_replies' : 'discussions';
    await query(`UPDATE ${table} SET is_reported = $1, report_reason = $2 WHERE id = $3`, [
      true,
      String(reason).slice(0, 300),
      Number(targetId),
    ]);
    res.json({ success: true, message: 'Content reported to moderators.' });
  } catch (err) {
    next(err);
  }
});

// Admin / Instructor Moderation Queue & Actions
router.get('/community/moderation', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (_req, res, next) => {
  try {
    const reportedDiscussions = (
      await query(
        `SELECT d.*, u.full_name AS author_name, c.title AS course_title
         FROM discussions d JOIN users u ON u.id = d.user_id JOIN courses c ON c.id = d.course_id
         WHERE d.is_reported = $1 OR d.is_hidden = $1 ORDER BY d.id DESC`,
        [true]
      )
    ).rows;
    const reportedReplies = (
      await query(
        `SELECT r.*, u.full_name AS author_name, d.title AS discussion_title
         FROM discussion_replies r JOIN users u ON u.id = r.user_id JOIN discussions d ON d.id = r.discussion_id
         WHERE r.is_reported = $1 OR r.is_hidden = $1 ORDER BY r.id DESC`,
        [true]
      )
    ).rows;

    res.json({ success: true, reportedDiscussions, reportedReplies });
  } catch (err) {
    next(err);
  }
});

router.patch('/community/moderate', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const { targetType = 'DISCUSSION', targetId, action } = req.body;
    const id = Number(targetId);
    const table = targetType === 'REPLY' ? 'discussion_replies' : 'discussions';

    if (action === 'HIDE') {
      await query(`UPDATE ${table} SET is_hidden = $1 WHERE id = $2`, [true, id]);
    } else if (action === 'UNHIDE') {
      await query(`UPDATE ${table} SET is_hidden = $1, is_reported = $2 WHERE id = $3`, [false, false, id]);
    } else if (action === 'DISMISS_REPORT') {
      await query(`UPDATE ${table} SET is_reported = $1, report_reason = NULL WHERE id = $2`, [false, id]);
    } else if (action === 'LOCK' && table === 'discussions') {
      await query('UPDATE discussions SET is_locked = $1 WHERE id = $2', [true, id]);
    } else if (action === 'PIN' && table === 'discussions') {
      await query('UPDATE discussions SET is_pinned = $1 WHERE id = $2', [true, id]);
    } else if (action === 'DELETE') {
      await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    }

    res.json({ success: true, message: 'Moderation action applied.' });
  } catch (err) {
    next(err);
  }
});

export default router;
