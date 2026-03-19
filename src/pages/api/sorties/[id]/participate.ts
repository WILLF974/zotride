import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../../lib/db.js');

// POST /api/sorties/:id/participate – rejoindre ou quitter
export const POST: APIRoute = ({ params, locals }) => {
  const user   = locals.user!;
  const sortie = db.prepare('SELECT * FROM sorties WHERE id = ?').get(params.id);

  if (!sortie) return json({ error: 'Sortie non trouvée' }, 404);

  const existing = db.prepare(
    'SELECT id FROM participants WHERE sortie_id = ? AND user_id = ?'
  ).get(params.id, user.id);

  if (existing) {
    db.prepare('DELETE FROM participants WHERE sortie_id = ? AND user_id = ?')
      .run(params.id, user.id);
    return json({ message: 'Participation annulée', joined: false });
  }

  const count = db.prepare('SELECT COUNT(*) AS c FROM participants WHERE sortie_id = ?').get(params.id).c;
  if (count >= sortie.nb_max_participants) {
    return json({ error: 'Cette sortie est complète' }, 400);
  }

  db.prepare('INSERT INTO participants (sortie_id, user_id) VALUES (?, ?)').run(params.id, user.id);

  if (sortie.created_by !== user.id) {
    db.prepare('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)')
      .run(sortie.created_by, `${user.pseudo} participe à votre sortie "${sortie.titre}"`, 'new_participant');
  }

  return json({ message: 'Participation confirmée !', joined: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
