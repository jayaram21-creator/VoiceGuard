import { db } from '../db/index.js';
import {
  registerSocket,
  unregisterSocket,
  isUserOnline,
  getSocketsForUser,
  getAllOnlineUserIds,
  createCall,
  getCall,
  getCallForUser,
  updateCallStatus,
  removeCall,
  removeCallsForUser,
} from './presence.js';

export function setupSignaling(io) {
  io.on('connection', (socket) => {
    const userId = Number(socket.userId);
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    const user = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(userId);
    if (!user) {
      socket.disconnect(true);
      return;
    }

    const isFirst = registerSocket(userId, socket.id);
    console.log(`[socket] User connected: ${user.username} (ID: ${userId}, Socket: ${socket.id})`);

    // Broadcast online status if this is user's first active tab/connection
    if (isFirst) {
      socket.broadcast.emit('presence:update', { userId, isOnline: true });
    }

    // Send initial list of online users to the connecting client
    socket.emit('presence:initial', { onlineUserIds: getAllOnlineUserIds() });

    // --- Presence ping/query ---
    socket.on('presence:sync', () => {
      socket.emit('presence:initial', { onlineUserIds: getAllOnlineUserIds() });
    });

    // --- Call Initiation ---
    socket.on('call:initiate', ({ toUserId }) => {
      const targetId = Number(toUserId);

      if (!targetId || targetId === userId) {
        return socket.emit('call:failed', { reason: 'Invalid target user' });
      }

      if (!isUserOnline(targetId)) {
        return socket.emit('call:failed', { reason: 'User is currently offline' });
      }

      const calleeCall = getCallForUser(targetId);
      if (calleeCall) {
        return socket.emit('call:busy', {
          toUserId: targetId,
          reason: 'User is currently in another call',
        });
      }

      // Clean up any stale call for caller
      removeCallsForUser(userId);

      const callId = `call_${Date.now()}_${userId}_${targetId}`;
      createCall(callId, userId, targetId);

      const targetSockets = getSocketsForUser(targetId);
      for (const sId of targetSockets) {
        io.to(sId).emit('call:incoming', {
          callId,
          fromUser: {
            id: user.id,
            username: user.username,
            email: user.email,
          },
        });
      }

      socket.emit('call:ringing', { callId, toUserId: targetId });
    });

    // --- Call Acceptance ---
    socket.on('call:accept', ({ callId, toUserId }) => {
      const call = getCall(callId);
      const targetId = Number(toUserId);

      if (call) {
        updateCallStatus(callId, 'connected');
      }

      const callerSockets = getSocketsForUser(targetId);
      for (const sId of callerSockets) {
        io.to(sId).emit('call:accepted', {
          callId,
          byUserId: userId,
        });
      }
    });

    // --- Call Rejection ---
    socket.on('call:reject', ({ callId, toUserId, reason }) => {
      if (callId) {
        removeCall(callId);
      }
      const targetId = Number(toUserId);
      const callerSockets = getSocketsForUser(targetId);
      for (const sId of callerSockets) {
        io.to(sId).emit('call:rejected', {
          callId,
          byUserId: userId,
          reason: reason || 'Call declined',
        });
      }
    });

    // --- Call Cancellation (Caller cancels before answered) ---
    socket.on('call:cancel', ({ callId, toUserId }) => {
      if (callId) {
        removeCall(callId);
      }
      const targetId = Number(toUserId);
      const calleeSockets = getSocketsForUser(targetId);
      for (const sId of calleeSockets) {
        io.to(sId).emit('call:cancelled', {
          callId,
          byUserId: userId,
        });
      }
    });

    // --- Call End (Active call terminated by either party) ---
    socket.on('call:end', ({ callId, toUserId, reason }) => {
      if (callId) {
        removeCall(callId);
      }
      const targetId = Number(toUserId);
      const peerSockets = getSocketsForUser(targetId);
      for (const sId of peerSockets) {
        io.to(sId).emit('call:ended', {
          callId,
          byUserId: userId,
          reason: reason || 'Call ended',
        });
      }
    });

    // ==========================================
    // WebRTC Signaling Relay (Offer, Answer, ICE)
    // ==========================================

    socket.on('webrtc:offer', ({ toUserId, sdp }) => {
      const targetId = Number(toUserId);
      if (!targetId || !sdp) return;

      const targetSockets = getSocketsForUser(targetId);
      for (const sId of targetSockets) {
        io.to(sId).emit('webrtc:offer', {
          fromUserId: userId,
          sdp,
        });
      }
    });

    socket.on('webrtc:answer', ({ toUserId, sdp }) => {
      const targetId = Number(toUserId);
      if (!targetId || !sdp) return;

      const targetSockets = getSocketsForUser(targetId);
      for (const sId of targetSockets) {
        io.to(sId).emit('webrtc:answer', {
          fromUserId: userId,
          sdp,
        });
      }
    });

    socket.on('webrtc:ice-candidate', ({ toUserId, candidate }) => {
      const targetId = Number(toUserId);
      if (!targetId || !candidate) return;

      const targetSockets = getSocketsForUser(targetId);
      for (const sId of targetSockets) {
        io.to(sId).emit('webrtc:ice-candidate', {
          fromUserId: userId,
          candidate,
        });
      }
    });

    // --- Disconnection & Teardown ---
    socket.on('disconnect', (reason) => {
      console.log(`[socket] Client disconnected: ${socket.id} (${reason})`);
      const { isOfflineNow } = unregisterSocket(socket.id);

      if (isOfflineNow) {
        socket.broadcast.emit('presence:update', { userId, isOnline: false });
      }

      // If user had an active call, notify their peer that call has ended due to disconnect
      const endedCalls = removeCallsForUser(userId);
      for (const call of endedCalls) {
        const peerId = call.callerId === userId ? call.receiverId : call.callerId;
        const peerSockets = getSocketsForUser(peerId);
        for (const sId of peerSockets) {
          io.to(sId).emit('call:ended', {
            callId: call.callId,
            byUserId: userId,
            reason: 'Peer disconnected',
          });
        }
      }
    });
  });
}
