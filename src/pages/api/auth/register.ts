import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db     = require('../../../lib/db.js');
const bcrypt = require('bcryptjs');

export const POST: APIRoute = async ({ request }) => {
  const { pseudo, email, password, moto_marque, moto_cylindree } = await request.json();

  if (!pseudo || !email || !password) {
    return json({ error: 'Pseudo, email et mot de passe sont obligatoires' }, 400);
  }
  if (password.length < 6) {
    return json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, 400);
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`
      INSERT INTO users (pseudo, email, password, moto_marque, moto_cylindree)
      VALUES (?, ?, ?, ?, ?)
    `).run(pseudo.trim(), email.trim().toLowerCase(), hash, moto_marque || '', moto_cylindree || '');

    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    const notif  = db.prepare('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)');
    admins.forEach((a: { id: number }) =>
      notif.run(a.id, `Nouvelle inscription en attente : ${pseudo}`, 'new_user')
    );

    return json({ message: 'Inscription réussie. Votre compte doit être validé par un administrateur.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE')) {
      return json({ error: 'Ce pseudo ou cet email est déjà utilisé' }, 400);
    }
    return json({ error: 'Erreur serveur' }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
