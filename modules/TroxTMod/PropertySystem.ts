// server/modules/TroxTMod/PropertySystem.ts
// ============================================================
//  TROXT RP — Property System Serveur
//  Achat, vente, location, clés, accès, sauvegarde
// ============================================================

import express from 'express';
import {
  PROPERTIES, FURNITURE,
  type PropertyDef, type PropertyStatus, type PropertyAccess,
  type AccessLevel, type DoorId, type KeyringItem, type PropertyDeed,
  type FurniturePlacement, type PropertySave,
} from '../../../shared/property-catalog';
import { EventBus } from '../../engine/EventBus';
import { DatabaseAdapter } from '../../persistence/DatabaseAdapter';

// ============================================================
//  PROPERTY REGISTRY — État runtime
// ============================================================

export class PropertyRegistry {
  private _properties: Map<string, PropertyDef>;

  constructor() {
    // Cloner le catalogue (on modifie les états en runtime)
    this._properties = new Map(
      PROPERTIES.map(p => [p.id, { ...p }])
    );
  }

  get(id: string): PropertyDef | undefined {
    return this._properties.get(id);
  }

  getAll(): PropertyDef[] {
    return Array.from(this._properties.values());
  }

  getForSale(): PropertyDef[] {
    return this.getAll().filter(p => p.status === 'for_sale');
  }

  getByOwner(ownerId: string): PropertyDef[] {
    return this.getAll().filter(p => p.ownerId === ownerId);
  }

  getByCategory(category: string): PropertyDef[] {
    return this.getAll().filter(p => p.category === category);
  }

  update(id: string, patch: Partial<PropertyDef>): PropertyDef | null {
    const prop = this._properties.get(id);
    if (!prop) return null;
    const updated = { ...prop, ...patch };
    this._properties.set(id, updated);
    return updated;
  }

  stats() {
    const all = this.getAll();
    return {
      total:    all.length,
      forSale:  all.filter(p => p.status === 'for_sale').length,
      sold:     all.filter(p => p.status === 'sold').length,
      forRent:  all.filter(p => p.status === 'for_rent').length,
      rented:   all.filter(p => p.status === 'rented').length,
    };
  }
}

// ============================================================
//  KEY SYSTEM
// ============================================================

export class KeySystem {
  private _keyrings: Map<string, KeyringItem[]> = new Map();

  createKeyring(playerId: string, propertyId: string, doors: DoorId[]): KeyringItem {
    const item: KeyringItem = {
      itemId:     `keyring_${propertyId}_${Date.now()}`,
      type:       'property_keyring',
      label:      `Trousseau — ${propertyId}`,
      propertyId,
      ownerId:    playerId,
      keys:       doors,
      issuedAt:   Date.now(),
      duplicate:  false,
    };

    if (!this._keyrings.has(playerId)) this._keyrings.set(playerId, []);
    this._keyrings.get(playerId)!.push(item);

    EventBus.getInstance().emit('property:key:issued', { playerId, propertyId, itemId: item.itemId });
    return item;
  }

  getKeyrings(playerId: string): KeyringItem[] {
    return this._keyrings.get(playerId) ?? [];
  }

  hasKeyForDoor(playerId: string, propertyId: string, doorId: DoorId): boolean {
    const rings = this._keyrings.get(playerId) ?? [];
    return rings.some(r => r.propertyId === propertyId && r.keys.includes(doorId));
  }

  removeKeyring(playerId: string, propertyId: string): boolean {
    const rings = this._keyrings.get(playerId) ?? [];
    const filtered = rings.filter(r => r.propertyId !== propertyId);
    this._keyrings.set(playerId, filtered);
    return filtered.length !== rings.length;
  }

