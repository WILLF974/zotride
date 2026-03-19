import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../lib/db.js');

// POST /api/radar/position – enregistrer ou mettre à jour une position anonyme
export const POST: APIRoute = async ({ request }) => {
  const { session_id, pseudo, moto_marque, moto_cylindree, lat, lng } = await request.json();

  if (!session_id || lat == null || lng == null) {
    return json({ error: 'session_id, lat et lng sont requis' }, 400);
  }
  if (!pseudo || !pseudo.trim()) {
    return json({ error: 'Un pseudo est requis' }, 400);
  }

  db.prepare(`
    INSERT INTO radar_positions (session_id, pseudo, moto_marque, moto_cylindree, lat, lng, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(session_id)
    DO UPDATE SET
      pseudo = excluded.pseudo,
      moto_marque = excluded.moto_marque,
      moto_cylindree = excluded.moto_cylindree,
      lat = excluded.lat,
      lng = excluded.lng,
      updated_at = CURRENT_TIMESTAMP
  `).run(session_id, pseudo.trim(), moto_marque || '', moto_cylindree || '', lat, lng);

  return json({ message: 'Position enregistrée' });
};

// DELETE /api/radar/position – arrêter le partage
export const DELETE: APIRoute = async ({ request }) => {
  const { session_id } = await request.json();
  if (session_id) db.prepare('DELETE FROM radar_positions WHERE session_id = ?').run(session_id);
  return json({ message: 'Position supprimée' });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
