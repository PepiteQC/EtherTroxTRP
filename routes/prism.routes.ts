// server/routes/prism.routes.ts
import { Router } from 'express';
import { asyncHandler, NotFoundError, ValidationError } from '../lib/errors';
import { getDatabase } from '../persistence/DatabaseAdapter';
import { seedWorldData } from '../persistence/world-seed';
import { getLogger }   from '../lib/logger';

export const prismRouter = Router();

const db = () => getDatabase();

// ── Stats ──
prismRouter.get('/tables', asyncHandler(async (_req, res) => {
  res.json(db().getStats());
}));

// ── CRUD Générique ──
prismRouter.get('/:table', asyncHandler(async (req, res) => {
  const result = db().findAll(req.params.table);
  if (!result.success) throw new NotFoundError(`Table ${req.params.table}`);
  res.json({ table: req.params.table, rows: result.data, count: result.count });
}));

prismRouter.get('/:table/:id', asyncHandler(async (req, res) => {
  const result = db().findById(req.params.table, req.params.id);
  if (!result.success) throw new NotFoundError(`${req.params.table}#${req.params.id}`);
  res.json({ table: req.params.table, row: result.data });
}));

prismRouter.post('/:table', asyncHandler(async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    throw new ValidationError('Body requis');
  }
  const result = db().insert(req.params.table, req.body);
  if (!result.success) throw new ValidationError(result.error ?? 'Insert échoué');
  getLogger().info('prism:insert', `INSERT ${req.params.table}`, { id: result.data?.id });
  res.status(201).json({ success: true, row: result.data });
}));

prismRouter.put('/:table/:id', asyncHandler(async (req, res) => {
  const result = db().update(req.params.table, req.params.id, req.body);
  if (!result.success) throw new NotFoundError(`${req.params.table}#${req.params.id}`);
  res.json({ success: true, row: result.data });
}));

prismRouter.delete('/:table/:id', asyncHandler(async (req, res) => {
  const result = db().delete(req.params.table, req.params.id);
  if (!result.success) throw new NotFoundError(`${req.params.table}#${req.params.id}`);
  res.json({ success: true });
}));

// ── Admin ──
prismRouter.post('/admin/seed', asyncHandler(async (_req, res) => {
  db().seed();
  const worldResult = seedWorldData(db());
  getLogger().info('prism:seed', 'DB seeded');
  res.json({ success: true, message: 'DB seeded!', worldSeed: worldResult });
}));

prismRouter.post('/admin/seed-world', asyncHandler(async (_req, res) => {
  const result = seedWorldData(db());
  res.json({ success: true, ...result });
}));

prismRouter.post('/admin/create-table', asyncHandler(async (req, res) => {
  if (!req.body.name) throw new ValidationError('name requis');
  const result = db().createTable(req.body.name);
  if (!result.success) throw new ValidationError(result.error ?? 'Création échouée');
  res.json({ success: true });
}));

prismRouter.delete('/admin/drop-table/:name', asyncHandler(async (req, res) => {
  const result = db().dropTable(req.params.name);
  if (!result.success) throw new ValidationError(result.error ?? 'Drop échoué');
  res.json({ success: true });
}));

prismRouter.post('/admin/truncate/:name', asyncHandler(async (req, res) => {
  const result = db().truncateTable(req.params.name);
  if (!result.success) throw new ValidationError(result.error ?? 'Truncate échoué');
  res.json({ success: true });
}));