  duplicateKey(
    fromPlayerId: string,
    toPlayerId:   string,
    propertyId:   string,
    doors:        DoorId[]
  ): KeyringItem | null {
    const original = (this._keyrings.get(fromPlayerId) ?? [])
      .find(r => r.propertyId === propertyId);
    if (!original) return null;

    const dup: KeyringItem = {
      ...original,
      itemId:    `keyring_dup_${propertyId}_${Date.now()}`,
      ownerId:   toPlayerId,
      keys:      doors,
      issuedAt:  Date.now(),
      duplicate: true,
    };

    if (!this._keyrings.has(toPlayerId)) this._keyrings.set(toPlayerId, []);
    this._keyrings.get(toPlayerId)!.push(dup);

    EventBus.getInstance().emit('property:key:duplicated', { fromPlayerId, toPlayerId, propertyId });
    return dup;
  }
}

// ============================================================
//  ACCESS SYSTEM
// ============================================================

export class AccessSystem {
  private _access: Map<string, PropertyAccess[]> = new Map();

  grant(
    propertyId: string,
    playerId:   string,
    level:      AccessLevel,
    doors:      DoorId[],
    grantedBy:  string,
    expiresAt?: number
  ): PropertyAccess {
    const access: PropertyAccess = {
      propertyId, playerId, level, doorIds: doors,
      grantedBy, grantedAt: Date.now(), expiresAt,
    };

    const key = `${propertyId}_${playerId}`;
    this._access.set(key, [access]);

    EventBus.getInstance().emit('property:access:granted', { propertyId, playerId, level });
    return access;
  }

  revoke(propertyId: string, playerId: string): boolean {
    const key = `${propertyId}_${playerId}`;
    const existed = this._access.has(key);
    this._access.delete(key);
    if (existed) EventBus.getInstance().emit('property:access:revoked', { propertyId, playerId });
    return existed;
  }

  getAccess(propertyId: string, playerId: string): PropertyAccess | null {
    const key = `${propertyId}_${playerId}`;
    const list = this._access.get(key);
    if (!list?.length) return null;
    const access = list[0];
    if (access.expiresAt && Date.now() > access.expiresAt) {
      this._access.delete(key);
      return null;
    }
    return access;
  }

  canEnter(propertyId: string, playerId: string, doorId: DoorId): boolean {
    const access = this.getAccess(propertyId, playerId);
    if (!access) return false;
    if (access.level === 'admin') return true;
    return access.doorIds.includes(doorId);
  }

  getLevel(propertyId: string, playerId: string): AccessLevel {
    return this.getAccess(propertyId, playerId)?.level ?? 'none';
  }
}

// ============================================================
//  FURNITURE SAVE SYSTEM
// ============================================================

export class FurnitureSaveSystem {
  private _saves: Map<string, PropertySave> = new Map();

  save(
    propertyId: string,
    ownerId:    string,
    furniture:  FurniturePlacement[],
    colors:     Record<string, string> = {}
  ): PropertySave {
    const save: PropertySave = {
      propertyId, ownerId, furniture, colors,
      savedAt: Date.now(),
      version: '5.0',
    };
    this._saves.set(propertyId, save);
    EventBus.getInstance().emit('property:furniture:saved', { propertyId, count: furniture.length });
    return save;
  }

  load(propertyId: string): PropertySave | null {
    return this._saves.get(propertyId) ?? null;
  }

  addFurniture(propertyId: string, ownerId: string, item: FurniturePlacement): void {
    const existing = this._saves.get(propertyId);
    if (!existing) {
      this.save(propertyId, ownerId, [item]);
      return;
    }
    existing.furniture.push(item);
    existing.savedAt = Date.now();
  }

  removeFurniture(propertyId: string, itemId: string): boolean {
    const save = this._saves.get(propertyId);
    if (!save) return false;
    const before = save.furniture.length;
    save.furniture = save.furniture.filter(f => f.itemId !== itemId);
    return save.furniture.length !== before;
  }

  getFurnitureCount(propertyId: string): number {
    return this._saves.get(propertyId)?.furniture.length ?? 0;
  }
}

// ============================================================
//  PROPERTY ROUTER — Express
// ============================================================

// Instances globales
const registry   = new PropertyRegistry();
const keySystem  = new KeySystem();
const access     = new AccessSystem();
const furniture  = new FurnitureSaveSystem();
const bus        = EventBus.getInstance();

