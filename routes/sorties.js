const router = require('express').Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

// List all active sorties
router.get('/', authenticate, (req, res) => {
  const rows = db.prepare(`
    SELECT s.*,
           u.pseudo AS organisateur,
           (SELECT COUNT(*) FROM participants WHERE sortie_id = s.id) AS nb_participants
    FROM sorties s
    JOIN users u ON s.created_by = u.id
    WHERE s.status = 'active'
    ORDER BY s.date ASC, s.heure ASC
  `).all();
  res.json(rows);
});

// Get single sortie with waypoints and participants
router.get('/:id', authenticate, (req, res) => {
  const sortie = db.prepare(`
    SELECT s.*,
           u.pseudo AS organisateur,
           (SELECT COUNT(*) FROM participants WHERE sortie_id = s.id) AS nb_participants
    FROM sorties s
    JOIN users u ON s.created_by = u.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!sortie) return res.status(404).json({ error: 'Sortie non trouvée' });

  const waypoints = db.prepare(
    'SELECT * FROM waypoints WHERE sortie_id = ? ORDER BY ordre ASC'
  ).all(req.params.id);

  const participants = db.prepare(`
    SELECT u.pseudo, u.moto_marque, u.moto_cylindree
    FROM participants p
    JOIN users u ON p.user_id = u.id
    WHERE p.sortie_id = ?
    ORDER BY p.joined_at ASC
  `).all(req.params.id);

  const isParticipant = !!db.prepare(
    'SELECT id FROM participants WHERE sortie_id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  res.json({ ...sortie, waypoints, participants, isParticipant });
});

// Create sortie
router.post('/', authenticate, (req, res) => {
  const { titre, description, date, heure, nb_max_participants, waypoints } = req.body;

  if (!titre || !date || !heure) {
    return res.status(400).json({ error: 'Titre, date et heure sont obligatoires' });
  }

  const result = db.prepare(`
    INSERT INTO sorties (titre, description, date, heure, nb_max_participants, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(titre.trim(), description || '', date, heure, nb_max_participants || 20, req.user.id);

  const sortieId = result.lastInsertRowid;

  if (waypoints && waypoints.length > 0) {
    const wpStmt = db.prepare(
      'INSERT INTO waypoints (sortie_id, lat, lng, nom, ordre, is_rassemblement) VALUES (?, ?, ?, ?, ?, ?)'
    );
    waypoints.forEach((wp, i) =>
      wpStmt.run(sortieId, wp.lat, wp.lng, wp.nom || `Point ${i + 1}`, i, wp.is_rassemblement ? 1 : 0)
    );
  }

  // Notifier tous les membres validés
  const members = db.prepare("SELECT id FROM users WHERE validated = 1 AND id != ?").all(req.user.id);
  const notif = db.prepare('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)');
  members.forEach(m =>
    notif.run(m.id, `Nouvelle sortie organisée par ${req.user.pseudo} : "${titre}" le ${date} à ${heure}`, 'new_sortie')
  );

  res.json({ id: sortieId, message: 'Sortie publiée avec succès' });
});

// Join or leave a sortie
router.post('/:id/participate', authenticate, (req, res) => {
  const sortie = db.prepare('SELECT * FROM sorties WHERE id = ?').get(req.params.id);
  if (!sortie) return res.status(404).json({ error: 'Sortie non trouvée' });

  const existing = db.prepare(
    'SELECT id FROM participants WHERE sortie_id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (existing) {
    db.prepare('DELETE FROM participants WHERE sortie_id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    return res.json({ message: 'Participation annulée', joined: false });
  }

  const count = db.prepare('SELECT COUNT(*) AS c FROM participants WHERE sortie_id = ?').get(req.params.id).c;
  if (count >= sortie.nb_max_participants) {
    return res.status(400).json({ error: 'Cette sortie est complète' });
  }

  db.prepare('INSERT INTO participants (sortie_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);

  // Notifier l'organisateur
  if (sortie.created_by !== req.user.id) {
    db.prepare('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)')
      .run(sortie.created_by, `${req.user.pseudo} participe à votre sortie "${sortie.titre}"`, 'new_participant');
  }

  res.json({ message: 'Participation confirmée !', joined: true });
});

// Save participant's geolocation for a sortie
router.post('/:id/location', authenticate, (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) return res.status(400).json({ error: 'Coordonnées requises' });

  db.prepare(`
    INSERT INTO participant_locations (sortie_id, user_id, lat, lng, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(sortie_id, user_id)
    DO UPDATE SET lat = excluded.lat, lng = excluded.lng, updated_at = CURRENT_TIMESTAMP
  `).run(req.params.id, req.user.id, lat, lng);

  res.json({ message: 'Position enregistrée' });
});

// Get all participant locations for a sortie
router.get('/:id/locations', authenticate, (req, res) => {
  const locations = db.prepare(`
    SELECT pl.lat, pl.lng, pl.updated_at,
           u.pseudo, u.moto_marque, u.moto_cylindree, u.id AS user_id
    FROM participant_locations pl
    JOIN users u ON pl.user_id = u.id
    WHERE pl.sortie_id = ?
    ORDER BY pl.updated_at DESC
  `).all(req.params.id);
  res.json(locations);
});

// Delete sortie (owner or admin)
router.delete('/:id', authenticate, (req, res) => {
  const sortie = db.prepare('SELECT * FROM sorties WHERE id = ?').get(req.params.id);
  if (!sortie) return res.status(404).json({ error: 'Sortie non trouvée' });
  if (sortie.created_by !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  db.prepare('DELETE FROM sorties WHERE id = ?').run(req.params.id);
  res.json({ message: 'Sortie supprimée' });
});

module.exports = router;
