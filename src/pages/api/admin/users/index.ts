import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../../lib/db.js');

// GET /api/admin/users – liste de tous les utilisateurs
export const GET: APIRoute = () => {
  const users = db.prepare(
    'SELECT id, pseudo, email, moto_marque, moto_cylindree, role, validated, created_at FROM users ORDER BY created_at DESC'
  ).all();
  return new Response(JSON.stringify(users), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
