import { verifyToken } from '../utils/jwt.js';

/**
 * Socket.IO connection middleware. The client must connect with:
 *   io(url, { auth: { token } })
 *
 * On success, attaches `socket.userId` before the connection handler runs.
 * On failure, calls next(err) which makes Socket.IO reject the handshake
 * (the client receives a `connect_error` event and never gets `connect`).
 */
export function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    console.log(`[socket] rejected ${socket.id}: no token provided`);
    return next(new Error('Authentication token required'));
  }

  try {
    const decoded = verifyToken(token);
    socket.userId = decoded.userId;
    return next();
  } catch (err) {
    console.log(`[socket] rejected ${socket.id}: ${err.message}`);
    return next(new Error('Invalid or expired token'));
  }
}
