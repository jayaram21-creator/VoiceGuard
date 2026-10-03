import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

import "./db/index.js"; // side-effect import: opens the DB and ensures tables exist
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import contactsRouter from "./routes/contacts.js";
import { socketAuthMiddleware } from "./socket/auth.js";
import { setupSignaling } from "./socket/signaling.js";

const PORT = process.env.PORT || 5001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();

// --- Middleware ---
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());

// --- REST routes ---
app.use("/api", healthRouter);
app.use("/api", authRouter);
app.use("/api", contactsRouter);

// --- HTTP + Socket.IO server ---
// We wrap Express in a plain http.Server because Socket.IO needs
// to attach to the same underlying server instance as Express.
const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    credentials: true,
  },
});

// Stage 2: every socket connection must present a valid JWT
// (client connects with `io(url, { auth: { token } })`). Invalid or
// missing tokens are rejected before `connection` ever fires.
io.use(socketAuthMiddleware);

// Setup presence, call lifecycle, and WebRTC signaling relay
setupSignaling(io);

httpServer.listen(PORT, () => {
  console.log(`Signaling server listening on http://localhost:${PORT}`);
});
