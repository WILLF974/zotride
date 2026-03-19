import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db     = require('../../../lib/db.js');
const bcrypt = require('bcryptjs');

// GET /api/users/me – profil de l'utilisateur connecté
export const GET: APIRoute = ({ locals }) => {
  const user = db.prepare(
    'SELECT id, pseudo, email, moto_marque, moto_cylindree, role, validated, created_at FROM users WHERE id = ?'
  ).get(locals.user!.id);

  if (!user) return json({ error: 'Utilisateur non trouvé' }, 404);
  return json(user);
};

// PUT /api/users/me – mettre à jour le profil
export const PUT: APIRoute = async ({ request, locals }) => {
  const { pseudo, moto_marque, moto_cylindree, password } = await request.json();

  if (!pseudo) return json({ error: 'Le pseudo est requis' }, 400);

  try {
    if (password) {
      if (password.length < 6) return json({ error: 'Mot de passe trop court' }, 400);
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET pseudo=?, moto_marque=?, moto_cylindree=?, password=? WHERE id=?')
        .run(pseudo.trim(), moto_marque || '', moto_cylindree || '', hash, locals.user!.id);
    } else {
      db.prepare('UPDATE users SET pseudo=?, moto_marque=?, moto_cylindree=? WHERE id=?')
        .run(pseudo.trim(), moto_marque || '', moto_cylindree || '', locals.user!.id);
    }
    return json({ message: 'Profil mis à jour avec succès' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE')) return json({ error: 'Ce pseudo est déjà pris' }, 400);
    return json({ error: 'Erreur serveur' }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
