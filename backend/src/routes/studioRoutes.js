import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { authenticate } from '../middleware/authMiddleware.js';
import { generateStudyAudio } from '../services/geminiService.js';

const router = Router();

const studioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Audio Studio rate limit reached. Please wait a minute.' },
});

// Study Audio Narration (gemini-3.8-flash-lite-tts) & Dual-Speaker Podcast (gemini-3.8-flash-tts)
router.post('/studio/tts', authenticate, studioLimiter, async (req, res, next) => {
  try {
    const {
      text,
      mode = 'single',
      voiceName = 'Kore',
      style = '',
      speakerA = null,
      speakerB = null,
    } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide lesson notes or dialogue script text.' });
    }
    if (text.length > 3500) {
      return res.status(400).json({ success: false, message: 'Script exceeds 3,500 characters.' });
    }

    const safeMode = mode === 'podcast' ? 'podcast' : 'single';
    const result = await generateStudyAudio({
      text: text.trim(),
      mode: safeMode,
      voiceName,
      style: typeof style === 'string' ? style.slice(0, 160) : '',
      speakerA,
      speakerB,
    });

    res.json({
      success: true,
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      model: result.model,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
