import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO } from '../../client/node_modules/socket.io-client/build/esm/index.js';

import './db/index.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import contactsRouter from './routes/contacts.js';
import { socketAuthMiddleware } from './socket/auth.js';
import { setupSignaling } from './socket/signaling.js';

const TEST_PORT = 5099;

async function runE2ETests() {
  console.log('--- Starting Stage 4 E2E Verification Tests ---');

  // 1. Spin up ephemeral test server
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', healthRouter);
  app.use('/api', authRouter);
  app.use('/api', contactsRouter);

  const httpServer = http.createServer(app);
  const ioServer = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  ioServer.use(socketAuthMiddleware);
  setupSignaling(ioServer);

  await new Promise((resolve) => httpServer.listen(TEST_PORT, resolve));
  console.log(`[PASS] Test server listening on port ${TEST_PORT}`);

  const baseUrl = `http://localhost:${TEST_PORT}/api`;

  try {
    // 2. Register User A (Alice)
    const uniqueSuffix = Date.now();
    const aliceData = {
      username: `alice_${uniqueSuffix}`,
      email: `alice_${uniqueSuffix}@example.com`,
      password: 'password123',
    };

    const resAlice = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aliceData),
    });
    const aliceJson = await resAlice.json();
    if (!resAlice.ok || !aliceJson.token) {
      throw new Error(`Alice registration failed: ${JSON.stringify(aliceJson)}`);
    }
    const aliceToken = aliceJson.token;
    const aliceUser = aliceJson.user;
    console.log(`[PASS] Alice registered successfully (ID: ${aliceUser.id})`);

    // 3. Register User B (Bob)
    const bobData = {
      username: `bob_${uniqueSuffix}`,
      email: `bob_${uniqueSuffix}@example.com`,
      password: 'password123',
    };
    const resBob = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bobData),
    });
    const bobJson = await resBob.json();
    if (!resBob.ok || !bobJson.token) {
      throw new Error(`Bob registration failed: ${JSON.stringify(bobJson)}`);
    }
    const bobToken = bobJson.token;
    const bobUser = bobJson.user;
    console.log(`[PASS] Bob registered successfully (ID: ${bobUser.id})`);

    // 4. Alice searches for Bob
    const searchRes = await fetch(`${baseUrl}/users/search?q=bob_${uniqueSuffix}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const searchJson = await searchRes.json();
    if (!searchJson.users || searchJson.users.length === 0) {
      throw new Error('User search failed to find Bob');
    }
    console.log(`[PASS] Alice searched and found Bob (${searchJson.users[0].username})`);

    // 5. Alice adds Bob as contact
    const addRes = await fetch(`${baseUrl}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({ contactId: bobUser.id }),
    });
    const addJson = await addRes.json();
    if (!addRes.ok || !addJson.contact) {
      throw new Error(`Add contact failed: ${JSON.stringify(addJson)}`);
    }
    console.log(`[PASS] Alice added Bob to contacts`);

    // 6. Connect Alice Socket.IO
    const aliceSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
      auth: { token: aliceToken },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      aliceSocket.on('connect', resolve);
      aliceSocket.on('connect_error', reject);
    });
    console.log(`[PASS] Alice authenticated socket connected (${aliceSocket.id})`);

    // 7. Connect Bob Socket.IO
    const bobSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
      auth: { token: bobToken },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      bobSocket.on('connect', resolve);
      bobSocket.on('connect_error', reject);
    });
    console.log(`[PASS] Bob authenticated socket connected (${bobSocket.id})`);

    // 8. Test Call Initiation Flow: Alice calls Bob
    console.log('--- Testing Call Initiation & WebRTC Signaling Relay ---');
    let testCallId = null;

    const incomingPromise = new Promise((resolve) => {
      bobSocket.once('call:incoming', (payload) => {
        testCallId = payload.callId;
        console.log(`[PASS] Bob received incoming call from ${payload.fromUser.username} (callId: ${payload.callId})`);
        resolve(payload);
      });
    });

    const ringingPromise = new Promise((resolve) => {
      aliceSocket.once('call:ringing', (payload) => {
        console.log(`[PASS] Alice received call:ringing notification`);
        resolve(payload);
      });
    });

    aliceSocket.emit('call:initiate', { toUserId: bobUser.id });
    await Promise.all([incomingPromise, ringingPromise]);

    // 9. Bob Accepts Call
    const acceptedPromise = new Promise((resolve) => {
      aliceSocket.once('call:accepted', (payload) => {
        console.log(`[PASS] Alice received call:accepted from Bob (byUserId: ${payload.byUserId})`);
        resolve(payload);
      });
    });

    bobSocket.emit('call:accept', { callId: testCallId, toUserId: aliceUser.id });
    await acceptedPromise;

    // 10. WebRTC SDP Offer Relay
    const offerPromise = new Promise((resolve) => {
      bobSocket.once('webrtc:offer', (payload) => {
        console.log(`[PASS] Bob received WebRTC SDP offer from Alice (type: ${payload.sdp.type})`);
        resolve(payload);
      });
    });

    const mockOfferSdp = { type: 'offer', sdp: 'v=0\r\no=alice ... audio RTP/SAVPF 111' };
    aliceSocket.emit('webrtc:offer', { toUserId: bobUser.id, sdp: mockOfferSdp });
    await offerPromise;

    // 11. WebRTC SDP Answer Relay
    const answerPromise = new Promise((resolve) => {
      aliceSocket.once('webrtc:answer', (payload) => {
        console.log(`[PASS] Alice received WebRTC SDP answer from Bob (type: ${payload.sdp.type})`);
        resolve(payload);
      });
    });

    const mockAnswerSdp = { type: 'answer', sdp: 'v=0\r\no=bob ... audio RTP/SAVPF 111' };
    bobSocket.emit('webrtc:answer', { toUserId: aliceUser.id, sdp: mockAnswerSdp });
    await answerPromise;

    // 12. WebRTC ICE Candidate Relay (Bidirectional)
    const bobIcePromise = new Promise((resolve) => {
      bobSocket.once('webrtc:ice-candidate', (payload) => {
        console.log(`[PASS] Bob received ICE candidate from Alice (${payload.candidate.candidate})`);
        resolve(payload);
      });
    });

    const aliceIcePromise = new Promise((resolve) => {
      aliceSocket.once('webrtc:ice-candidate', (payload) => {
        console.log(`[PASS] Alice received ICE candidate from Bob (${payload.candidate.candidate})`);
        resolve(payload);
      });
    });

    aliceSocket.emit('webrtc:ice-candidate', {
      toUserId: bobUser.id,
      candidate: { candidate: 'candidate:1 1 UDP 2122252543 192.168.1.100 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 },
    });

    bobSocket.emit('webrtc:ice-candidate', {
      toUserId: aliceUser.id,
      candidate: { candidate: 'candidate:2 1 UDP 2122252543 192.168.1.101 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 },
    });

    await Promise.all([bobIcePromise, aliceIcePromise]);

    // 13. End Call
    const endPromise = new Promise((resolve) => {
      bobSocket.once('call:ended', (payload) => {
        console.log(`[PASS] Bob received call:ended notification (reason: ${payload.reason})`);
        resolve(payload);
      });
    });

    aliceSocket.emit('call:end', { callId: testCallId, toUserId: bobUser.id, reason: 'Call ended' });
    await endPromise;

    // 14. Test Call Reject Flow
    console.log('--- Testing Call Reject Flow ---');
    const incomingPromise2 = new Promise((resolve) => {
      bobSocket.once('call:incoming', (payload) => {
        bobSocket.emit('call:reject', { callId: payload.callId, toUserId: aliceUser.id, reason: 'Busy now' });
        resolve(payload);
      });
    });

    const rejectPromise = new Promise((resolve) => {
      aliceSocket.once('call:rejected', (payload) => {
        console.log(`[PASS] Alice received call:rejected (reason: ${payload.reason})`);
        resolve(payload);
      });
    });

    aliceSocket.emit('call:initiate', { toUserId: bobUser.id });
    await Promise.all([incomingPromise2, rejectPromise]);

    // 15. Test Call Cancel Flow
    console.log('--- Testing Call Cancel Flow ---');
    const cancelPromise = new Promise((resolve) => {
      bobSocket.once('call:cancelled', (payload) => {
        console.log(`[PASS] Bob received call:cancelled notification`);
        resolve(payload);
      });
    });

    aliceSocket.emit('call:initiate', { toUserId: bobUser.id });
    // Wait briefly then cancel
    await new Promise((r) => setTimeout(r, 50));
    aliceSocket.emit('call:cancel', { toUserId: bobUser.id });
    await cancelPromise;

    // Cleanup sockets and server
    aliceSocket.disconnect();
    bobSocket.disconnect();
    httpServer.close();

    console.log('\n======================================================');
    console.log('🎉 ALL STAGE 4 E2E & SIGNALING TESTS PASSED PERFECTLY!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ E2E Test Failed:', err);
    httpServer.close();
    process.exit(1);
  }
}

runE2ETests();
