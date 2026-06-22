// server/routes/property.routes.ts
// ============================================================
//  PROPERTY ROUTES — Immobilier RP TroxT City
// ============================================================

import { Router } from 'express';
import { asyncHandler, NotFoundError, ValidationError } from '../lib/errors.js';
import { getDatabase }  from '../persistence/DatabaseAdapter.js';
import { getGateway }   from '../network/WebSocketGateway.js';
import { getSettings }  from '../lib/settings.js';
import { getLogger }    from '../lib/logger.js';
import { createPacket } from '../../shared/utils.js';

export const propertyRouter = Router();

// ── Catalogue ─────────────────────────────────────────────
propertyRouter.get('/catalog', asyncHandler(async (_req, res) => {
  try {
    const { getCatalog } = await import('../modules/TroxTMod/world-registry.js');
    const catalog = getCatalog?.() ?? [];
    res.json({ success: true, catalog, count: catalog.length });
  } catch {
    const db     = getDatabase();
    const result = db.findAll('properties');
    res.json({
      success: true,
      catalog: result.data ?? [],
      count:   result.count ?? 0,
    });
  }
}));

// ── Stats ─────────────────────────────────────────────────
propertyRouter.get('/stats', asyncHandler(async (_req, res) => {
  const db    = getDatabase();
  const props = db.findAll('properties').data ?? [];

  const stats = {
    total:   props.length,
    owned:   props.filter((p: any) => p.owner_id).length,
    forSale: props.filter((p: any) => p.for_sale).length,
    forRent: props.filter((p: any) => p.for_rent).length,
    vacant:  props.filter((p: any) => !p.owner_id).length,
    byType:  props.reduce((acc: any, p: any) => {
      const t = p.type ?? 'unknown';
      acc[t]  = (acc[t] ?? 0) + 1;
      return acc;
    }, {}),
  };

  res.json({ success: true, stats });
}));

// ── Liste ─────────────────────────────────────────────────
propertyRouter.get('/', asyncHandler(async (req, res) => {
  const db      = getDatabase();
  const ownerId = req.query.ownerId as string | undefined;
  const type    = req.query.type    as string | undefined;
  const forSale = req.query.forSale as string | undefined;
  const forRent = req.query.forRent as string | undefined;

  let props = db.findAll('properties').data ?? [];

  if (ownerId)            props = props.filter((p: any) => p.owner_id === ownerId);
  if (type)               props = props.filter((p: any) => p.type    === type);
  if (forSale === 'true') props = props.filter((p: any) => p.for_sale);
  if (forRent === 'true') props = props.filter((p: any) => p.for_rent);

  res.json({ success: true, properties: props, count: props.length });
}));

// ── Une propriété ─────────────────────────────────────────
propertyRouter.get('/:id', asyncHandler(async (req, res) => {
  const db     = getDatabase();
  const result = db.findById('properties', req.params.id);

  if (!result.success || !result.data) {
    throw new NotFoundError(`Propriété ${req.params.id}`);
  }

  const furniture = db.findWhere?.('furniture',     { property_id: parseInt(req.params.id) });
  const keys      = db.findWhere?.('property_keys', { property_id: parseInt(req.params.id) });

  res.json({
    success:   true,
    property:  result.data,
    furniture: furniture?.data ?? [],
    keys:      keys?.data      ?? [],
    keyCount:  keys?.count     ?? 0,
  });
}));

