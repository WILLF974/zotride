import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../lib/db.js');

// GET /api/sorties/:id
export const GET: APIRoute = ({ params, locals }) => {
  const user   = locals.user!;
  const sortie = db.prepare(`
    SELECT s.*,
           u.pseudo AS organisateur,
           (SELECT COUNT(*) FROM participants WHERE sortie_id = s.id) AS nb_participants
    FROM sorties s
    JOIN users u ON s.created_by = u.id
    WHERE s.id = ?
  `).get(params.id);

  if (!sortie) return json({ error: 'Sortie non trouvée' }, 404);

  const waypoints = db.prepare(
    'SELECT * FROM waypoints WHERE sortie_id = ? ORDER BY ordre ASC'
  ).all(params.id);

  const participants = db.prepare(`
    SELECT u.pseudo, u.moto_marque, u.moto_cylindree
    FROM participants p
    JOIN users u ON p.user_id = u.id
    WHERE p.sortie_id = ?
    ORDER BY p.joined_at ASC
  `).all(params.id);

  const isParticipant = !!db.prepare(
    'SELECT id FROM participants WHERE sortie_id = ? AND user_id = ?'
  ).get(params.id, user.id);

  return json({ ...sortie, waypoints, participants, isParticipant });
};

// DELETE /api/sorties/:id
export const DELETE: APIRoute = ({ params, locals }) => {
  const user   = locals.user!;
  const sortie = db.prepare('SELECT * FROM sorties WHERE id = ?').get(params.id);

  if (!sortie) return json({ error: 'Sortie non trouvée' }, 404);
  if (sortie.created_by !== user.id && user.role !== 'admin') {
    return json({ error: 'Non autorisé' }, 403);
  }

  db.prepare('DELETE FROM sorties WHERE id = ?').run(params.id);
  return json({ message: 'Sortie supprimée' });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
