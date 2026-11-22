import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { config } from '../config/env.js';
import { query, queryOne } from '../db/index.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { logAudit, createNotification } from '../services/auditService.js';
import { emailTemplates, sendTransactionalEmail } from '../services/emailService.js';
import {
  getRefreshCookieOptions,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/auth.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/schemas.js';

const router = Router();

async function issueTokens(user, res) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  res.cookie('sn_refresh_token', refreshToken, getRefreshCookieOptions());
  return { accessToken, refreshToken };
}

router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [parsed.email]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const user = await queryOne(
      `INSERT INTO users (full_name, email, password_hash, role, phone, is_active)
       VALUES ($1, $2, $3, 'STUDENT', $4, $5)
       RETURNING id, full_name, email, role, phone, avatar_url, is_active`,
      [parsed.fullName, parsed.email, passwordHash, parsed.phone || null, true]
    );

    await query('INSERT INTO student_profiles (user_id) VALUES ($1)', [user.id]);
    await query('INSERT INTO learning_streaks (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [user.id]);
    await query('INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [user.id]);

    // Link any prior admissions submitted with this email
    await query('UPDATE admissions SET user_id = $1 WHERE email = $2 AND user_id IS NULL', [user.id, user.email]);

    const { accessToken } = await issueTokens(user, res);
    await logAudit({
      actorUserId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: req.ip,
    });
    await createNotification({
      userId: user.id,
      title: 'Welcome to SKILLNOVA',
      message: 'Your student account is ready. Explore 45+ programs or resume your applications.',
      type: 'SUCCESS',
    });

    const mail = emailTemplates.registrationWelcome({ fullName: user.full_name });
    await sendTransactionalEmail({ to: user.email, ...mail });

    res.status(201).json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const user = await queryOne(
      'SELECT id, full_name, email, password_hash, role, phone, avatar_url, is_active FROM users WHERE email = $1',
      [parsed.email]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact support.' });
    }

    const passwordValid = await bcrypt.compare(parsed.password, user.password_hash);
    if (!passwordValid) {
      await logAudit({
        actorUserId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'USER',
        entityId: user.id,
        ipAddress: req.ip,
      });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const { accessToken } = await issueTokens(user, res);
    await logAudit({
      actorUserId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err) {
    next(err);
  }
});

function isTrustedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, '');
  return (
    config.corsAllowedOrigins.includes(normalized) ||
    normalized.endsWith('.vercel.app') ||
    normalized.endsWith('.run.app') ||
    (!config.isProduction && normalized.startsWith('http://localhost:'))
  );
}

router.post('/refresh', async (req, res) => {
  try {
    if (!isTrustedOrigin(req)) {
      return res.status(403).json({ success: false, message: 'Untrusted origin for session refresh.' });
    }
    const refreshToken = req.cookies?.sn_refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token provided.' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const stored = await queryOne(
      'SELECT id, user_id, expires_at, revoked FROM refresh_tokens WHERE token_hash = $1',
      [tokenHash]
    );

    if (!stored || stored.revoked || new Date(stored.expires_at) < new Date()) {
      return res.status(401).json({ success: false, message: 'Refresh session expired.' });
    }

    const user = await queryOne(
      'SELECT id, full_name, email, role, phone, avatar_url, is_active FROM users WHERE id = $1',
      [decoded.sub]
    );
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User account unavailable.' });
    }

    // Rotate refresh token
    await query('UPDATE refresh_tokens SET revoked = $1 WHERE id = $2', [true, stored.id]);
    const { accessToken } = await issueTokens(user, res);

    res.json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatarUrl: user.avatar_url,
      },
    });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid refresh token.' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    if (!isTrustedOrigin(req)) {
      return res.status(403).json({ success: false, message: 'Untrusted origin.' });
    }
    const refreshToken = req.cookies?.sn_refresh_token;
    if (refreshToken) {
      await query('UPDATE refresh_tokens SET revoked = $1 WHERE token_hash = $2', [true, hashToken(refreshToken)]);
    }
    res.clearCookie('sn_refresh_token', { path: '/api/auth' });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch {
    res.clearCookie('sn_refresh_token', { path: '/api/auth' });
    res.json({ success: true, message: 'Logged out.' });
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await queryOne('SELECT id, full_name, email FROM users WHERE email = $1', [email]);

    if (!user) {
      return res.json({
        success: true,
        message: 'If an account matches this email, password reset instructions have been sent.',
      });
    }

    const rawToken = crypto.randomBytes(24).toString('hex');
    const hashed = hashToken(rawToken);
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [
      hashed,
      expires,
      user.id,
    ]);

    const resetUrl = `${req.headers.origin || 'http://localhost:3000'}/reset-password?token=${rawToken}`;
    const mail = emailTemplates.passwordReset({ fullName: user.full_name, resetUrl });
    const emailResult = await sendTransactionalEmail({ to: user.email, ...mail });

    res.json({
      success: true,
      message: 'Password reset instructions have been sent.',
      previewResetToken: emailResult.mode === 'sandbox-log' ? rawToken : undefined,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const hashed = hashToken(token);
    const user = await queryOne(
      'SELECT id, reset_token_expires FROM users WHERE reset_token = $1',
      [hashed]
    );

    if (!user || !user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset token is invalid or expired.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, user.id]
    );

    await logAudit({
      actorUserId: user.id,
      action: 'PASSWORD_RESET',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Password updated successfully. You may now sign in.' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const profile =
      req.user.role === 'STUDENT'
        ? await queryOne('SELECT * FROM student_profiles WHERE user_id = $1', [req.user.id])
        : req.user.role === 'INSTRUCTOR'
        ? await queryOne('SELECT * FROM instructor_profiles WHERE user_id = $1', [req.user.id])
        : null;

    res.json({
      success: true,
      user: req.user,
      profile,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await queryOne('SELECT id, password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const nextHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      nextHash,
      req.user.id,
    ]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
