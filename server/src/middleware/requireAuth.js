import { verifyToken } from '../utils/jwt.js';

/**
 * Protects a REST route: requires `Authorization: Bearer <token>`.
 * On success, attaches `req.userId` and calls next().
 * On failure, responds 401 without leaking whether the issue was a
 * missing header, a malformed token, or an expired one beyond a
 * generic reason string.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}
