import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../../lib/db.js');

// GET /api/users/me/stats
export const GET: APIRoute = ({ locals }) => {
  const id = locals.user!.id;
  const sortiesCreated = db.prepare('SELECT COUNT(*) as c FROM sorties WHERE created_by = ?').get(id).c;
  const sortiesJoined  = db.prepare('SELECT COUNT(*) as c FROM participants WHERE user_id = ?').get(id).c;

  return new Response(JSON.stringify({ sortiesCreated, sortiesJoined }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
