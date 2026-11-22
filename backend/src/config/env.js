import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

function resolveSecret(envKey, label) {
  const val = process.env[envKey]?.trim();
  const isPlaceholder = !val || val.startsWith('replace-with-') || val.includes('your_');
  if (isProduction && isPlaceholder) {
    throw new Error(`${label} (${envKey}) must be configured with a strong secret in production.`);
  }
  if (!isPlaceholder) {
    return val;
  }
  // Ephemeral cryptographic secret for local development only (no hardcoded literal secrets)
  return crypto.randomBytes(32).toString('hex');
}

if (isProduction && (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('USER:PASSWORD@HOST'))) {
  throw new Error('DATABASE_URL must be configured for PostgreSQL in production (SQLite fallback is disabled).');
}

const rawOrigins = [
  process.env.FRONTEND_URL,
  process.env.APP_URL,
  ...(process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : []),
  !isProduction ? 'http://localhost:3000' : '',
  !isProduction ? 'http://localhost:5173' : '',
]
  .map((u) => (u || '').trim().replace(/\/$/, ''))
  .filter(Boolean);

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
  corsAllowedOrigins: Array.from(new Set(rawOrigins)),
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    accessSecret: resolveSecret('JWT_ACCESS_SECRET', 'JWT Access Secret'),
    refreshSecret: resolveSecret('JWT_REFRESH_SECRET', 'JWT Refresh Secret'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  allowSandboxPayments: !isProduction && process.env.ALLOW_SANDBOX_PAYMENTS !== 'false',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    emailFrom: process.env.EMAIL_FROM || 'SKILLNOVA <admissions@skillnova.edu>',
    adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'admissions@skillnova.edu',
  },
};
