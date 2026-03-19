import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../lib/db.js');

// GET /api/radar/positions – positions actives (< 30 min)
export const GET: APIRoute = () => {
  const rows = db.prepare(`
    SELECT session_id, pseudo, moto_marque, moto_cylindree, lat, lng, updated_at
    FROM radar_positions
    WHERE updated_at >= datetime('now', '-30 minutes')
    ORDER BY updated_at DESC
  `).all();

  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
