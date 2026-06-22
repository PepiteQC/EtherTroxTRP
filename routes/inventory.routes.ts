// server/routes/inventory.routes.ts
import { Router } from 'express';
import { asyncHandler, NotFoundError, ValidationError } from '../lib/errors';
import { getDatabase } from '../persistence/DatabaseAdapter';
import { getLogger }   from '../lib/logger';

export const inventoryRouter = Router();

// ── Inventaire d'un joueur ──
inventoryRouter.get('/:playerId', asyncHandler(async (req, res) => {
  const db     = getDatabase();
  const result = db.findWhere('inventory', { owner_id: parseInt(req.params.playerId) });
  if (!result.success) throw new NotFoundError(`Inventaire joueur ${req.params.playerId}`);
  res.json({ success: true, items: result.data, count: result.data?.length ?? 0 });
}));

// ── Ajouter item ──
inventoryRouter.post('/:playerId/add', asyncHandler(async (req, res) => {
  const { item, quantity = 1, slot, metadata = '{}' } = req.body;
  if (!item) throw new ValidationError('item requis');

  const db = getDatabase();
  const result = db.insert('inventory', {
    owner_id: parseInt(req.params.playerId),
    item,
    quantity,
    slot:     slot ?? null,
    weight:   req.body.weight ?? 0,
    metadata,
  });

  if (!result.success) throw new ValidationError(result.error ?? 'Insertion échouée');

  getLogger().info('inventory:add', `+${quantity} ${item} → player ${req.params.playerId}`);
  res.json({ success: true, row: result.data });
}));

// ── Retirer item ──
inventoryRouter.post('/:playerId/remove', asyncHandler(async (req, res) => {
  const { itemId } = req.body;
  if (!itemId) throw new ValidationError('itemId requis');

  const db     = getDatabase();
  const result = db.delete('inventory', itemId);
  if (!result.success) throw new NotFoundError(`Item ${itemId}`);

  getLogger().info('inventory:remove', `Item ${itemId} retiré de ${req.params.playerId}`);
  res.json({ success: true });
}));

// ── Utiliser item ──
inventoryRouter.post('/:playerId/use', asyncHandler(async (req, res) => {
  const { itemId } = req.body;
  if (!itemId) throw new ValidationError('itemId requis');

  // Logique d'utilisation selon le type d'item
  const db     = getDatabase();
  const itemResult = db.findById('inventory', itemId);
  if (!itemResult.success || !itemResult.data) throw new NotFoundError(`Item ${itemId}`);

  const item = itemResult.data;
  const response: any = { success: true, item, effect: null };

  // Effets selon catégorie
  switch (item.item) {
    case 'tool_medical_kit':
      response.effect = { type: 'heal', amount: 50 };
      break;
    case 'tool_defibrillator':
      response.effect = { type: 'revive', target: req.body.targetId };
      break;
    default:
      response.effect = { type: 'use', item: item.item };
  }

  getLogger().info('inventory:use', `Used ${item.item} by ${req.params.playerId}`);
  res.json(response);
}));

// ── Transférer item ──
inventoryRouter.post('/:playerId/transfer', asyncHandler(async (req, res) => {
  const { itemId, targetPlayerId } = req.body;
  if (!itemId || !targetPlayerId) throw new ValidationError('itemId + targetPlayerId requis');

  const db   = getDatabase();
  const item = db.findById('inventory', itemId);
  if (!item.success) throw new NotFoundError(`Item ${itemId}`);
  if (String(item.data?.owner_id) !== req.params.playerId) {
    throw new ValidationError('Cet item ne vous appartient pas');
  }

  const result = db.update('inventory', itemId, { owner_id: parseInt(targetPlayerId) });
  if (!result.success) throw new ValidationError('Transfert échoué');

  getLogger().info('inventory:transfer', `${itemId} → ${targetPlayerId}`);
  res.json({ success: true, row: result.data });
}));