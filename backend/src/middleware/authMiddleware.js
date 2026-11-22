import { queryOne } from '../db/index.js';
import { verifyAccessToken } from '../utils/auth.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const token = authHeader.slice(7).trim();
    const decoded = verifyAccessToken(token);

    const user = await queryOne(
      'SELECT id, full_name, email, role, phone, avatar_url, is_active FROM users WHERE id = $1',
      [decoded.sub]
    );
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is inactive or unavailable.' });
    }

    req.user = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatarUrl: user.avatar_url,
    };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired access token.' });
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const decoded = verifyAccessToken(token);
      const user = await queryOne(
        'SELECT id, full_name, email, role, is_active FROM users WHERE id = $1',
        [decoded.sub]
      );
      if (user && user.is_active) {
        req.user = {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
        };
      }
    }
  } catch {
    // Ignore invalid optional token
  }
  next();
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions for this action.' });
    }
    next();
  };
}
