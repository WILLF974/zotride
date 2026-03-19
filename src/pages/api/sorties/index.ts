import type { APIRoute } from 'astro';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../lib/db.js');

// GET /api/sorties – liste de toutes les sorties actives
export const GET: APIRoute = ({ locals }) => {
  const rows = db.prepare(`
    SELECT s.*,
           u.pseudo AS organisateur,
           (SELECT COUNT(*) FROM participants WHERE sortie_id = s.id) AS nb_participants
    FROM sorties s
    JOIN users u ON s.created_by = u.id
    WHERE s.status = 'active'
    ORDER BY s.date ASC, s.heure ASC
  `).all();
  return json(rows);
};

// POST /api/sorties – créer une sortie
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user!;
  const { titre, description, date, heure, nb_max_participants, waypoints } = await request.json();

  if (!titre || !date || !heure) {
    return json({ error: 'Titre, date et heure sont obligatoires' }, 400);
  }

  const result = db.prepare(`
    INSERT INTO sorties (titre, description, date, heure, nb_max_participants, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(titre.trim(), description || '', date, heure, nb_max_participants || 20, user.id);

  const sortieId = result.lastInsertRowid;

  if (waypoints && waypoints.length > 0) {
    const wpStmt = db.prepare(
      'INSERT INTO waypoints (sortie_id, lat, lng, nom, ordre, is_rassemblement) VALUES (?, ?, ?, ?, ?, ?)'
    );
    waypoints.forEach((wp: { lat: number; lng: number; nom: string; is_rassemblement: boolean }, i: number) =>
      wpStmt.run(sortieId, wp.lat, wp.lng, wp.nom || `Point ${i + 1}`, i, wp.is_rassemblement ? 1 : 0)
    );
  }

  const members = db.prepare("SELECT id FROM users WHERE validated = 1 AND id != ?").all(user.id);
  const notif   = db.prepare('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)');
  members.forEach((m: { id: number }) =>
    notif.run(m.id, `Nouvelle sortie organisée par ${user.pseudo} : "${titre}" le ${date} à ${heure}`, 'new_sortie')
  );

  return json({ id: sortieId, message: 'Sortie publiée avec succès' });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
