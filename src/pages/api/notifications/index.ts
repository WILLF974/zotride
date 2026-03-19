import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../lib/db.js');

// GET /api/notifications
export const GET: APIRoute = ({ locals }) => {
  const id = locals.user!.id;

  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(id);

  const unreadCount = db.prepare(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0'
  ).get(id).c;

  return new Response(JSON.stringify({ notifications, unreadCount }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
