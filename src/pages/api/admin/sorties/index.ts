import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../../lib/db.js');

// GET /api/admin/sorties – toutes les sorties (vue admin)
export const GET: APIRoute = () => {
  const rows = db.prepare(`
    SELECT s.*,
           u.pseudo AS organisateur,
           (SELECT COUNT(*) FROM participants WHERE sortie_id = s.id) AS nb_participants
    FROM sorties s
    JOIN users u ON s.created_by = u.id
    ORDER BY s.created_at DESC
  `).all();

  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
