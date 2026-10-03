import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with `undefined`.
  throw new Error(
    'JWT_SECRET is not set. Copy server/.env.example to server/.env and set a real secret.'
  );
}

/**
 * @param {{ userId: number }} payload
 * @returns {string} signed JWT
 */
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * @param {string} token
 * @returns {{ userId: number, iat: number, exp: number }} decoded payload
 * @throws {Error} TokenExpiredError | JsonWebTokenError
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
