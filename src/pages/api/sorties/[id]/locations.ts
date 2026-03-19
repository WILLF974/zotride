import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../../lib/db.js');

// GET /api/sorties/:id/locations – positions de tous les participants
export const GET: APIRoute = ({ params }) => {
  const locations = db.prepare(`
    SELECT pl.lat, pl.lng, pl.updated_at,
           u.pseudo, u.moto_marque, u.moto_cylindree, u.id AS user_id
    FROM participant_locations pl
    JOIN users u ON pl.user_id = u.id
    WHERE pl.sortie_id = ?
    ORDER BY pl.updated_at DESC
  `).all(params.id);

  return new Response(JSON.stringify(locations), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
