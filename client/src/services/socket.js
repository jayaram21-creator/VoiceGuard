import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

/**
 * Single shared Socket.IO client instance.
 *
 * Stage 2: the server now verifies a JWT during the handshake
 * (see server/src/socket/auth.js), so callers must use
 * connectSocket(token) below instead of socket.connect() directly.
 */
export const socket = io(API_BASE_URL, {
  autoConnect: false,
  transports: ['websocket'],
});

/**
 * Attaches the current JWT to the handshake and connects.
 * The server rejects the connection if the token is missing,
 * invalid, or expired.
 */
export function connectSocket(token) {
  socket.auth = { token };
  socket.connect();
}

export function disconnectSocket() {
  socket.disconnect();
}
