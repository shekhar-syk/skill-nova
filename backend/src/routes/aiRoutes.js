import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import multer from 'multer';
import { query, queryOne } from '../db/index.js';
import { authenticate, authorizeRoles, optionalAuth } from '../middleware/authMiddleware.js';
import {
  ALLOWED_TUTOR_MODELS,
  generateMapsGroundedReply,
  generateTutorReply,
  transcribeAudioBuffer,
} from '../services/geminiService.js';

const router = Router();

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'AI rate limit reached (20 requests/minute). Please wait a moment before sending another prompt.' },
});

function parseSourcesJson(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// List user's AI conversations
router.get('/ai/conversations', authenticate, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT c.*, crs.title AS course_title,
              (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) AS message_count
       FROM ai_conversations c
       LEFT JOIN courses crs ON crs.id = c.course_id
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC, c.id DESC`,
      [req.user.id]
    );
    res.json({ success: true, conversations: rows.rows });
  } catch (err) {
    next(err);
  }
});

// Get single conversation + message history (strict ownership check)
router.get('/ai/conversations/:id', authenticate, async (req, res, next) => {
  try {
    const convId = Number(req.params.id);
    const conv = await queryOne(
      'SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2',
      [convId, req.user.id]
    );
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }
    const messagesRes = await query(
      'SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY id ASC',
      [convId]
    );
    const messages = messagesRes.rows.map((m) => ({
      ...m,
      groundingSources: parseSourcesJson(m.grounding_sources),
    }));
    res.json({ success: true, conversation: conv, messages });
  } catch (err) {
    next(err);
  }
});

// Delete conversation (strict ownership check)
router.delete('/ai/conversations/:id', authenticate, async (req, res, next) => {
  try {
    const convId = Number(req.params.id);
    const conv = await queryOne('SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2', [
      convId,
      req.user.id,
    ]);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }
    await query('DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2', [convId, req.user.id]);
    res.json({ success: true, message: 'Conversation deleted.' });
  } catch (err) {
    next(err);
  }
});

// Send prompt to Gemini AI Learning Assistant (Multi-Model + Google Search Grounding)
router.post('/ai/chat', authenticate, aiLimiter, async (req, res, next) => {
  try {
    const {
      conversationId = null,
      prompt,
      mode = 'CONCEPT',
      language = 'General',
      model = 'gemini-4-hydrogen',
      thinkingLevel = 'AUTO',
      useSearch = false,
      courseId = null,
      lessonId = null,
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter a question or prompt.' });
    }
    if (prompt.length > 4000) {
      return res.status(400).json({ success: false, message: 'Prompt exceeds 4,000 characters.' });
    }

    const allowedModes = ['CONCEPT', 'DEBUG', 'ASSIGNMENT_HINT', 'INTERVIEW', 'MCQ', 'SUMMARIZE', 'STUDY_PLAN'];
    const safeMode = allowedModes.includes(mode) ? mode : 'CONCEPT';
    const safeModel = ALLOWED_TUTOR_MODELS.includes(model) ? model : 'gemini-4-hydrogen';

    let conv = null;
    if (conversationId) {
      conv = await queryOne('SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2', [
        Number(conversationId),
        req.user.id,
      ]);
      if (!conv) {
        return res.status(404).json({ success: false, message: 'Conversation not found.' });
      }
    }

    // Load student learning context from DB
    const enrollments = await query(
      `SELECT c.title, e.progress_percent, e.learning_hours
       FROM enrollments e JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = $1`,
      [req.user.id]
    );
    const quizzes = await query(
      `SELECT q.title, qa.percentage, qa.passed
       FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
       WHERE qa.user_id = $1 ORDER BY qa.attempted_at DESC LIMIT 5`,
      [req.user.id]
    );
    const roadmap = await queryOne(
      `SELECT cr.title, sr.progress_percent
       FROM student_roadmaps sr JOIN career_roadmaps cr ON cr.id = sr.roadmap_id
       WHERE sr.user_id = $1 ORDER BY sr.is_primary DESC, sr.updated_at DESC LIMIT 1`,
      [req.user.id]
    );

    const studentContext = {
      name: req.user.fullName,
      enrollments: enrollments.rows,
      recentQuizzes: quizzes.rows,
      careerGoal: roadmap ? `${roadmap.title} (${roadmap.progress_percent}%)` : 'Not selected yet',
    };

    let lessonContext = null;
    if (lessonId) {
      const lesson = await queryOne(
        `SELECT l.title, l.content, l.course_id, c.title AS course_title
         FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = $1`,
        [Number(lessonId)]
      );
      if (lesson) {
        const isStaff = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'].includes(req.user.role);
        const enrolled = await queryOne(
          'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
          [req.user.id, lesson.course_id]
        );
        if (enrolled || isStaff) {
          lessonContext = {
            courseTitle: lesson.course_title,
            lessonTitle: lesson.title,
            content: lesson.content,
          };
        }
      }
    }

    let history = [];
    if (conv) {
      const histRes = await query(
        'SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 10',
        [conv.id]
      );
      history = histRes.rows.reverse();
    }

    // Call Gemini server-side first; do not persist partial state on failure
    const aiResult = await generateTutorReply({
      prompt: prompt.trim(),
      mode: safeMode,
      language,
      model: safeModel,
      thinkingLevel,
      useSearch: Boolean(useSearch),
      history,
      studentContext,
      lessonContext,
    });

    if (!conv) {
      const titleSnippet = prompt.trim().slice(0, 64) + (prompt.trim().length > 64 ? '…' : '');
      conv = await queryOne(
        `INSERT INTO ai_conversations (user_id, course_id, title, mode, language)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.user.id, courseId ? Number(courseId) : null, titleSnippet, safeMode, language]
      );
    } else {
      await query(
        'UPDATE ai_conversations SET mode = $1, language = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [safeMode, language, conv.id]
      );
    }

    const userMessage = await queryOne(
      `INSERT INTO ai_messages (conversation_id, user_id, role, content, mode, model_id, tokens_used)
       VALUES ($1, $2, 'user', $3, $4, $5, 0) RETURNING *`,
      [conv.id, req.user.id, prompt.trim(), safeMode, safeModel]
    );

    const sourcesJson = JSON.stringify(aiResult.sources || []);
    const assistantMessageRow = await queryOne(
      `INSERT INTO ai_messages (conversation_id, user_id, role, content, mode, model_id, grounding_sources, tokens_used)
       VALUES ($1, $2, 'assistant', $3, $4, $5, $6, $7) RETURNING *`,
      [conv.id, req.user.id, aiResult.text, safeMode, aiResult.model, sourcesJson, aiResult.tokensUsed]
    );

    res.json({
      success: true,
      conversation: conv,
      userMessage,
      assistantMessage: {
        ...assistantMessageRow,
        groundingSources: aiResult.sources || [],
      },
      model: aiResult.model,
      sources: aiResult.sources || [],
    });
  } catch (err) {
    next(err);
  }
});

