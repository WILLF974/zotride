import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db     = require('../../../lib/db.js');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'zotride_secret_key';

export const POST: APIRoute = async ({ request }) => {
  const { email, password } = await request.json();

  if (!email || !password) {
    return json({ error: 'Email et mot de passe requis' }, 400);
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return json({ error: 'Email ou mot de passe incorrect' }, 401);
  }
  if (!user.validated) {
    return json({ error: 'Votre compte est en attente de validation par un administrateur' }, 403);
  }

  const token = jwt.sign(
    { id: user.id, pseudo: user.pseudo, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return json({
    token,
    user: {
      id: user.id,
      pseudo: user.pseudo,
      role: user.role,
      moto_marque: user.moto_marque,
      moto_cylindree: user.moto_cylindree
    }
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
