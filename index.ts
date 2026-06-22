// server/index.ts
// ============================================================
//  POINT D'ENTRÉE — 50 lignes, rien d'autre
//  Toute la logique est dans bootstrap.ts
// ============================================================

import 'dotenv/config';
import { bootstrap } from './bootstrap.js';

bootstrap().catch((err: Error) => {
  console.error('[Server] 💥 Échec du démarrage:', err.message);
  console.error(err.stack);
  process.exit(1);
});

