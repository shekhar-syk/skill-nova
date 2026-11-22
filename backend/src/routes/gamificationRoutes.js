import { Router } from 'express';
import { isPostgres, query, queryOne } from '../db/index.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { awardXp } from '../services/gamificationService.js';

const router = Router();

function computeLevel(xp) {
  const level = Math.floor(xp / 250) + 1;
  const currentFloor = (level - 1) * 250;
  const nextCeiling = level * 250;
  return { level, currentFloor, nextCeiling };
}

// Student Gamification Profile (XP, streak, weekly goal, badges, recent XP ledger)
router.get('/gamification/me', authenticate, async (req, res, next) => {
  try {
    const xpRow = await queryOne(
      'SELECT COALESCE(SUM(points), 0) AS total_xp FROM student_points WHERE user_id = $1',
      [req.user.id]
    );
    const totalXp = Number(xpRow?.total_xp || 0);
    const levelInfo = computeLevel(totalXp);

    let streak = await queryOne('SELECT * FROM learning_streaks WHERE user_id = $1', [req.user.id]);
    if (!streak) {
      streak = {
        current_streak: 0,
        longest_streak: 0,
        last_activity_date: null,
        weekly_goal_minutes: 180,
        weekly_minutes_done: 0,
      };
    }

    const allBadges = (await query('SELECT * FROM achievements ORDER BY id ASC')).rows;
    const unlockedRows = (
      await query('SELECT achievement_id, unlocked_at FROM student_achievements WHERE user_id = $1', [req.user.id])
    ).rows;
    const unlockedMap = new Map(unlockedRows.map((r) => [r.achievement_id, r.unlocked_at]));

    const achievements = allBadges.map((b) => ({
      id: b.id,
      code: b.code,
      title: b.title,
      description: b.description,
      iconName: b.icon_name,
      xpReward: b.xp_reward,
      unlocked: unlockedMap.has(b.id),
      unlockedAt: unlockedMap.get(b.id) || null,
    }));

    const recentPoints = (
      await query('SELECT * FROM student_points WHERE user_id = $1 ORDER BY id DESC LIMIT 15', [req.user.id])
    ).rows;

    // Student overall rank
    const higherRanks = await queryOne(
      `SELECT COUNT(*) AS cnt FROM (
         SELECT user_id, SUM(points) AS xp FROM student_points GROUP BY user_id HAVING SUM(points) > $1
       ) t`,
      [totalXp]
    );

    res.json({
      success: true,
      totalXp,
      ...levelInfo,
      rank: Number(higherRanks?.cnt || 0) + 1,
      streak: {
        currentStreak: Number(streak.current_streak || 0),
        longestStreak: Number(streak.longest_streak || 0),
        lastActivityDate: streak.last_activity_date,
        weeklyGoalMinutes: Number(streak.weekly_goal_minutes || 180),
        weeklyMinutesDone: Number(streak.weekly_minutes_done || 0),
      },
      achievements,
      recentPoints,
    });
  } catch (err) {
    next(err);
  }
});

// Update Weekly Learning Goal (minutes)
router.put('/gamification/goal', authenticate, async (req, res, next) => {
  try {
    const minutes = Math.min(1800, Math.max(30, Number(req.body.weeklyGoalMinutes || 180)));
    const today = new Date().toISOString().slice(0, 10);
    await query(
      `INSERT INTO learning_streaks (user_id, weekly_goal_minutes, week_start_date)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET weekly_goal_minutes = $2, updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, minutes, today]
    );
    res.json({ success: true, weeklyGoalMinutes: minutes });
  } catch (err) {
    next(err);
  }
});

// Weekly & Monthly Leaderboard
router.get('/gamification/leaderboard', authenticate, async (req, res, next) => {
  try {
    const period = req.query.period === 'monthly' ? 'monthly' : 'weekly';
    const days = period === 'monthly' ? 30 : 7;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();

    const dateFilter = isPostgres ? 'sp.created_at >= $1::timestamp' : 'sp.created_at >= $1';
    const rows = (
      await query(
        `SELECT u.id, u.full_name, u.avatar_url,
                COALESCE(SUM(sp.points), 0) AS xp,
                COALESCE(ls.current_streak, 0) AS current_streak,
                (SELECT COUNT(*) FROM student_achievements sa WHERE sa.user_id = u.id) AS badges_count
         FROM users u
         LEFT JOIN student_points sp ON sp.user_id = u.id AND ${dateFilter}
         LEFT JOIN learning_streaks ls ON ls.user_id = u.id
         WHERE u.role = 'STUDENT' AND u.is_active = $2
         GROUP BY u.id, u.full_name, u.avatar_url, ls.current_streak
         ORDER BY xp DESC, current_streak DESC, u.id ASC
         LIMIT 20`,
        [cutoff, true]
      )
    ).rows;

    const leaderboard = rows.map((r, idx) => ({
      rank: idx + 1,
      userId: r.id,
      fullName: r.full_name,
      avatarUrl: r.avatar_url,
      xp: Number(r.xp || 0),
      level: computeLevel(Number(r.xp || 0)).level,
      currentStreak: Number(r.current_streak || 0),
      badgesCount: Number(r.badges_count || 0),
      isMe: r.id === req.user.id,
    }));

    res.json({ success: true, period, leaderboard });
  } catch (err) {
    next(err);
  }
});

// Admin: Gamification Analytics
router.get('/admin/gamification-analytics', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (_req, res, next) => {
  try {
    const totalXpRow = await queryOne('SELECT COALESCE(SUM(points), 0) AS total FROM student_points');
    const activeStreaksRow = await queryOne('SELECT COUNT(*) AS cnt FROM learning_streaks WHERE current_streak > 0');
    const unlockedBadgesRow = await queryOne('SELECT COUNT(*) AS cnt FROM student_achievements');
    const byEventType = (
      await query('SELECT event_type, COUNT(*) AS count, COALESCE(SUM(points), 0) AS xp FROM student_points GROUP BY event_type')
    ).rows;

    res.json({
      success: true,
      summary: {
        totalXpAwarded: Number(totalXpRow?.total || 0),
        activeStreaks: Number(activeStreaksRow?.cnt || 0),
        badgesUnlocked: Number(unlockedBadgesRow?.cnt || 0),
      },
      byEventType: byEventType.map((r) => ({
        eventType: r.event_type,
        count: Number(r.count),
        xp: Number(r.xp),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Record Circuit Runner 3D Stage Completion XP (non-duplicate per stage)
router.post('/gamification/game-reward', authenticate, async (req, res, next) => {
  try {
    const stage = Number(req.body?.stage);
    const score = Number(req.body?.score ?? 0);
    if (![1, 2, 3].includes(stage)) {
      return res.status(400).json({ success: false, message: 'Invalid game stage. Must be 1, 2, or 3.' });
    }
    if (!Number.isFinite(score) || score < 0) {
      return res.status(400).json({ success: false, message: 'Invalid game score.' });
    }

    const reward = await awardXp({
      userId: req.user.id,
      eventType: 'STREAK_BONUS',
      eventKey: `GAME_CIRCUIT_STAGE:${stage}`,
      points: 25,
      description: `Cleared Circuit Runner 3D Stage ${stage} (Score: ${Math.round(score)})`,
      activityMinutes: 10,
    });

    res.json({
      success: true,
      stage,
      awarded: reward.awarded,
      pointsAdded: reward.pointsAdded,
      newBadges: reward.newBadges,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
