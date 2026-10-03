# VoiceGuard — AI-Powered Real-Time VoIP & Voice Cloning Impersonation Attack Prevention (SIH26104)

Smart India Hackathon project. This repository contains the complete integrated **VoiceGuard** system, combining **Real-Time WebRTC Voice Calling** with an **AASIST (Audio Anti-Spoofing using Integrated Spectro-Temporal Graph Attention Networks)** neural anti-spoofing engine for live detection of AI-generated synthetic and cloned voices.

---

## 1. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Browser A (Caller / Peer)                       │
│  - React 19 + Vite Frontend                                            │
│  - RTCPeerConnection (STUN: stun.l.google.com:19302)                   │
│  - MediaDevices.getUserMedia({ audio: true })                          │
│  - Web Audio API Live RMS Level Meter                                  │
│  - VoiceGuard Security Panel (AASIST Live Shield)                      │
└──────────────┬─────────────────────────┬───────────────────────────────┘
               │                         │
               │ (Socket.IO Signaling)   │  (Direct WebRTC P2P Voice)
               │ (offer, answer, ICE)    │  (RTP / SRTP Opus Audio)
               ▼                         │
┌──────────────────────────────┐         │
│  Node.js + Express Backend   │         │
│  - Socket.IO Signaling Relay │         │
│  - JWT Handshake Auth        │         │
│  - Presence & Contacts Store │         │
│  - SQLite (users, contacts)  │         │
└──────────────┬───────────────┘         │
               │                         │
               │ (Socket.IO Signaling)   │
               │ (offer, answer, ICE)    │
               ▼                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Browser B (Callee / Peer)                       │
│  - React 19 + Vite Frontend                                            │
│  - RTCPeerConnection (STUN: stun.l.google.com:19302)                   │
│  - MediaDevices.getUserMedia({ audio: true })                          │
│  - Web Audio API Live RMS Level Meter                                  │
│  - VoiceGuard Security Panel (AASIST Live Shield)                      │
└────────────────────────────────────────┬───────────────────────────────┘
                                         │
                                         │ (Rolling 4s Audio Chunks, HTTP POST)
                                         ▼
                      ┌────────────────────────────────────┐
                      │    FastAPI AASIST AI Service       │
                      │    - Port 8000                     │
                      │    - PyTorch Graph Attention Net   │
                      │    - 64,600 sample tensor @ 16kHz  │
                      │    - Real-Time Risk Engine         │
                      │      (LOW / MEDIUM / HIGH)         │
                      └────────────────────────────────────┘
```

### Key Architectural Highlights

1. **Separation of Media & Security**:
   - WebRTC voice stream flows directly browser-to-browser peer-to-peer.
   - AI analysis operates as an asynchronous, non-intrusive parallel buffer (rolling 4s window with 2.5s intervals).
   - If the AI service is slow or unavailable, the voice call proceeds uninterrupted.
2. **Native AASIST Model**:
   - Utilizes `AASIST_finetuned.pth` trained on genuine human speech and state-of-the-art TTS/voice-cloning synthesis attacks.
   - Evaluates 64,600 raw audio samples (4.0375s @ 16 kHz) through graph neural network attention layers.
3. **Advisory Threat Classification**:
   - **LOW Risk (`< 0.35`)**: `LIKELY REAL` — Action: `ALLOW` (Green Shield).
   - **MEDIUM Risk (`0.35 - 0.65`)**: `SUSPICIOUS` — Action: `CHALLENGE / VERIFY` (Amber Warning).
   - **HIGH Risk (`>= 0.65`)**: `LIKELY SPOOFED` — Action: `BLOCK / CHALLENGE` (Red Threat Alert).

---

## 2. Directory Structure

```
project/
├── ai-service/                  Python FastAPI AASIST Anti-Spoofing Service
│   ├── models/
│   │   ├── AASIST_finetuned.pth Finetuned AASIST weights (default)
│   │   └── AASIST.pth           Base AASIST weights
│   ├── src/
│   │   ├── aasist.py            AASIST model architecture (PyTorch)
│   │   ├── config.py            AASIST model hyperparameter configuration
│   │   └── predict.py           Inference, windowing & risk classification
│   ├── data/
│   │   └── eval/                Benchmark real & cloned audio samples
│   ├── main.py                  FastAPI server entrypoint (port 8000)
│   └── test_integrated_ai.py    Automated AI integration verification test
│
├── client/                      React 19 + Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActiveCallModal.jsx        Active call interface & controls
│   │   │   ├── ContactsPanel.jsx          Contacts list & search panel
│   │   │   └── VoiceGuardSecurityPanel.jsx Live AASIST threat panel
│   │   ├── context/
│   │   │   ├── AuthContext.jsx            JWT auth session gate
│   │   │   └── CallContext.jsx            Call lifecycle & signaling coordinator
│   │   ├── hooks/
│   │   │   ├── useWebRTC.js               RTCPeerConnection & RMS meter hook
│   │   │   └── useAASISTAnalyzer.js       Rolling audio chunk capture & AI client
│   │   ├── pages/
│   │   │   ├── HomePage.jsx               Main VoIP Dashboard
│   │   │   ├── LoginPage.jsx              Login Screen
│   │   │   └── RegisterPage.jsx           Register Screen
│   │   ├── services/
│   │   │   ├── api.js                     REST API client
│   │   │   └── socket.js                  Authenticated Socket.IO singleton
│   │   ├── App.css                        Modern dark-mode glassmorphic styling
│   │   └── App.jsx
│   ├── .env.example
│   └── package.json
│
├── server/                      Node.js + Express + Socket.IO Backend
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.js          Auth endpoints (register, login, me)
│   │   │   └── contactsController.js      Contacts & user search endpoints
│   │   ├── db/
│   │   │   └── index.js                   SQLite database schema
│   │   ├── middleware/
│   │   │   └── requireAuth.js             JWT authentication middleware
│   │   ├── routes/
│   │   │   ├── auth.js                    /api/auth routes
│   │   │   ├── contacts.js                /api/contacts routes
│   │   │   └── health.js                  /api/health check
│   │   ├── socket/
│   │   │   ├── auth.js                    Socket.IO JWT handshake middleware
│   │   │   ├── presence.js                Online users & active calls tracker
│   │   │   └── signaling.js               WebRTC signaling relay
│   │   ├── server.js                      Express + Socket.IO bootstrap
│   │   ├── test_stage4_e2e.js             Automated WebRTC signaling test
│   │   └── test_audio_flow.js             Audio RMS & mute logic test
│   ├── .env.example
│   └── package.json
│
├── database/                    SQLite persistence folder
├── package_stage4.ps1           ZIP packaging script
└── README.md
```

---

## 3. How to Install and Run

### Prerequisites

- Python 3.10+ (with `torch`, `fastapi`, `uvicorn`, `miniaudio`, `numpy`)
- Node.js 18+
- npm 9+

---

### Step 1: Start the Python AI Service

```bash
cd ai-service
# Install requirements if needed:
pip install fastapi uvicorn miniaudio torch numpy
# Start the AI service:
python main.py
```

> The AI service will listen on `http://localhost:8000`.

