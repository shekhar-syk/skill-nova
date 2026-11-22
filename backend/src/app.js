import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config/env.js';
import { checkDatabaseHealth } from './db/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';
import admissionPaymentRoutes from './routes/admissionPaymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import communityRoutes from './routes/communityRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import enquiryRoutes from './routes/enquiryRoutes.js';
import gamificationRoutes from './routes/gamificationRoutes.js';
import liveSessionRoutes from './routes/liveSessionRoutes.js';
import lmsRoutes from './routes/lmsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import placementRoutes from './routes/placementRoutes.js';
import roadmapRoutes from './routes/roadmapRoutes.js';
import studioRoutes from './routes/studioRoutes.js';

export function createApiApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  const allowedOrigins = new Set(config.corsAllowedOrigins);

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const normalized = origin.replace(/\/$/, '');
        if (
          allowedOrigins.has(normalized) ||
          normalized.endsWith('.vercel.app') ||
          normalized.endsWith('.run.app')
        ) {
          return cb(null, true);
        }
        if (!config.isProduction && normalized.startsWith('http://localhost:')) {
          return cb(null, true);
        }
        return cb(new Error('Origin not allowed by SKILLNOVA CORS policy.'));
      },
      credentials: true,
    })
  );

  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        if (req.originalUrl.includes('/payments/webhook')) {
          req.rawBody = buf.toString('utf8');
        }
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again shortly.' },
  });

  app.use('/api', apiLimiter);

  // Health check verifying backend & database connectivity
  app.get('/api/health', async (_req, res) => {
    const dbStatus = await checkDatabaseHealth();
    const statusCode = dbStatus.connected ? 200 : 503;
    res.status(statusCode).json({
      success: dbStatus.connected,
      service: 'skillnova-api',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    });
  });

  // Domain API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api', courseRoutes);
  app.use('/api/enquiries', enquiryRoutes);
  app.use('/api', admissionPaymentRoutes);
  app.use('/api', lmsRoutes);
  app.use('/api', adminRoutes);
  app.use('/api', aiRoutes);
  app.use('/api', gamificationRoutes);
  app.use('/api', roadmapRoutes);
  app.use('/api', liveSessionRoutes);
  app.use('/api', placementRoutes);
  app.use('/api', communityRoutes);
  app.use('/api', notificationRoutes);
  app.use('/api', studioRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