export const propertyRouter = express.Router();

// ── Catalogue complet ──
propertyRouter.get('/catalog', (_req, res) => {
  res.json({
    success:    true,
    properties: registry.getAll(),
    furniture:  FURNITURE,
    stats:      registry.stats(),
  });
});

// ── Propriétés à vendre ──
propertyRouter.get('/for-sale', (_req, res) => {
  const category = _req.query.category as string;
  let props = registry.getForSale();
  if (category) props = props.filter(p => p.category === category);
  res.json({ success: true, count: props.length, properties: props });
});

// ── Détail d'une propriété ──
propertyRouter.get('/:id', (req, res) => {
  const prop = registry.get(req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Propriété introuvable' });
  res.json({ success: true, property: prop });
});

// ── Acheter ──
propertyRouter.post('/:id/buy', (req, res) => {
  const { playerId, playerName } = req.body;
  if (!playerId) return res.status(400).json({ success: false, error: 'playerId requis' });

  const prop = registry.get(req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Propriété introuvable' });
  if (prop.status !== 'for_sale') return res.status(400).json({ success: false, error: `Statut: ${prop.status}` });

  // Mettre à jour la propriété
  const updated = registry.update(req.params.id, {
    status:  'sold',
    ownerId: playerId,
  });

  // Créer trousseau de clés
  const keyring = keySystem.createKeyring(playerId, prop.id, prop.access.doors);

  // Créer acte de propriété
  const deed: PropertyDeed = {
    itemId:        `deed_${prop.id}_${Date.now()}`,
    type:          'property_deed',
    label:         `Acte de propriété — ${prop.nameFr}`,
    propertyId:    prop.id,
    ownerId:       playerId,
    purchasePrice: prop.price,
    purchaseDate:  new Date().toISOString(),
    notary:        'Me. TroxT & Associés',
  };

  // Accès complet au propriétaire
  access.grant(prop.id, playerId, 'owner', prop.access.doors, 'system');

  bus.emit('property:buy', { playerId, propertyId: prop.id, price: prop.price });

  res.json({
    success:  true,
    property: updated,
    keyring,
    deed,
    message:  `✅ Félicitations ! Vous êtes maintenant propriétaire de "${prop.nameFr}"`,
  });
});

// ── Vendre (remettre en vente) ──
propertyRouter.post('/:id/sell', (req, res) => {
  const { playerId, price } = req.body;
  const prop = registry.get(req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Introuvable' });
  if (prop.ownerId !== playerId) return res.status(403).json({ success: false, error: 'Pas votre propriété' });

  const finalPrice = price ?? prop.price;
  const updated = registry.update(req.params.id, {
    status:  'for_sale',
    ownerId: undefined,
    price:   finalPrice,
  });

  access.revoke(prop.id, playerId);
  keySystem.removeKeyring(playerId, prop.id);

  bus.emit('property:sell', { playerId, propertyId: prop.id, price: finalPrice });

  res.json({ success: true, property: updated, message: 'Propriété remise en vente.' });
});

// ── Louer ──
propertyRouter.post('/:id/rent', (req, res) => {
  const { playerId } = req.body;
  const prop = registry.get(req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Introuvable' });
  if (prop.status !== 'for_rent') return res.status(400).json({ success: false, error: 'Non disponible à la location' });
  if (!prop.rentPrice) return res.status(400).json({ success: false, error: 'Prix de location non défini' });

  const updated = registry.update(req.params.id, {
    status:   'rented',
    tenantId: playerId,
  });

  const keyring = keySystem.createKeyring(playerId, prop.id, ['front_door', 'back_door', 'mailbox']);
  access.grant(prop.id, playerId, 'tenant', ['front_door', 'back_door', 'mailbox'], prop.ownerId ?? 'system');

  bus.emit('property:rent', { playerId, propertyId: prop.id, price: prop.rentPrice });

  res.json({
    success:    true,
    property:   updated,
    keyring,
    monthlyRent: prop.rentPrice,
    message:    `🏠 Vous êtes maintenant locataire de "${prop.nameFr}"`,
  });
});

// ── Donner accès ──
propertyRouter.post('/:id/access/grant', (req, res) => {
  const { ownerId, guestId, level, doors, expiresAt } = req.body;
  const prop = registry.get(req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Introuvable' });
  if (prop.ownerId !== ownerId) return res.status(403).json({ success: false, error: 'Pas propriétaire' });

  const granted = access.grant(
    prop.id, guestId,
    (level as AccessLevel) ?? 'guest',
    (doors as DoorId[]) ?? ['front_door'],
    ownerId, expiresAt
  );

  if (level !== 'none') {
    keySystem.duplicateKey(ownerId, guestId, prop.id, (doors as DoorId[]) ?? ['front_door']);
  }

  res.json({ success: true, access: granted });
});

// ── Révoquer accès ──
propertyRouter.post('/:id/access/revoke', (req, res) => {
  const { ownerId, guestId } = req.body;
  const prop = registry.get(req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Introuvable' });
  if (prop.ownerId !== ownerId) return res.status(403).json({ success: false, error: 'Pas propriétaire' });

  access.revoke(prop.id, guestId);
  keySystem.removeKeyring(guestId, prop.id);

  res.json({ success: true, message: `Accès révoqué pour ${guestId}` });
});

// ── Vérifier accès ──
propertyRouter.get('/:id/access/:playerId', (req, res) => {
  const level  = access.getLevel(req.params.id, req.params.playerId);
  const prop   = registry.get(req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Introuvable' });

  res.json({
    success: true,
    level,
    canEnter: level !== 'none',
    isOwner:  prop.ownerId === req.params.playerId,
  });
});

// ── Meubles ──
propertyRouter.get('/:id/furniture', (req, res) => {
  const save = furniture.load(req.params.id);
  res.json({ success: true, save, count: save?.furniture.length ?? 0 });
});

propertyRouter.post('/:id/furniture', (req, res) => {
  const { ownerId, placements, colors } = req.body;
  const prop = registry.get(req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Introuvable' });
  if (prop.ownerId !== ownerId) return res.status(403).json({ success: false, error: 'Pas propriétaire' });

  const maxFurniture = prop.features.maxFurniture;
  if (placements.length > maxFurniture) {
    return res.status(400).json({ success: false, error: `Maximum ${maxFurniture} meubles pour cette propriété` });
  }

  const save = furniture.save(req.params.id, ownerId, placements, colors ?? {});
  res.json({ success: true, save });
});

propertyRouter.delete('/:id/furniture/:itemId', (req, res) => {
  const ok = furniture.removeFurniture(req.params.id, req.params.itemId);
  res.json({ success: ok });
});

// ── Clés ──
propertyRouter.get('/keys/:playerId', (req, res) => {
  const keyrings = keySystem.getKeyrings(req.params.playerId);
  res.json({ success: true, count: keyrings.length, keyrings });
});

propertyRouter.post('/:id/keys/check', (req, res) => {
  const { playerId, doorId } = req.body;
  const hasKey = keySystem.hasKeyForDoor(playerId, req.params.id, doorId as DoorId);
  res.json({ success: true, hasKey });
});

// ── Stats ──
propertyRouter.get('/meta/stats', (_req, res) => {
  res.json({
    success:       true,
    propertyStats: registry.stats(),
    furnitureCount: FURNITURE.length,
    categories:    [...new Set(PROPERTIES.map(p => p.category))],
    priceRange: {
      min: Math.min(...PROPERTIES.map(p => p.price)),
      max: Math.max(...PROPERTIES.map(p => p.price)),
    },
  });
});

// ── Catalogue meubles ──
propertyRouter.get('/furniture/catalog', (req, res) => {
  const room = req.query.room as string;
  let items = FURNITURE;
  if (room) items = items.filter(f => f.room === room || f.category === room);
  res.json({ success: true, count: items.length, furniture: items });
});