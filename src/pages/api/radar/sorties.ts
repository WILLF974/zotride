import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../lib/db.js');

// GET /api/radar/sorties – sorties du jour avec point de rassemblement
export const GET: APIRoute = () => {
  const today = new Date().toISOString().split('T')[0];

  const rows = db.prepare(`
    SELECT
      s.id, s.titre, s.description, s.heure, s.nb_max_participants,
      u.pseudo AS organisateur,
      (SELECT COUNT(*) FROM participants WHERE sortie_id = s.id) AS nb_participants,
      (SELECT lat FROM waypoints WHERE sortie_id = s.id ORDER BY ordre ASC LIMIT 1) AS rally_lat,
      (SELECT lng FROM waypoints WHERE sortie_id = s.id ORDER BY ordre ASC LIMIT 1) AS rally_lng,
      (SELECT nom FROM waypoints WHERE sortie_id = s.id ORDER BY ordre ASC LIMIT 1) AS rally_nom
    FROM sorties s
    JOIN users u ON s.created_by = u.id
    WHERE s.date = ? AND s.status = 'active'
    ORDER BY s.heure ASC
  `).all(today);

  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