// Audio Transcription via gemini-3.5-transcribe
router.post('/ai/transcribe', authenticate, aiLimiter, uploadAudio.single('audio'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ success: false, message: 'Please upload or record an audio clip.' });
    }
    const promptHint = typeof req.body?.promptHint === 'string' ? req.body.promptHint.slice(0, 200) : '';
    const result = await transcribeAudioBuffer({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype || 'audio/webm',
      promptHint,
    });
    res.json({
      success: true,
      transcript: result.transcript,
      model: result.model,
    });
  } catch (err) {
    next(err);
  }
});

// Google Maps Grounded Place Discovery via gemini-4-hydrogen + googleMaps tool
router.post('/ai/maps-grounding', optionalAuth, aiLimiter, async (req, res, next) => {
  try {
    const { prompt, lat = null, lng = null } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter a location or campus query.' });
    }
    if (prompt.length > 1000) {
      return res.status(400).json({ success: false, message: 'Location query exceeds 1,000 characters.' });
    }

    const result = await generateMapsGroundedReply({
      prompt: prompt.trim(),
      lat,
      lng,
    });
    res.json({
      success: true,
      text: result.text,
      sources: result.sources,
      model: result.model,
    });
  } catch (err) {
    next(err);
  }
});

// Admin: AI Usage Analytics
router.get('/admin/ai-analytics', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (_req, res, next) => {
  try {
    const totals = await queryOne(
      `SELECT COUNT(DISTINCT conversation_id) AS conversations,
              COUNT(*) AS total_messages,
              COUNT(DISTINCT user_id) AS active_learners,
              COALESCE(SUM(tokens_used), 0) AS total_tokens
       FROM ai_messages WHERE role = 'assistant'`
    );
    const byMode = await query(
      `SELECT mode, COUNT(*) AS count FROM ai_messages WHERE role = 'user' GROUP BY mode ORDER BY count DESC`
    );
    const byLanguage = await query(
      `SELECT language, COUNT(*) AS count FROM ai_conversations GROUP BY language ORDER BY count DESC`
    );
    res.json({
      success: true,
      totals: {
        conversations: Number(totals?.conversations || 0),
        totalMessages: Number(totals?.total_messages || 0),
        activeLearners: Number(totals?.active_learners || 0),
        totalTokens: Number(totals?.total_tokens || 0),
      },
      byMode: byMode.rows.map((r) => ({ mode: r.mode, count: Number(r.count) })),
      byLanguage: byLanguage.rows.map((r) => ({ language: r.language, count: Number(r.count) })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
