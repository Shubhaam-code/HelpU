import crypto from 'crypto';
import { requireAuth } from './auth.js';

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function isAdminEmail(email) {
  const allowlist = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && allowlist.includes(String(email).toLowerCase()));
}

/**
 * Protects admin-only endpoints.
 * Accepts either:
 *  - x-admin-key header matching ADMIN_API_KEY (server-to-server / CLI imports)
 *  - a valid Firebase bearer token whose Student email is in ADMIN_EMAILS
 *    or whose Student record has isAdmin = true
 */
export function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  const configuredKey = process.env.ADMIN_API_KEY;

  if (configuredKey && secureEqual(adminKey, configuredKey)) {
    req.adminIdentity = 'admin-key';
    req.userId = req.userId || 'admin-key';
    return next();
  }

  return requireAuth(req, res, () => {
    const email = req.student?.email || req.firebaseUser?.email;
    if (req.student?.isAdmin === true || isAdminEmail(email)) {
      req.adminIdentity = req.userId;
      return next();
    }

    return res.status(403).json({
      success: false,
      code: 'ADMIN_FORBIDDEN',
      message: 'Forbidden: admin privileges are required for this operation.'
    });
  });
}
