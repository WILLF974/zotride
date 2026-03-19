import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../../../lib/db.js');

// PUT /api/admin/users/:id/validate
export const PUT: APIRoute = ({ params }) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(params.id);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Utilisateur non trouvé' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  db.prepare('UPDATE users SET validated = 1 WHERE id = ?').run(params.id);

  db.prepare('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)')
    .run(params.id, 'Votre compte a été validé ! Bienvenue sur Zot Ride.', 'account_validated');

  return new Response(JSON.stringify({ message: `${user.pseudo} validé avec succès` }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
