import { Router } from 'express';

export default function worldRoutes(engine) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      ok: true,
      world: engine.world,
      state: engine.state,
      players: [...engine.players.values()],
      buildObjects: [...engine.buildObjects.values()],
    });
  });

  router.post('/weather', (req, res) => {
    const result = engine.setWeather(req.body?.weather);

    if (!result.ok) {
      return res.status(400).json(result);
    }

    res.json(result);
  });

  router.get('/players', (_req, res) => {
    res.json({
      ok: true,
      players: [...engine.players.values()],
    });
  });

  return router;
}