import { query, queryOne } from '../db/index.js';

export async function logAudit({ actorUserId = null, action, entityType, entityId = null, details = null, ipAddress = null }) {
  try {
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actorUserId,
        action,
        entityType,
        entityId ? String(entityId) : null,
        details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
        ipAddress,
      ]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

const PREF_COLUMN_MAP = {
  ANNOUNCEMENT: 'announcements',
  LIVE_CLASS: 'live_reminders',
  ASSIGNMENT: 'assignment_deadlines',
  QUIZ: 'quiz_results',
  FEEDBACK: 'mentor_feedback',
  PAYMENT: 'payment_updates',
  PLACEMENT: 'placement_updates',
};

export async function createNotification({
  userId,
  title,
  message,
  type = 'INFO',
  category = 'ANNOUNCEMENT',
  actionUrl = null,
}) {
  try {
    if (!userId) return;

    // Respect user notification preferences if configured
    const prefCol = PREF_COLUMN_MAP[category];
    if (prefCol) {
      const prefs = await queryOne('SELECT * FROM notification_preferences WHERE user_id = $1', [userId]);
      if (prefs && (prefs[prefCol] === false || prefs[prefCol] === 0)) {
        return;
      }
    }

    await query(
      `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
      [userId, title, message, type]
    );

    await query(
      `INSERT INTO user_notifications (user_id, title, message, category, action_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, title, message, category, actionUrl]
    );
  } catch (err) {
    console.error('Notification insert error:', err.message);
  }
}
