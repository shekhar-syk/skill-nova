import { Router } from 'express';
import { query, queryOne } from '../db/index.js';
import { authenticate, authorizeRoles, optionalAuth } from '../middleware/authMiddleware.js';
import { awardXp, XP_VALUES } from '../services/gamificationService.js';

const router = Router();

function safeJson(val, fallback) {
  if (Array.isArray(val) || (typeof val === 'object' && val !== null)) return val;
  try {
    return JSON.parse(val || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

// List all published career roadmaps (with user's progress if authenticated)
router.get('/roadmaps', optionalAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user && ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
    const roadmaps = (
      await query(
        `SELECT r.*, (SELECT COUNT(*) FROM roadmap_steps s WHERE s.roadmap_id = r.id) AS steps_count
         FROM career_roadmaps r
         ${isAdmin ? '' : 'WHERE r.is_published = $1'}
         ORDER BY r.id ASC`,
        isAdmin ? [] : [true]
      )
    ).rows;

    let studentMap = new Map();
    if (req.user) {
      const sr = (await query('SELECT * FROM student_roadmaps WHERE user_id = $1', [req.user.id])).rows;
      studentMap = new Map(sr.map((row) => [row.roadmap_id, row]));
    }

    res.json({
      success: true,
      roadmaps: roadmaps.map((r) => {
        const sr = studentMap.get(r.id);
        return {
          id: r.id,
          title: r.title,
          slug: r.slug,
          roleSummary: r.role_summary,
          description: r.description,
          difficulty: r.difficulty,
          estimatedWeeks: r.estimated_weeks,
          skillCategories: safeJson(r.skill_categories, []),
          practicalProjects: safeJson(r.practical_projects, []),
          interviewPrep: safeJson(r.interview_prep, []),
          stepsCount: Number(r.steps_count || 0),
          isPublished: Boolean(r.is_published),
          studentProgress: sr
            ? {
                completedStepIds: safeJson(sr.completed_step_ids, []),
                progressPercent: sr.progress_percent,
                skillAssessmentScore: sr.skill_assessment_score,
                skillAssessmentResult: sr.skill_assessment_result,
                isPrimary: Boolean(sr.is_primary),
              }
            : null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// Get single roadmap detail with ordered steps & recommended courses
router.get('/roadmaps/:slugOrId', optionalAuth, async (req, res, next) => {
  try {
    const key = req.params.slugOrId;
    const isNum = /^\d+$/.test(key);
    const r = await queryOne(
      `SELECT * FROM career_roadmaps WHERE ${isNum ? 'id = $1' : 'slug = $1'}`,
      [isNum ? Number(key) : key]
    );
    if (!r) return res.status(404).json({ success: false, message: 'Career roadmap not found.' });

    const steps = (
      await query(
        `SELECT s.*, c.title AS course_title, c.slug AS course_slug, c.duration AS course_duration, c.skill_level AS course_level
         FROM roadmap_steps s
         LEFT JOIN courses c ON c.id = s.recommended_course_id
         WHERE s.roadmap_id = $1
         ORDER BY s.step_order ASC, s.id ASC`,
        [r.id]
      )
    ).rows;

    let studentProgress = null;
    if (req.user) {
      const sr = await queryOne('SELECT * FROM student_roadmaps WHERE user_id = $1 AND roadmap_id = $2', [
        req.user.id,
        r.id,
      ]);
      if (sr) {
        studentProgress = {
          completedStepIds: safeJson(sr.completed_step_ids, []),
          progressPercent: sr.progress_percent,
          skillAssessmentScore: sr.skill_assessment_score,
          skillAssessmentResult: sr.skill_assessment_result,
          isPrimary: Boolean(sr.is_primary),
        };
      }
    }

    const rawQuestions = safeJson(r.assessment_questions, []);
    res.json({
      success: true,
      roadmap: {
        id: r.id,
        title: r.title,
        slug: r.slug,
        roleSummary: r.role_summary,
        description: r.description,
        difficulty: r.difficulty,
        estimatedWeeks: r.estimated_weeks,
        skillCategories: safeJson(r.skill_categories, []),
        practicalProjects: safeJson(r.practical_projects, []),
        interviewPrep: safeJson(r.interview_prep, []),
        assessmentQuestions: rawQuestions.map((q, idx) => ({
          index: idx,
          question: q.question,
          options: q.options,
        })),
        steps: steps.map((s) => ({
          id: s.id,
          stepOrder: s.step_order,
          skillCategory: s.skill_category,
          title: s.title,
          description: s.description,
          estimatedHours: s.estimated_hours,
          projectTask: s.project_task,
          recommendedCourse: s.recommended_course_id
            ? {
                id: s.recommended_course_id,
                title: s.course_title,
                slug: s.course_slug,
                duration: s.course_duration,
                skillLevel: s.course_level,
              }
            : null,
        })),
        studentProgress,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Select roadmap as career goal
router.post('/roadmaps/:id/select', authenticate, async (req, res, next) => {
  try {
    const roadmapId = Number(req.params.id);
    const roadmap = await queryOne('SELECT id, title FROM career_roadmaps WHERE id = $1', [roadmapId]);
    if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found.' });

    await query('UPDATE student_roadmaps SET is_primary = $1 WHERE user_id = $2', [false, req.user.id]);
    await query(
      `INSERT INTO student_roadmaps (user_id, roadmap_id, completed_step_ids, progress_percent, is_primary)
       VALUES ($1, $2, '[]', 0, $3)
       ON CONFLICT (user_id, roadmap_id) DO UPDATE SET is_primary = $3, updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, roadmapId, true]
    );

    res.json({ success: true, message: `${roadmap.title} set as your active career roadmap.` });
  } catch (err) {
    next(err);
  }
});

// Toggle roadmap step completion & award XP once
router.post('/roadmaps/steps/:stepId/toggle', authenticate, async (req, res, next) => {
  try {
    const stepId = Number(req.params.stepId);
    const step = await queryOne('SELECT * FROM roadmap_steps WHERE id = $1', [stepId]);
    if (!step) return res.status(404).json({ success: false, message: 'Roadmap step not found.' });

    let sr = await queryOne('SELECT * FROM student_roadmaps WHERE user_id = $1 AND roadmap_id = $2', [
      req.user.id,
      step.roadmap_id,
    ]);
    if (!sr) {
      sr = await queryOne(
        `INSERT INTO student_roadmaps (user_id, roadmap_id, completed_step_ids, progress_percent, is_primary)
         VALUES ($1, $2, '[]', 0, $3) RETURNING *`,
        [req.user.id, step.roadmap_id, true]
      );
    }

    const completedIds = new Set(safeJson(sr.completed_step_ids, []).map(Number));
    let justCompleted = false;
    if (completedIds.has(stepId)) {
      completedIds.delete(stepId);
    } else {
      completedIds.add(stepId);
      justCompleted = true;
    }

    const allStepsRow = await queryOne('SELECT COUNT(*) AS cnt FROM roadmap_steps WHERE roadmap_id = $1', [step.roadmap_id]);
    const totalSteps = Math.max(1, Number(allStepsRow?.cnt || 1));
    const nextIds = Array.from(completedIds);
    const progressPercent = Math.min(100, Math.round((nextIds.length / totalSteps) * 100));

    await query(
      `UPDATE student_roadmaps SET completed_step_ids = $1, progress_percent = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [JSON.stringify(nextIds), progressPercent, sr.id]
    );

    let xpResult = null;
    if (justCompleted) {
      xpResult = await awardXp({
        userId: req.user.id,
        eventType: 'ROADMAP_STEP',
        eventKey: `ROADMAP_STEP:${stepId}`,
        points: XP_VALUES.ROADMAP_STEP,
        description: `Completed roadmap milestone: ${step.title}`,
        activityMinutes: 20,
      });
    }

    res.json({
      success: true,
      completedStepIds: nextIds,
      progressPercent,
      xpAwarded: xpResult?.pointsAdded || 0,
    });
  } catch (err) {
    next(err);
  }
});

// Submit Roadmap Diagnostic Skill Assessment
router.post('/roadmaps/:id/assess', authenticate, async (req, res, next) => {
  try {
    const roadmapId = Number(req.params.id);
    const roadmap = await queryOne('SELECT * FROM career_roadmaps WHERE id = $1', [roadmapId]);
    if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found.' });

    const questions = safeJson(roadmap.assessment_questions, []);
    if (!questions.length) {
      return res.status(400).json({ success: false, message: 'No skill assessment configured for this roadmap.' });
    }

    const answers = req.body.answers || {};
    let correct = 0;
    questions.forEach((q, idx) => {
      if (Number(answers[idx] ?? answers[String(idx)]) === Number(q.correctIndex)) {
        correct += 1;
      }
    });

    const pct = Math.round((correct / questions.length) * 100);
    const tier = pct >= 80 ? 'Job-Ready Track' : pct >= 50 ? 'Intermediate Builder' : 'Foundational Starter';

    await query(
      `INSERT INTO student_roadmaps (user_id, roadmap_id, skill_assessment_score, skill_assessment_result, is_primary)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, roadmap_id) DO UPDATE SET
         skill_assessment_score = $3,
         skill_assessment_result = $4,
         updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, roadmapId, pct, tier, true]
    );

    res.json({
      success: true,
      score: correct,
      total: questions.length,
      percentage: pct,
      tier,
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Create Roadmap
router.post('/admin/roadmaps', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const {
      title,
      roleSummary,
      description,
      difficulty = 'Intermediate',
      estimatedWeeks = 16,
      skillCategories = [],
      practicalProjects = [],
      interviewPrep = [],
      steps = [],
    } = req.body;

    if (!title || !roleSummary || !description) {
      return res.status(400).json({ success: false, message: 'Title, summary, and description are required.' });
    }

    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString().slice(-4)}`;
    const created = await queryOne(
      `INSERT INTO career_roadmaps (
        title, slug, role_summary, description, difficulty, estimated_weeks,
        skill_categories, practical_projects, interview_prep, is_published
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        title.trim(),
        slug,
        roleSummary.trim(),
        description.trim(),
        difficulty,
        Number(estimatedWeeks) || 16,
        JSON.stringify(skillCategories),
        JSON.stringify(practicalProjects),
        JSON.stringify(interviewPrep),
        true,
      ]
    );

    for (let i = 0; i < steps.length; i += 1) {
      const s = steps[i];
      await query(
        `INSERT INTO roadmap_steps (roadmap_id, step_order, skill_category, title, description, recommended_course_id, estimated_hours, project_task)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          created.id,
          i + 1,
          s.skillCategory || 'Core Skills',
          s.title,
          s.description || '',
          s.recommendedCourseId ? Number(s.recommendedCourseId) : null,
          Number(s.estimatedHours) || 12,
          s.projectTask || null,
        ]
      );
    }

    res.status(201).json({ success: true, roadmap: created });
  } catch (err) {
    next(err);
  }
});

// Admin: Add Step to Roadmap
router.post('/admin/roadmaps/:id/steps', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const roadmapId = Number(req.params.id);
    const { skillCategory = 'Core', title, description = '', recommendedCourseId = null, estimatedHours = 12, projectTask = '' } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Step title required.' });

    const maxOrd = await queryOne('SELECT COALESCE(MAX(step_order), 0) AS m FROM roadmap_steps WHERE roadmap_id = $1', [roadmapId]);
    const step = await queryOne(
      `INSERT INTO roadmap_steps (roadmap_id, step_order, skill_category, title, description, recommended_course_id, estimated_hours, project_task)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        roadmapId,
        Number(maxOrd?.m || 0) + 1,
        skillCategory,
        title.trim(),
        description.trim(),
        recommendedCourseId ? Number(recommendedCourseId) : null,
        Number(estimatedHours) || 12,
        projectTask || null,
      ]
    );
    res.status(201).json({ success: true, step });
  } catch (err) {
    next(err);
  }
});

// Admin: Delete Roadmap
router.delete('/admin/roadmaps/:id', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    await query('DELETE FROM career_roadmaps WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