// ── Créer ─────────────────────────────────────────────────
propertyRouter.post('/', asyncHandler(async (req, res) => {
  const settings = getSettings();
  if (!settings.property?.enabled) {
    throw new ValidationError('Système immobilier désactivé');
  }

  const { name, type, address, price, rent, ownerId, forSale, forRent, position, size, sector } = req.body;

  if (!name) throw new ValidationError('name requis');
  if (!type) throw new ValidationError('type requis');

  const db     = getDatabase();
  const result = db.insert('properties', {
    name,
    type,
    address:    address  ?? '',
    price:      price    ?? 0,
    rent:       rent     ?? 0,
    owner_id:   ownerId  ?? null,
    for_sale:   forSale  ?? false,
    for_rent:   forRent  ?? false,
    position:   JSON.stringify(position ?? [0, 0, 0]),
    size:       JSON.stringify(size     ?? { width: 10, height: 5, depth: 10 }),
    sector:     sector   ?? 'downtown',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!result.success) throw new ValidationError(result.error ?? 'Erreur création');

  getLogger().info('property.create', `Created: ${name}`);
  res.status(201).json({ success: true, property: result.data });
}));

// ── Acheter ───────────────────────────────────────────────
propertyRouter.post('/:id/buy', asyncHandler(async (req, res) => {
  const { playerId, playerName } = req.body;
  if (!playerId) throw new ValidationError('playerId requis');

  const db         = getDatabase();
  const settings   = getSettings();
  const gateway    = getGateway();
  const propResult = db.findById('properties', req.params.id);

  if (!propResult.success || !propResult.data) {
    throw new NotFoundError(`Propriété ${req.params.id}`);
  }

  const prop = propResult.data as any;

  if (!prop.for_sale) throw new ValidationError('Propriété non disponible à la vente');
  if (prop.owner_id && prop.owner_id !== playerId) {
    throw new ValidationError('Propriété déjà possédée');
  }

  const maxProps   = settings.property?.maxPerPlayer ?? 3;
  const owned      = (db.findWhere?.('properties', { owner_id: playerId })?.count ?? 0);
  if (owned >= maxProps) {
    throw new ValidationError(`Limite: ${maxProps} propriétés max`);
  }

  const updateResult = db.update('properties', req.params.id, {
    owner_id:   playerId,
    for_sale:   false,
    bought_at:  new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!updateResult.success) throw new ValidationError('Erreur achat');

  db.insert('property_keys', {
    property_id: parseInt(req.params.id),
    holder_id:   playerId,
    type:        'master',
    created_at:  new Date().toISOString(),
  });

  gateway.broadcast(createPacket('CHAT', {
    sender: '🏠 Immobilier',
    text:   `${playerName ?? playerId} a acheté "${prop.name}"!`,
    type:   'system',
  }));

  getLogger().info('property.buy', `${playerId} -> prop ${req.params.id}`);
  res.json({ success: true, property: updateResult.data });
}));

// ── Vendre ────────────────────────────────────────────────
propertyRouter.post('/:id/sell', asyncHandler(async (req, res) => {
  const { playerId, price } = req.body;
  if (!playerId) throw new ValidationError('playerId requis');

  const db         = getDatabase();
  const propResult = db.findById('properties', req.params.id);

  if (!propResult.success || !propResult.data) {
    throw new NotFoundError(`Propriété ${req.params.id}`);
  }

  const prop = propResult.data as any;
  if (prop.owner_id !== playerId) {
    throw new ValidationError('Vous ne possédez pas cette propriété');
  }

  const result = db.update('properties', req.params.id, {
    for_sale:   true,
    price:      price ?? prop.price,
    updated_at: new Date().toISOString(),
  });

  res.json({ success: true, property: result.data });
}));

// ── Louer ─────────────────────────────────────────────────
propertyRouter.post('/:id/rent', asyncHandler(async (req, res) => {
  const { playerId } = req.body;
  if (!playerId) throw new ValidationError('playerId requis');

  const db         = getDatabase();
  const settings   = getSettings();
  const propResult = db.findById('properties', req.params.id);

  if (!propResult.success || !propResult.data) {
    throw new NotFoundError(`Propriété ${req.params.id}`);
  }

  const prop = propResult.data as any;
  if (!prop.for_rent) throw new ValidationError('Propriété non disponible à la location');

  const interval = settings.property?.rentPaymentIntervalMs ?? 3_600_000;

  db.insert('leases', {
    property_id:  parseInt(req.params.id),
    tenant_id:    playerId,
    rent_amount:  prop.rent ?? 0,
    start_date:   new Date().toISOString(),
    next_payment: new Date(Date.now() + interval).toISOString(),
  });

  db.insert('property_keys', {
    property_id: parseInt(req.params.id),
    holder_id:   playerId,
    type:        'tenant',
    created_at:  new Date().toISOString(),
  });

  res.json({
    success:     true,
    message:     `Location de "${prop.name}" confirmée`,
    rent:        prop.rent,
    nextPayment: new Date(Date.now() + interval).toISOString(),
  });
}));

// ── Meubles ───────────────────────────────────────────────
propertyRouter.get('/:id/furniture', asyncHandler(async (req, res) => {
  const db     = getDatabase();
  const result = db.findWhere?.('furniture', { property_id: parseInt(req.params.id) });
  res.json({ success: true, furniture: result?.data ?? [], count: result?.count ?? 0 });
}));

propertyRouter.post('/:id/furniture', asyncHandler(async (req, res) => {
  const { itemId, room, position, rotation, placedBy } = req.body;
  if (!itemId) throw new ValidationError('itemId requis');

  const db     = getDatabase();
  const result = db.insert('furniture', {
    property_id: parseInt(req.params.id),
    item_id:     itemId,
    room:        room     ?? 'main',
    position:    JSON.stringify(position ?? [0, 0, 0]),
    rotation:    JSON.stringify(rotation ?? [0, 0, 0]),
    placed_by:   placedBy ?? 'server',
    placed_at:   new Date().toISOString(),
  });

  if (!result.success) throw new ValidationError(result.error ?? 'Erreur placement');

  res.status(201).json({ success: true, furniture: result.data });
}));

propertyRouter.delete('/:id/furniture/:furnitureId', asyncHandler(async (req, res) => {
  const db     = getDatabase();
  const result = db.delete('furniture', req.params.furnitureId);
  if (!result.success) throw new NotFoundError(`Meuble ${req.params.furnitureId}`);
  res.json({ success: true });
}));

// ── Clés ─────────────────────────────────────────────────
propertyRouter.get('/:id/keys', asyncHandler(async (req, res) => {
  const db     = getDatabase();
  const result = db.findWhere?.('property_keys', { property_id: parseInt(req.params.id) });
  res.json({ success: true, keys: result?.data ?? [], count: result?.count ?? 0 });
}));

propertyRouter.post('/:id/keys/duplicate', asyncHandler(async (req, res) => {
  const { forPlayerId } = req.body;
  if (!forPlayerId) throw new ValidationError('forPlayerId requis');

  const settings = getSettings();
  const cost     = settings.property?.keyDuplicateCost ?? 500;
  const db       = getDatabase();

  const result = db.insert('property_keys', {
    property_id: parseInt(req.params.id),
    holder_id:   forPlayerId,
    type:        'copy',
    cost,
    created_at:  new Date().toISOString(),
  });

  if (!result.success) throw new ValidationError(result.error ?? 'Erreur duplication');

  res.status(201).json({ success: true, key: result.data, cost });
}));

propertyRouter.delete('/:id/keys/:keyId', asyncHandler(async (req, res) => {
  const db     = getDatabase();
  const result = db.delete('property_keys', req.params.keyId);
  if (!result.success) throw new NotFoundError(`Clé ${req.params.keyId}`);
  res.json({ success: true });
}));

// ── Vérifier accès ────────────────────────────────────────
propertyRouter.post('/:id/access/check', asyncHandler(async (req, res) => {
  const { playerId } = req.body;
  if (!playerId) throw new ValidationError('playerId requis');

  const db     = getDatabase();
  const result = db.findById('properties', req.params.id);

  if (!result.success || !result.data) {
    throw new NotFoundError(`Propriété ${req.params.id}`);
  }

  const prop    = result.data as any;
  const isOwner = prop.owner_id === playerId;
  const keys    = db.findWhere?.('property_keys', {
    property_id: parseInt(req.params.id),
    holder_id:   playerId,
  });
  const hasKey  = (keys?.count ?? 0) > 0;

  res.json({
    success:   true,
    hasAccess: isOwner || hasKey,
    isOwner,
    hasKey,
    keyType:   keys?.data?.[0]?.type ?? null,
  });
}));

// ── Modifier ─────────────────────────────────────────────
propertyRouter.patch('/:id', asyncHandler(async (req, res) => {
  const db     = getDatabase();
  const result = db.update('properties', req.params.id, {
    ...req.body,
    updated_at: new Date().toISOString(),
  });
  if (!result.success) throw new NotFoundError(`Propriété ${req.params.id}`);
  res.json({ success: true, property: result.data });
}));

// ── Supprimer ─────────────────────────────────────────────
propertyRouter.delete('/:id', asyncHandler(async (req, res) => {
  const db = getDatabase();

  const furn = db.findWhere?.('furniture',     { property_id: parseInt(req.params.id) });
  const keys = db.findWhere?.('property_keys', { property_id: parseInt(req.params.id) });

  furn?.data?.forEach((f: any) => db.delete('furniture',     String(f.id)));
  keys?.data?.forEach((k: any) => db.delete('property_keys', String(k.id)));

  const result = db.delete('properties', req.params.id);
  if (!result.success) throw new NotFoundError(`Propriété ${req.params.id}`);

  res.json({ success: true });
}));