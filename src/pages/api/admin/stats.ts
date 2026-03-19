import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../lib/db.js');

// GET /api/admin/stats
export const GET: APIRoute = () => {
  const totalUsers        = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role != 'admin'").get().c;
  const pendingUsers      = db.prepare("SELECT COUNT(*) AS c FROM users WHERE validated = 0 AND role != 'admin'").get().c;
  const totalSorties      = db.prepare("SELECT COUNT(*) AS c FROM sorties").get().c;
  const totalParticipations = db.prepare("SELECT COUNT(*) AS c FROM participants").get().c;

  return new Response(JSON.stringify({ totalUsers, pendingUsers, totalSorties, totalParticipations }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
