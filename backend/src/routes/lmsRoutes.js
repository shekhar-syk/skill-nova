import { Router } from 'express';
import { query, queryOne } from '../db/index.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { createNotification, logAudit } from '../services/auditService.js';
import { uploadBufferToMedia, uploadMiddleware } from '../services/cloudinaryService.js';
import { emailTemplates, sendTransactionalEmail } from '../services/emailService.js';
import { awardXp, XP_VALUES } from '../services/gamificationService.js';
import { generateCode } from '../utils/auth.js';

const router = Router();

function safeJson(val, fallback) {
  if (Array.isArray(val) || (typeof val === 'object' && val !== null)) return val;
  try {
    return JSON.parse(val || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Student Dashboard Summary (real data from PostgreSQL)
router.get('/student/dashboard', authenticate, async (req, res, next) => {
  try {
    const enrollmentsRes = await query(
      `SELECT e.*, c.title, c.slug, c.thumbnail_url, c.duration, c.live_session_info,
              cc.name AS category_name, u.full_name AS instructor_name
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN course_categories cc ON cc.id = c.category_id
       LEFT JOIN users u ON u.id = c.instructor_id
       WHERE e.user_id = $1
       ORDER BY e.enrolled_at DESC`,
      [req.user.id]
    );

    const assignmentsRes = await query(
      `SELECT a.*, c.title AS course_title, s.id AS submission_id, s.status AS submission_status,
              s.score, s.instructor_feedback, s.submitted_at
       FROM assignments a
       JOIN courses c ON c.id = a.course_id
       JOIN enrollments e ON e.course_id = a.course_id AND e.user_id = $1
       LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.user_id = $1
       ORDER BY a.id ASC`,
      [req.user.id]
    );

    const certificatesRes = await query(
      'SELECT * FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC',
      [req.user.id]
    );

    const quizAttemptsRes = await query(
      `SELECT qa.*, q.title AS quiz_title, c.title AS course_title
       FROM quiz_attempts qa
       JOIN quizzes q ON q.id = qa.quiz_id
       JOIN courses c ON c.id = qa.course_id
       WHERE qa.user_id = $1
       ORDER BY qa.attempted_at DESC`,
      [req.user.id]
    );

    const notificationsRes = await query(
      'SELECT * FROM user_notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 8',
      [req.user.id]
    );

    const enrollments = enrollmentsRes.rows;
    const avgCompletion = enrollments.length
      ? Math.round(enrollments.reduce((acc, r) => acc + Number(r.progress_percent || 0), 0) / enrollments.length)
      : 0;
    const totalHours = enrollments.reduce((acc, r) => acc + Number(r.learning_hours || 0), 0);
    const pendingAssignments = assignmentsRes.rows.filter((a) => !a.submission_id).length;

    res.json({
      success: true,
      summary: {
        enrolledCount: enrollments.length,
        avgCompletion,
        totalLearningHours: Number(totalHours.toFixed(1)),
        pendingAssignments,
        certificatesCount: certificatesRes.rows.length,
      },
      enrollments,
      assignments: assignmentsRes.rows,
      certificates: certificatesRes.rows,
      quizAttempts: quizAttemptsRes.rows.map((qa) => ({
        ...qa,
        skill_breakdown: safeJson(qa.skill_breakdown, {}),
      })),
      recentActivities: notificationsRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

// Student Analytics (100% DB-backed for Recharts)
router.get('/student/analytics', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const enrollments = (
      await query(
        `SELECT e.progress_percent, e.learning_hours, e.status, c.title, cc.name AS category_name
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         JOIN course_categories cc ON cc.id = c.category_id
         WHERE e.user_id = $1`,
        [userId]
      )
    ).rows;

    const pointsRows = (
      await query('SELECT event_type, points, created_at FROM student_points WHERE user_id = $1 ORDER BY created_at ASC', [
        userId,
      ])
    ).rows;

    const quizAttempts = (
      await query(
        `SELECT qa.percentage, qa.passed, qa.skill_breakdown, qa.attempted_at, q.title AS quiz_title
         FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
         WHERE qa.user_id = $1 ORDER BY qa.attempted_at ASC`,
        [userId]
      )
    ).rows;

    const assignments = (
      await query(
        `SELECT a.id, s.status, s.score
         FROM assignments a
         JOIN enrollments e ON e.course_id = a.course_id AND e.user_id = $1
         LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.user_id = $1`,
        [userId]
      )
    ).rows;

    const streak = await queryOne('SELECT * FROM learning_streaks WHERE user_id = $1', [userId]);
    const roadmaps = (
      await query(
        `SELECT cr.title, sr.progress_percent, sr.skill_assessment_score
         FROM student_roadmaps sr JOIN career_roadmaps cr ON cr.id = sr.roadmap_id
         WHERE sr.user_id = $1`,
        [userId]
      )
    ).rows;

    // Last 7 days XP & activity chart
    const dayLabels = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayXp = pointsRows
        .filter((p) => String(p.created_at).slice(0, 10) === iso)
        .reduce((sum, p) => sum + Number(p.points || 0), 0);
      dayLabels.push({ day: label, date: iso, xp: dayXp, minutes: Math.round(dayXp * 1.5) });
    }

    // Monthly XP & learning trend
    const monthBuckets = new Map();
    for (const p of pointsRows) {
      const ym = String(p.created_at).slice(0, 7);
      monthBuckets.set(ym, (monthBuckets.get(ym) || 0) + Number(p.points || 0));
    }
    const monthlyActivity = Array.from(monthBuckets.entries()).map(([month, xp]) => ({
      month,
      xp,
      hours: Number((xp / 25).toFixed(1)),
    }));

    // Skill-wise mastery aggregated from quiz_attempts.skill_breakdown
    const skillMap = new Map();
    for (const qa of quizAttempts) {
      const sb = safeJson(qa.skill_breakdown, {});
      for (const [skill, stats] of Object.entries(sb)) {
        const cur = skillMap.get(skill) || { correct: 0, total: 0 };
        cur.correct += Number(stats.correct || 0);
        cur.total += Number(stats.total || 0);
        skillMap.set(skill, cur);
      }
    }
    const skillMastery = Array.from(skillMap.entries()).map(([skill, s]) => ({
      skill,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      questionsAnswered: s.total,
    }));

    res.json({
      success: true,
      weeklyActivity: dayLabels,
      monthlyActivity,
      courseProgress: enrollments.map((e) => ({
        course: e.title.length > 24 ? `${e.title.slice(0, 22)}…` : e.title,
        progress: Number(e.progress_percent || 0),
        hours: Number(e.learning_hours || 0),
      })),
      quizTrend: quizAttempts.map((q) => ({
        quiz: q.quiz_title.length > 18 ? `${q.quiz_title.slice(0, 16)}…` : q.quiz_title,
        percentage: Number(q.percentage || 0),
      })),
      assignmentSummary: {
        total: assignments.length,
        reviewed: assignments.filter((a) => a.status === 'REVIEWED').length,
        submitted: assignments.filter((a) => a.status === 'SUBMITTED').length,
        pending: assignments.filter((a) => !a.status).length,
      },
      skillMastery,
      streak: streak || { current_streak: 0, longest_streak: 0, weekly_goal_minutes: 180, weekly_minutes_done: 0 },
      roadmaps,
    });
  } catch (err) {
    next(err);
  }
});

// Enrollments list
router.get('/enrollments/my', authenticate, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT e.*, c.title, c.slug, c.thumbnail_url, c.duration, c.skill_level, cc.name AS category_name
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN course_categories cc ON cc.id = c.category_id
       WHERE e.user_id = $1
       ORDER BY e.id DESC`,
      [req.user.id]
    );
    res.json({ success: true, enrollments: rows.rows });
  } catch (err) {
    next(err);
  }
});

// 1-Click Free Enrollment for zero-fee foundational courses
router.post('/enrollments/free', authenticate, async (req, res, next) => {
  try {
    const courseId = Number(req.body?.courseId);
    if (!courseId) {
      return res.status(400).json({ success: false, message: 'Course ID is required.' });
    }
    const course = await queryOne(
      "SELECT id, title, course_fee, status FROM courses WHERE id = $1 AND status = 'PUBLISHED'",
      [courseId]
    );
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found or unavailable.' });
    }
    if (Number(course.course_fee) !== 0) {
      return res.status(400).json({
        success: false,
        message: 'This program requires paid admission checkout.',
      });
    }

    const existing = await queryOne(
      'SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    );
    if (existing) {
      return res.json({ success: true, enrollment: existing, alreadyEnrolled: true });
    }

    const enrollment = await queryOne(
      `INSERT INTO enrollments (user_id, course_id, status, progress_percent, learning_hours)
       VALUES ($1, $2, 'ACTIVE', 0, 0) RETURNING *`,
      [req.user.id, courseId]
    );

    await query('UPDATE courses SET enrolled_count = enrolled_count + 1 WHERE id = $1', [courseId]);

    await createNotification({
      userId: req.user.id,
      title: `Enrolled: ${course.title}`,
      message: 'Your free foundational course workspace is unlocked. Start learning anytime!',
      type: 'SUCCESS',
      category: 'ANNOUNCEMENT',
      actionUrl: `/student/course/${courseId}`,
    });

    res.status(201).json({ success: true, enrollment, alreadyEnrolled: false });
  } catch (err) {
    next(err);
  }
});

// Course Player: Full Modules, Lessons, Completion state, Quizzes (with randomization), Assignments
router.get('/learning/courses/:courseId', authenticate, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const isStaff = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'].includes(req.user.role);
    const enrollment = await queryOne(
      'SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    );

    if (!enrollment && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'You must complete admission enrollment to access this course workspace.',
      });
    }

    const course = await queryOne(
      `SELECT c.*, cc.name AS category_name, u.full_name AS instructor_name
       FROM courses c
       JOIN course_categories cc ON cc.id = c.category_id
       LEFT JOIN users u ON u.id = c.instructor_id
       WHERE c.id = $1`,
      [courseId]
    );
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

    const modulesRes = await query(
      'SELECT * FROM course_modules WHERE course_id = $1 ORDER BY module_order ASC, id ASC',
      [courseId]
    );
    const lessonsRes = await query(
      'SELECT * FROM lessons WHERE course_id = $1 ORDER BY lesson_order ASC, id ASC',
      [courseId]
    );
    const progressRes = await query(
      'SELECT lesson_id FROM lesson_progress WHERE user_id = $1 AND course_id = $2 AND is_completed = $3',
      [req.user.id, courseId, true]
    );
    const completedSet = new Set(progressRes.rows.map((p) => p.lesson_id));

    const quizzesRes = await query('SELECT * FROM quizzes WHERE course_id = $1 ORDER BY id ASC', [courseId]);
    const quizzes = [];
    for (const q of quizzesRes.rows) {
      const qQuestions = await query(
        `SELECT id, question_text, question_type, options, difficulty, skill_tag, marks, question_order
         FROM questions WHERE quiz_id = $1 ORDER BY question_order ASC`,
        [q.id]
      );
      const formattedQuestions = qQuestions.rows.map((item) => ({
        id: item.id,
        questionText: item.question_text,
        questionType: item.question_type || 'MCQ',
        options: safeJson(item.options, []),
        difficulty: item.difficulty || 'Medium',
        skillTag: item.skill_tag || 'Core Engineering',
        marks: Number(item.marks || 1),
        questionOrder: item.question_order,
      }));
      const finalQuestions = q.randomize_questions ? shuffleArray(formattedQuestions) : formattedQuestions;

      const attempts = await query(
        'SELECT * FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 ORDER BY attempted_at DESC',
        [q.id, req.user.id]
      );
      quizzes.push({
        id: q.id,
        title: q.title,
        description: q.description,
        passingScore: q.passing_score,
        timeLimitMinutes: q.time_limit_minutes,
        randomizeQuestions: Boolean(q.randomize_questions),
        allowNegativeMarking: Boolean(q.allow_negative_marking),
        negativeMarksPerWrong: Number(q.negative_marks_per_wrong || 0.25),
        questions: finalQuestions,
        attempts: attempts.rows.map((a) => ({
          ...a,
          skill_breakdown: safeJson(a.skill_breakdown, {}),
        })),
      });
    }

    const assignmentsRes = await query(
      `SELECT a.*, s.id AS submission_id, s.submission_url, s.submission_notes, s.file_name,
              s.status AS submission_status, s.score, s.instructor_feedback, s.submitted_at
       FROM assignments a
       LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.user_id = $1
       WHERE a.course_id = $2
       ORDER BY a.id ASC`,
      [req.user.id, courseId]
    );

    const certificate = await queryOne(
      'SELECT * FROM certificates WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
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
          videoUrl: l.video_url,
          content: l.content,
          resourceUrl: l.resource_url,
          durationMinutes: l.duration_minutes,
          lessonOrder: l.lesson_order,
          completed: completedSet.has(l.id),
        })),
    }));

    res.json({
      success: true,
      course,
      enrollment,
      modules,
      quizzes,
      assignments: assignmentsRes.rows,
      certificate,
    });
  } catch (err) {
    next(err);
  }
});

// Toggle lesson completion, persist progress, and award non-duplicate Gamification XP
router.post('/progress/toggle', authenticate, async (req, res, next) => {
  try {
    const { courseId, lessonId, completed = true } = req.body;
    const cId = Number(courseId);
    const lId = Number(lessonId);

    const isStaff = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'].includes(req.user.role);
    const enrollment = await queryOne('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [
      req.user.id,
      cId,
    ]);
    if (!enrollment && !isStaff) {
      return res.status(403).json({ success: false, message: 'Enrollment required to track progress.' });
    }

    const lessonRow = await queryOne('SELECT id, module_id, title, duration_minutes FROM lessons WHERE id = $1 AND course_id = $2', [
      lId,
      cId,
    ]);
    if (!lessonRow) return res.status(404).json({ success: false, message: 'Lesson not found in this course.' });

    if (completed) {
      await query(
        `INSERT INTO lesson_progress (user_id, course_id, lesson_id, is_completed)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, lesson_id) DO UPDATE SET is_completed = $4, completed_at = CURRENT_TIMESTAMP`,
        [req.user.id, cId, lId, true]
      );
    } else {
      await query('DELETE FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2', [req.user.id, lId]);
    }

    const totalLessonsRow = await queryOne('SELECT COUNT(*) AS cnt FROM lessons WHERE course_id = $1', [cId]);
    const doneRow = await queryOne(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(l.duration_minutes), 0) AS mins
       FROM lesson_progress lp
       JOIN lessons l ON l.id = lp.lesson_id
       WHERE lp.user_id = $1 AND lp.course_id = $2 AND lp.is_completed = $3`,
      [req.user.id, cId, true]
    );

    const total = Math.max(1, Number(totalLessonsRow?.cnt || 1));
    const done = Number(doneRow?.cnt || 0);
    const progressPercent = Math.min(100, Math.round((done / total) * 100));
    const learningHours = Number((Number(doneRow?.mins || 0) / 60).toFixed(1));
    const status = progressPercent === 100 ? 'COMPLETED' : 'ACTIVE';

    await query(
      `UPDATE enrollments SET
        progress_percent = $1,
        learning_hours = $2,
        status = $3,
        completed_at = ${progressPercent === 100 ? 'CURRENT_TIMESTAMP' : 'NULL'}
       WHERE user_id = $4 AND course_id = $5`,
      [progressPercent, learningHours, status, req.user.id, cId]
    );

    let xpEarned = 0;
    const unlockedBadges = [];

    if (completed) {
      const lesXp = await awardXp({
        userId: req.user.id,
        eventType: 'LESSON',
        eventKey: `LESSON:${lId}`,
        points: XP_VALUES.LESSON,
        description: `Completed lesson: ${lessonRow.title}`,
        activityMinutes: Math.min(60, Number(lessonRow.duration_minutes || 20)),
      });
      xpEarned += lesXp.pointsAdded;
      unlockedBadges.push(...lesXp.newBadges);

      // Check if all lessons in this module are completed -> +50 XP
      const modTotalRow = await queryOne('SELECT COUNT(*) AS cnt FROM lessons WHERE module_id = $1', [lessonRow.module_id]);
      const modDoneRow = await queryOne(
        `SELECT COUNT(*) AS cnt FROM lesson_progress lp
         JOIN lessons l ON l.id = lp.lesson_id
         WHERE lp.user_id = $1 AND l.module_id = $2 AND lp.is_completed = $3`,
        [req.user.id, lessonRow.module_id, true]
      );
      if (Number(modTotalRow?.cnt || 0) > 0 && Number(modDoneRow?.cnt || 0) >= Number(modTotalRow.cnt)) {
        const modRow = await queryOne('SELECT title FROM course_modules WHERE id = $1', [lessonRow.module_id]);
        const modXp = await awardXp({
          userId: req.user.id,
          eventType: 'MODULE',
          eventKey: `MODULE:${lessonRow.module_id}`,
          points: XP_VALUES.MODULE,
          description: `Completed module: ${modRow?.title || lessonRow.module_id}`,
          activityMinutes: 25,
        });
        xpEarned += modXp.pointsAdded;
        unlockedBadges.push(...modXp.newBadges);
      }

      // Check if full course is 100% completed -> +200 XP
      if (progressPercent === 100) {
        const crsRow = await queryOne('SELECT title FROM courses WHERE id = $1', [cId]);
        const crsXp = await awardXp({
          userId: req.user.id,
          eventType: 'COURSE_COMPLETE',
          eventKey: `COURSE:${cId}`,
          points: XP_VALUES.COURSE_COMPLETE,
          description: `Completed 100% of course: ${crsRow?.title || cId}`,
          activityMinutes: 45,
        });
        xpEarned += crsXp.pointsAdded;
        unlockedBadges.push(...crsXp.newBadges);
      }
    }

    res.json({
      success: true,
      progressPercent,
      learningHours,
      completedLessons: done,
      totalLessons: total,
      xpEarned,
      unlockedBadges,
    });
  } catch (err) {
    next(err);
  }
});

// Submit Quiz with multi-type grading, negative marking, skill-wise analysis & Gamification XP
router.post('/quizzes/:quizId/submit', authenticate, async (req, res, next) => {
  try {
    const quizId = Number(req.params.quizId);
    const { answers = {}, timeTakenSeconds = 0 } = req.body;

    const quiz = await queryOne('SELECT * FROM quizzes WHERE id = $1', [quizId]);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });

    const isStaff = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'].includes(req.user.role);
    const enrollment = await queryOne('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [
      req.user.id,
      quiz.course_id,
    ]);
    if (!enrollment && !isStaff) {
      return res.status(403).json({ success: false, message: 'Enroll in this course to submit its assessments.' });
    }

    const questionsRes = await query('SELECT * FROM questions WHERE quiz_id = $1 ORDER BY question_order ASC', [quizId]);
    const questions = questionsRes.rows;
    if (!questions.length) return res.status(400).json({ success: false, message: 'Quiz has no questions.' });

    let correctCount = 0;
    let earnedMarks = 0;
    let totalMaxMarks = 0;
    let negativeDeducted = 0;
    const skillStats = {};

    const breakdown = questions.map((q) => {
      const qType = q.question_type || 'MCQ';
      const qMarks = Number(q.marks || 1);
      totalMaxMarks += qMarks;
      const skill = q.skill_tag || 'Core Engineering';
      if (!skillStats[skill]) skillStats[skill] = { correct: 0, total: 0 };
      skillStats[skill].total += 1;

      const selected = answers[String(q.id)] ?? answers[q.id];
      const hasAttempt = selected !== undefined && selected !== null && selected !== '' && (!Array.isArray(selected) || selected.length > 0);
      let isCorrect = false;
      let expectedDisplay = q.correct_option_index;

      if (qType === 'MULTI_SELECT') {
        const expectedArr = safeJson(q.correct_answers, [q.correct_option_index]).map(Number).sort((a, b) => a - b);
        const givenArr = (Array.isArray(selected) ? selected : []).map(Number).sort((a, b) => a - b);
        expectedDisplay = expectedArr;
        isCorrect =
          expectedArr.length > 0 &&
          expectedArr.length === givenArr.length &&
          expectedArr.every((v, idx) => v === givenArr[idx]);
      } else if (qType === 'SHORT_ANSWER') {
        const accepted = safeJson(q.correct_answers, []).map((s) => String(s).trim().toLowerCase());
        expectedDisplay = accepted;
        const givenStr = String(selected || '').trim().toLowerCase();
        isCorrect = Boolean(givenStr) && accepted.some((ans) => givenStr === ans || givenStr.includes(ans));
      } else {
        isCorrect = hasAttempt && Number(selected) === Number(q.correct_option_index);
      }

      if (isCorrect) {
        correctCount += 1;
        earnedMarks += qMarks;
        skillStats[skill].correct += 1;
      } else if (hasAttempt && quiz.allow_negative_marking) {
        const penalty = Number(quiz.negative_marks_per_wrong || 0.25) * qMarks;
        negativeDeducted += penalty;
        earnedMarks -= penalty;
      }

      return {
        questionId: q.id,
        questionType: qType,
        skillTag: skill,
        difficulty: q.difficulty || 'Medium',
        selectedOption: selected ?? null,
        correctOption: expectedDisplay,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const netMarks = Math.max(0, Number(earnedMarks.toFixed(2)));
    const percentage = totalMaxMarks > 0 ? Math.max(0, Math.min(100, Math.round((netMarks / totalMaxMarks) * 100))) : 0;
    const passed = percentage >= quiz.passing_score;

    const skillBreakdown = {};
    for (const [k, v] of Object.entries(skillStats)) {
      skillBreakdown[k] = {
        correct: v.correct,
        total: v.total,
        percentage: v.total ? Math.round((v.correct / v.total) * 100) : 0,
      };
    }

    const attempt = await queryOne(
      `INSERT INTO quiz_attempts (
        quiz_id, user_id, course_id, answers, score, raw_score, negative_deducted,
        total_questions, percentage, passed, skill_breakdown, time_taken_seconds
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        quizId,
        req.user.id,
        quiz.course_id,
        JSON.stringify(answers),
        correctCount,
        netMarks,
        Number(negativeDeducted.toFixed(2)),
        questions.length,
        percentage,
        passed,
        JSON.stringify(skillBreakdown),
        Number(timeTakenSeconds) || 0,
      ]
    );

    let xpEarned = 0;
    if (passed) {
      const xpRes = await awardXp({
        userId: req.user.id,
        eventType: 'QUIZ_PASS',
        eventKey: `QUIZ:${quizId}`,
        points: XP_VALUES.QUIZ_PASS,
        description: `Passed assessment: ${quiz.title} (${percentage}%)`,
        activityMinutes: 20,
      });
      xpEarned = xpRes.pointsAdded;
    }

    await createNotification({
      userId: req.user.id,
      title: `Quiz Result: ${quiz.title}`,
      message: `You scored ${percentage}% (${correctCount}/${questions.length}). ${passed ? 'Passed!' : 'Review breakdown and retry.'}`,
      type: passed ? 'SUCCESS' : 'INFO',
      category: 'QUIZ',
      actionUrl: `/student/course/${quiz.course_id}`,
    });

    res.json({
      success: true,
      attempt: { ...attempt, skill_breakdown: skillBreakdown },
      breakdown,
      xpEarned,
    });
  } catch (err) {
    next(err);
  }
});

// Instructor / Admin: Create Quiz with Advanced Options & Multiple Questions
router.post('/quizzes', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const {
      courseId,
      title,
      description = '',
      passingScore = 60,
      timeLimitMinutes = 15,
      randomizeQuestions = false,
      allowNegativeMarking = false,
      negativeMarksPerWrong = 0.25,
      questions = [],
    } = req.body;

    if (!courseId || !title || !questions.length) {
      return res.status(400).json({ success: false, message: 'Course, title, and at least one question are required.' });
    }

    if (req.user.role === 'INSTRUCTOR') {
      const c = await queryOne('SELECT instructor_id FROM courses WHERE id = $1', [Number(courseId)]);
      if (!c || c.instructor_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You can only create quizzes for courses assigned to you.' });
      }
    }

    const quiz = await queryOne(
      `INSERT INTO quizzes (
        course_id, title, description, passing_score, time_limit_minutes,
        randomize_questions, allow_negative_marking, negative_marks_per_wrong
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        Number(courseId),
        title.trim(),
        description.trim(),
        Number(passingScore),
        Number(timeLimitMinutes),
        Boolean(randomizeQuestions),
        Boolean(allowNegativeMarking),
        Number(negativeMarksPerWrong) || 0.25,
      ]
    );

    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      const qType = q.questionType || 'MCQ';
      const opts = qType === 'TRUE_FALSE' ? ['True', 'False'] : qType === 'SHORT_ANSWER' ? [] : (q.options || []);
      const corrIdx = Number(q.correctOptionIndex || 0);
      const corrAns = q.correctAnswers ? q.correctAnswers : [corrIdx];

      await query(
        `INSERT INTO questions (
          quiz_id, question_text, question_type, options, correct_option_index,
          correct_answers, difficulty, skill_tag, marks, explanation, question_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          quiz.id,
          q.questionText,
          qType,
          JSON.stringify(opts),
          corrIdx,
          JSON.stringify(corrAns),
          q.difficulty || 'Medium',
          q.skillTag || 'Core Engineering',
          Number(q.marks || 1),
          q.explanation || '',
          i + 1,
        ]
      );
    }

    res.status(201).json({ success: true, quiz });
  } catch (err) {
    next(err);
  }
});

// Question Bank CRUD (Instructor / Admin)
router.get('/question-bank', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const { courseId = '', difficulty = '', questionType = '' } = req.query;
    const conditions = [];
    const params = [];
    if (courseId) {
      params.push(Number(courseId));
      conditions.push(`qb.course_id = $${params.length}`);
    }
    if (difficulty) {
      params.push(difficulty);
      conditions.push(`qb.difficulty = $${params.length}`);
    }
    if (questionType) {
      params.push(questionType);
      conditions.push(`qb.question_type = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = (
      await query(
        `SELECT qb.*, c.title AS course_title FROM question_bank qb
         LEFT JOIN courses c ON c.id = qb.course_id
         ${where} ORDER BY qb.id DESC`,
        params
      )
    ).rows;

    res.json({
      success: true,
      questions: rows.map((r) => ({
        ...r,
        options: safeJson(r.options, []),
        correct_answers: safeJson(r.correct_answers, []),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/question-bank', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const {
      courseId = null,
      questionText,
      questionType = 'MCQ',
      options = [],
      correctOptionIndex = 0,
      correctAnswers = [],
      difficulty = 'Medium',
      skillTag = 'Core Engineering',
      marks = 1,
      explanation = '',
    } = req.body;
    if (!questionText?.trim()) {
      return res.status(400).json({ success: false, message: 'Question text is required.' });
    }
    const opts = questionType === 'TRUE_FALSE' ? ['True', 'False'] : options;
    const corrAns = correctAnswers.length ? correctAnswers : [Number(correctOptionIndex)];
    const created = await queryOne(
      `INSERT INTO question_bank (
        course_id, created_by, question_text, question_type, options,
        correct_option_index, correct_answers, difficulty, skill_tag, marks, explanation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        courseId ? Number(courseId) : null,
        req.user.id,
        questionText.trim(),
        questionType,
        JSON.stringify(opts),
        Number(correctOptionIndex || 0),
        JSON.stringify(corrAns),
        difficulty,
        skillTag.trim(),
        Number(marks) || 1,
        explanation,
      ]
    );
    res.status(201).json({ success: true, question: created });
  } catch (err) {
    next(err);
  }
});

router.delete('/question-bank/:id', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    await query('DELETE FROM question_bank WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/quizzes/:quizId/import-bank', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const quizId = Number(req.params.quizId);
    const { questionIds = [] } = req.body;
    if (!questionIds.length) return res.status(400).json({ success: false, message: 'Select at least one question.' });

    const maxOrdRow = await queryOne('SELECT COALESCE(MAX(question_order), 0) AS m FROM questions WHERE quiz_id = $1', [quizId]);
    let order = Number(maxOrdRow?.m || 0);
    let imported = 0;

    for (const qbId of questionIds) {
      const qb = await queryOne('SELECT * FROM question_bank WHERE id = $1', [Number(qbId)]);
      if (!qb) continue;
      order += 1;
      await query(
        `INSERT INTO questions (
          quiz_id, question_text, question_type, options, correct_option_index,
          correct_answers, difficulty, skill_tag, marks, explanation, question_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          quizId,
          qb.question_text,
          qb.question_type,
          qb.options,
          qb.correct_option_index,
          qb.correct_answers,
          qb.difficulty,
          qb.skill_tag,
          qb.marks,
          qb.explanation,
          order,
        ]
      );
      imported += 1;
    }

    res.json({ success: true, imported });
  } catch (err) {
    next(err);
  }
});

// Student: Submit Assignment (ownership checked + file upload + URL/notes)
router.post(
  '/assignments/:assignmentId/submit',
  authenticate,
  uploadMiddleware.single('file'),
  async (req, res, next) => {
    try {
      const assignmentId = Number(req.params.assignmentId);
      const assignment = await queryOne('SELECT * FROM assignments WHERE id = $1', [assignmentId]);
      if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

      const isStaff = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'].includes(req.user.role);
      const enrollment = await queryOne('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [
        req.user.id,
        assignment.course_id,
      ]);
      if (!enrollment && !isStaff) {
        return res.status(403).json({ success: false, message: 'Enroll in this course to submit assignments.' });
      }

      let submissionUrl = req.body.submissionUrl || null;
      let fileName = null;

      if (req.file) {
        const uploaded = await uploadBufferToMedia(req.file, 'skillnova/assignments');
        submissionUrl = uploaded.url;
        fileName = uploaded.originalName;
      }

      const submissionNotes = req.body.submissionNotes || '';
      if (!submissionUrl && !submissionNotes.trim()) {
        return res.status(400).json({ success: false, message: 'Provide a file attachment, link, or notes.' });
      }

      const existing = await queryOne(
        'SELECT id FROM assignment_submissions WHERE assignment_id = $1 AND user_id = $2',
        [assignmentId, req.user.id]
      );

      let submission;
      if (existing) {
        submission = await queryOne(
          `UPDATE assignment_submissions SET
            submission_url = $1,
            submission_notes = $2,
            file_name = COALESCE($3, file_name),
            status = 'SUBMITTED',
            submitted_at = CURRENT_TIMESTAMP
           WHERE id = $4 RETURNING *`,
          [submissionUrl, submissionNotes, fileName, existing.id]
        );
      } else {
        submission = await queryOne(
          `INSERT INTO assignment_submissions (assignment_id, user_id, submission_url, submission_notes, file_name, status)
           VALUES ($1, $2, $3, $4, $5, 'SUBMITTED') RETURNING *`,
          [assignmentId, req.user.id, submissionUrl, submissionNotes, fileName]
        );
      }

      const mail = emailTemplates.assignmentSubmitted({
        fullName: req.user.fullName,
        assignmentTitle: assignment.title,
      });
      await sendTransactionalEmail({ to: req.user.email, ...mail });

      res.status(201).json({ success: true, submission });
    } catch (err) {
      next(err);
    }
  }
);

// Instructor / Admin: Create Assignment
router.post('/assignments', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
  try {
    const { courseId, title, description, dueDate, maxScore = 100 } = req.body;
    if (!courseId || !title || !description || !dueDate) {
      return res.status(400).json({ success: false, message: 'All assignment fields are required.' });
    }
    if (req.user.role === 'INSTRUCTOR') {
      const c = await queryOne('SELECT instructor_id FROM courses WHERE id = $1', [Number(courseId)]);
      if (!c || c.instructor_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You can only create assignments for courses assigned to you.' });
      }
    }
    const created = await queryOne(
      `INSERT INTO assignments (course_id, title, description, due_date, max_score)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [Number(courseId), title.trim(), description.trim(), dueDate, Number(maxScore)]
    );
    res.status(201).json({ success: true, assignment: created });
  } catch (err) {
    next(err);
  }
});

// Instructor / Admin: Review Assignment Submission (ownership verified)
router.patch(
  '/assignments/submissions/:submissionId/review',
  authenticate,
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'),
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.submissionId);
      const existing = await queryOne(
        `SELECT s.id, c.instructor_id
         FROM assignment_submissions s
         JOIN assignments a ON a.id = s.assignment_id
         JOIN courses c ON c.id = a.course_id
         WHERE s.id = $1`,
        [submissionId]
      );
      if (!existing) return res.status(404).json({ success: false, message: 'Submission not found.' });
      if (req.user.role === 'INSTRUCTOR' && existing.instructor_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You can only review submissions for your assigned courses.' });
      }

      const { score, status = 'REVIEWED', instructorFeedback = '' } = req.body;
      const updated = await queryOne(
        `UPDATE assignment_submissions SET
          score = $1,
          status = $2,
          instructor_feedback = $3,
          reviewed_by = $4,
          reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $5 RETURNING *`,
        [Number(score), status, instructorFeedback, req.user.id, submissionId]
      );

      await createNotification({
        userId: updated.user_id,
        title: 'Assignment Reviewed',
        message: `Your assignment received a score of ${updated.score}/100.`,
        type: 'INFO',
        category: 'FEEDBACK',
        actionUrl: '/student',
      });

      res.json({ success: true, submission: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Generate Certificate when course completion is 100%
router.post('/certificates/generate', authenticate, async (req, res, next) => {
  try {
    const courseId = Number(req.body.courseId);
    const enrollment = await queryOne(
      'SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    );
    if (!enrollment) {
      return res.status(403).json({ success: false, message: 'Not enrolled in this course.' });
    }
    if (enrollment.progress_percent < 100) {
      return res.status(400).json({
        success: false,
        message: `Complete all course lessons first (${enrollment.progress_percent}% completed).`,
      });
    }

    const existing = await queryOne(
      'SELECT * FROM certificates WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    );
    if (existing) {
      return res.json({ success: true, certificate: existing });
    }

    const course = await queryOne('SELECT title FROM courses WHERE id = $1', [courseId]);
    const code = generateCode('SN-CERT');
    const cert = await queryOne(
      `INSERT INTO certificates (certificate_code, user_id, course_id, student_name, course_title, grade)
       VALUES ($1, $2, $3, $4, $5, 'Distinction') RETURNING *`,
      [code, req.user.id, courseId, req.user.fullName, course.title]
    );

    await createNotification({
      userId: req.user.id,
      title: `Certificate Issued: ${course.title}`,
      message: `Verification Code: ${code}`,
      type: 'SUCCESS',
      category: 'ANNOUNCEMENT',
      actionUrl: '/student',
    });

    await logAudit({
      actorUserId: req.user.id,
      action: 'CERTIFICATE_ISSUED',
      entityType: 'CERTIFICATE',
      entityId: cert.id,
      details: { certificateCode: code },
      ipAddress: req.ip,
    });

    const mail = emailTemplates.certificateIssued({
      fullName: req.user.fullName,
      courseTitle: course.title,
      certificateCode: code,
    });
    await sendTransactionalEmail({ to: req.user.email, ...mail });

    res.status(201).json({ success: true, certificate: cert });
  } catch (err) {
    next(err);
  }
});

// List student's certificates
router.get('/certificates/my', authenticate, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC', [req.user.id]);
    res.json({ success: true, certificates: rows.rows });
  } catch (err) {
    next(err);
  }
});

// Public Certificate Verification
router.get('/certificates/verify/:code', async (req, res, next) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const cert = await queryOne(
      `SELECT cert.*, c.duration, c.skill_level, cc.name AS category_name
       FROM certificates cert
       JOIN courses c ON c.id = cert.course_id
       JOIN course_categories cc ON cc.id = c.category_id
       WHERE UPPER(cert.certificate_code) = $1`,
      [code]
    );
    if (!cert) {
      return res.status(404).json({ success: false, valid: false, message: 'No certificate found with that ID.' });
    }
    res.json({ success: true, valid: true, certificate: cert });
  } catch (err) {
    next(err);
  }
});

export default router;
