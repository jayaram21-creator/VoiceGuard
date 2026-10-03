/**
 * Presence and Active Call State Manager
 *
 * Keeps in-memory maps of online users and their active sockets,
 * as well as tracking active call sessions.
 */

// userId -> Set<socketId>
const userSockets = new Map();

// socketId -> userId
const socketUser = new Map();

// callId -> { callId, callerId, receiverId, status, startedAt }
const activeCalls = new Map();

/**
 * Register a socket connection for a user.
 * @returns {boolean} true if this is the user's first active socket (came online).
 */
export function registerSocket(userId, socketId) {
  const uId = Number(userId);
  socketUser.set(socketId, uId);

  if (!userSockets.has(uId)) {
    userSockets.set(uId, new Set([socketId]));
    return true;
  }

  userSockets.get(uId).add(socketId);
  return false;
}

/**
 * Unregister a socket on disconnect.
 * @returns {{ userId: number | null, isOfflineNow: boolean }}
 */
export function unregisterSocket(socketId) {
  const userId = socketUser.get(socketId);
  socketUser.delete(socketId);

  if (!userId) {
    return { userId: null, isOfflineNow: false };
  }

  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSockets.delete(userId);
      return { userId, isOfflineNow: true };
    }
  }

  return { userId, isOfflineNow: false };
}

/**
 * Check if a user is currently online.
 */
export function isUserOnline(userId) {
  const uId = Number(userId);
  const sockets = userSockets.get(uId);
  return !!(sockets && sockets.size > 0);
}

/**
 * Get all socket IDs for a given user.
 */
export function getSocketsForUser(userId) {
  const uId = Number(userId);
  const sockets = userSockets.get(uId);
  return sockets ? Array.from(sockets) : [];
}

/**
 * Get list of all currently online user IDs.
 */
export function getAllOnlineUserIds() {
  return Array.from(userSockets.keys());
}

/**
 * Call session management
 */
export function createCall(callId, callerId, receiverId) {
  const call = {
    callId,
    callerId: Number(callerId),
    receiverId: Number(receiverId),
    status: 'calling',
    createdAt: Date.now(),
  };
  activeCalls.set(callId, call);
  return call;
}

export function getCall(callId) {
  return activeCalls.get(callId) || null;
}

export function getCallForUser(userId) {
  const uId = Number(userId);
  for (const call of activeCalls.values()) {
    if (call.callerId === uId || call.receiverId === uId) {
      return call;
    }
  }
  return null;
}

export function updateCallStatus(callId, status) {
  const call = activeCalls.get(callId);
  if (call) {
    call.status = status;
    if (status === 'connected') {
      call.connectedAt = Date.now();
    }
  }
  return call;
}

export function removeCall(callId) {
  const call = activeCalls.get(callId);
  activeCalls.delete(callId);
  return call;
}

export function removeCallsForUser(userId) {
  const uId = Number(userId);
  const ended = [];
  for (const [callId, call] of activeCalls.entries()) {
    if (call.callerId === uId || call.receiverId === uId) {
      activeCalls.delete(callId);
      ended.push(call);
    }
  }
  return ended;
}
