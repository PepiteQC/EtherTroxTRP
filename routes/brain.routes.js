import { Router } from 'express';

export default function brainRoutes(brain, thirdEye) {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json({
      ok: true,
      brain: brain.getSnapshot(),
      thirdEye: thirdEye.getSnapshot(),
    });
  });

  router.post('/process', async (req, res) => {
    const result = await brain.process(req.body?.prompt, {
      source: 'api',
      body: req.body,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    res.json(result);
  });

  router.get('/decisions', (_req, res) => {
    res.json({
      ok: true,
      decisions: brain.decisions,
    });
  });

  return router;
}