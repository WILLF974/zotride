import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../lib/db.js');

// PUT /api/notifications/read – marquer toutes comme lues
export const PUT: APIRoute = ({ locals }) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(locals.user!.id);
  return new Response(JSON.stringify({ message: 'Notifications marquées comme lues' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
