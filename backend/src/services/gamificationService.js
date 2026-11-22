import { query, queryOne } from '../db/index.js';
import { createNotification } from './auditService.js';

export const XP_VALUES = {
  LESSON: 10,
  MODULE: 50,
  QUIZ_PASS: 30,
  COURSE_COMPLETE: 200,
  ROADMAP_STEP: 15,
};

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayIso() {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

function getWeekStartIso() {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  return monday.toISOString().slice(0, 10);
}

export async function recordLearningActivity(userId, minutesEarned = 15) {
  const today = getTodayIso();
  const yesterday = getYesterdayIso();
  const weekStart = getWeekStartIso();

  const existing = await queryOne('SELECT * FROM learning_streaks WHERE user_id = $1', [userId]);
  if (!existing) {
    await query(
      `INSERT INTO learning_streaks (
        user_id, current_streak, longest_streak, last_activity_date,
        weekly_goal_minutes, weekly_minutes_done, week_start_date
      ) VALUES ($1, 1, 1, $2, 180, $3, $4)`,
      [userId, today, minutesEarned, weekStart]
    );
    return { currentStreak: 1, longestStreak: 1 };
  }

  let nextStreak = Number(existing.current_streak || 0);
  if (existing.last_activity_date === today) {
    nextStreak = Math.max(1, nextStreak);
  } else if (existing.last_activity_date === yesterday) {
    nextStreak += 1;
  } else {
    nextStreak = 1;
  }

  const nextLongest = Math.max(Number(existing.longest_streak || 0), nextStreak);
  const isSameWeek = existing.week_start_date === weekStart;
  const nextWeeklyMins = (isSameWeek ? Number(existing.weekly_minutes_done || 0) : 0) + minutesEarned;

  await query(
    `UPDATE learning_streaks SET
      current_streak = $1,
      longest_streak = $2,
      last_activity_date = $3,
      weekly_minutes_done = $4,
      week_start_date = $5,
      updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $6`,
    [nextStreak, nextLongest, today, nextWeeklyMins, weekStart, userId]
  );

  return { currentStreak: nextStreak, longestStreak: nextLongest };
}

export async function evaluateAchievements(userId) {
  const unlocked = [];
  const allAchievements = (await query('SELECT * FROM achievements')).rows;
  const alreadyRes = await query('SELECT achievement_id FROM student_achievements WHERE user_id = $1', [userId]);
  const ownedSet = new Set(alreadyRes.rows.map((r) => r.achievement_id));

  const lessonsRow = await queryOne(
    'SELECT COUNT(*) AS cnt FROM lesson_progress WHERE user_id = $1 AND is_completed = $2',
    [userId, true]
  );
  const modulesRow = await queryOne(
    "SELECT COUNT(*) AS cnt FROM student_points WHERE user_id = $1 AND event_type = 'MODULE'",
    [userId]
  );
  const quizzesRow = await queryOne(
    'SELECT COUNT(*) AS cnt FROM quiz_attempts WHERE user_id = $1 AND passed = $2',
    [userId, true]
  );
  const coursesRow = await queryOne(
    "SELECT COUNT(*) AS cnt FROM enrollments WHERE user_id = $1 AND status = 'COMPLETED'",
    [userId]
  );
  const streakRow = await queryOne('SELECT current_streak, longest_streak FROM learning_streaks WHERE user_id = $1', [userId]);
  const roadmapRow = await queryOne(
    "SELECT COUNT(*) AS cnt FROM student_points WHERE user_id = $1 AND event_type = 'ROADMAP_STEP'",
    [userId]
  );
  const discRow = await queryOne('SELECT COUNT(*) AS cnt FROM discussion_replies WHERE user_id = $1', [userId]);

  const metrics = {
    LESSONS_COMPLETED: Number(lessonsRow?.cnt || 0),
    MODULES_COMPLETED: Number(modulesRow?.cnt || 0),
    QUIZZES_PASSED: Number(quizzesRow?.cnt || 0),
    COURSES_COMPLETED: Number(coursesRow?.cnt || 0),
    STREAK_DAYS: Math.max(Number(streakRow?.current_streak || 0), Number(streakRow?.longest_streak || 0)),
    ROADMAP_STEPS: Number(roadmapRow?.cnt || 0),
    COMMUNITY_POSTS: Number(discRow?.cnt || 0),
  };

  for (const ach of allAchievements) {
    if (ownedSet.has(ach.id)) continue;
    const currentVal = metrics[ach.criteria_type] || 0;
    if (currentVal >= Number(ach.criteria_value || 1)) {
      const ins = await queryOne(
        `INSERT INTO student_achievements (user_id, achievement_id)
         VALUES ($1, $2) ON CONFLICT (user_id, achievement_id) DO NOTHING RETURNING id`,
        [userId, ach.id]
      );
      if (ins) {
        unlocked.push(ach);
        await query(
          `INSERT INTO student_points (user_id, event_type, event_key, points, description)
           VALUES ($1, 'STREAK_BONUS', $2, $3, $4) ON CONFLICT (user_id, event_key) DO NOTHING`,
          [userId, `BADGE:${ach.code}`, ach.xp_reward, `Unlocked badge: ${ach.title}`]
        );
        await createNotification({
          userId,
          title: `Badge Unlocked: ${ach.title}`,
          message: `${ach.description} (+${ach.xp_reward} Bonus XP)`,
          type: 'SUCCESS',
          category: 'ANNOUNCEMENT',
          actionUrl: '/student',
        });
      }
    }
  }
  return unlocked;
}

export async function awardXp({ userId, eventType, eventKey, points, description, activityMinutes = 15 }) {
  const inserted = await queryOne(
    `INSERT INTO student_points (user_id, event_type, event_key, points, description)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, event_key) DO NOTHING
     RETURNING *`,
    [userId, eventType, eventKey, points, description]
  );

  await recordLearningActivity(userId, inserted ? activityMinutes : 5);
  const newBadges = await evaluateAchievements(userId);

  return {
    awarded: Boolean(inserted),
    pointsAdded: inserted ? points : 0,
    newBadges,
  };
}
