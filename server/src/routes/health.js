import { Router } from 'express';

const router = Router();

/**
 * GET /api/health
 * Simple liveness check used by the frontend on Stage 1
 * to confirm the client <-> server connection works before
 * any real features (auth, presence, calling) are built.
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'voip-signaling-server',
    timestamp: new Date().toISOString(),
  });
});

export default router;
