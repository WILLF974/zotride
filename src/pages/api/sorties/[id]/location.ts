import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../../lib/db.js');

// POST /api/sorties/:id/location – enregistrer sa géolocalisation
export const POST: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user!;
  const { lat, lng } = await request.json();

  if (lat == null || lng == null) {
    return json({ error: 'Coordonnées requises' }, 400);
  }

  db.prepare(`
    INSERT INTO participant_locations (sortie_id, user_id, lat, lng, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(sortie_id, user_id)
    DO UPDATE SET lat = excluded.lat, lng = excluded.lng, updated_at = CURRENT_TIMESTAMP
  `).run(params.id, user.id, lat, lng);

  return json({ message: 'Position enregistrée' });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
