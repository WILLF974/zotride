import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../../lib/db.js');

// DELETE /api/admin/users/:id
export const DELETE: APIRoute = ({ params }) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(params.id);
  if (!user) return json({ error: 'Utilisateur non trouvé' }, 404);
  if (user.role === 'admin') return json({ error: 'Impossible de supprimer un administrateur' }, 400);

  db.prepare('DELETE FROM users WHERE id = ?').run(params.id);
  return json({ message: 'Utilisateur supprimé' });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