---

### Step 2: Start the Backend Signaling Server

In a new terminal:

```bash
cd server
npm install
cp .env.example .env
npm run dev
# or: node src/server.js
```

> The backend will listen on `http://localhost:5001`.

---

### Step 3: Start the React Frontend

In a new terminal:

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

> The frontend will open on `http://localhost:5173`.

---

## 4. Two-Browser Testing & Demonstration Procedure

### 1. Establish a WebRTC Call

1. Open Browser Window 1 (e.g., Chrome) at `http://localhost:5173` and log in as `carol` (`carol@test.com` / `password123`).
2. Open Browser Window 2 (e.g., Incognito) at `http://localhost:5173` and log in as `jayaram` (`jayaram@test.com` / `password123`).
3. In Window 1 (`carol`), click `[ 📞 Call ]` next to `jayaram`.
4. In Window 2 (`jayaram`), click `[ Accept ]` on the incoming call modal.
5. Both browsers connect via WebRTC with live two-way Opus audio.

### 2. Observe Real-Time AASIST Voice Shield

1. During the call, observe the **VoiceGuard AI Anti-Spoofing** panel inside the active call modal.
2. **Speak into the microphone**:
   - The AI analyzer evaluates voice chunks in the background.
   - Result: **`✓ LIKELY REAL`**, **`RISK: LOW`**, Spoof probability: `0.0%`, Action: **`ALLOW`**.
3. **Test Cloned Voice Detection (Demo Trigger)**:
   - Click `[ 🚨 Test Cloned AI Sample ]`.
   - The AASIST model immediately evaluates the benchmark synthetic clone sample.
   - Result: **`🚨 LIKELY SPOOFED`**, **`RISK: HIGH`**, Spoof probability: `99.9%`, Action: **`BLOCK / CHALLENGE`**.
4. **Restore Genuine Verification**:
   - Click `[ 🎯 Test Genuine Voice Sample ]`.
   - The panel immediately returns to **`✓ LIKELY REAL`**, **`RISK: LOW`**, Action: **`ALLOW`**.
5. **Call Controls & Teardown**:
   - Click `[ Mute ]` → microphone is muted while WebRTC and AI panel remain active.
   - Click `[ End Call ]` → peer connection, audio streams, and background analyzers are cleanly terminated.

---

## 5. Automated Verification Test Suites

### 1. AI Anti-Spoofing Model & API Verification:

```bash
cd ai-service
python test_integrated_ai.py
```

**Results:**

- ✅ Healthcheck & Model Loading (`AASIST_finetuned`)
- ✅ Real Audio Chunk Analysis (`LOW` Risk, `0.0%` Spoof, `278ms` latency)
- ✅ Cloned Audio Chunk Analysis (`HIGH` Risk, `100.0%` Spoof, `267ms` latency)
- ✅ Demo Evaluation Endpoints

### 2. VoIP WebRTC Signaling & Lifecycle Verification:

```bash
cd server
node src/test_stage4_e2e.js
```

**Results:**

- ✅ User Registration, Auth & User Search
- ✅ Authenticated Socket.IO Presence
- ✅ Call Initiation, Ringing & Acceptance
- ✅ WebRTC SDP Offer / Answer Exchange
- ✅ WebRTC ICE Candidate Relay (Bidirectional)
- ✅ Call Termination, Reject, and Cancel handling
