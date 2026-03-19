const router = require('express').Router();
const db = require('../database/db');

// Enregistrer / mettre à jour une position anonyme
router.post('/position', (req, res) => {
  const { session_id, pseudo, moto_marque, moto_cylindree, lat, lng } = req.body;
  if (!session_id || lat == null || lng == null) {
    return res.status(400).json({ error: 'session_id, lat et lng sont requis' });
  }
  if (!pseudo || !pseudo.trim()) {
    return res.status(400).json({ error: 'Un pseudo est requis' });
  }

  db.prepare(`
    INSERT INTO radar_positions (session_id, pseudo, moto_marque, moto_cylindree, lat, lng, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(session_id)
    DO UPDATE SET
      pseudo = excluded.pseudo,
      moto_marque = excluded.moto_marque,
      moto_cylindree = excluded.moto_cylindree,
      lat = excluded.lat,
      lng = excluded.lng,
      updated_at = CURRENT_TIMESTAMP
  `).run(session_id, pseudo.trim(), moto_marque || '', moto_cylindree || '', lat, lng);

  res.json({ message: 'Position enregistrée' });
});

// Supprimer sa position (stop sharing)
router.delete('/position', (req, res) => {
  const { session_id } = req.body;
  if (session_id) db.prepare('DELETE FROM radar_positions WHERE session_id = ?').run(session_id);
  res.json({ message: 'Position supprimée' });
});

// Récupérer toutes les positions actives (< 30 min)
router.get('/positions', (req, res) => {
  const rows = db.prepare(`
    SELECT session_id, pseudo, moto_marque, moto_cylindree, lat, lng, updated_at
    FROM radar_positions
    WHERE updated_at >= datetime('now', '-30 minutes')
    ORDER BY updated_at DESC
  `).all();
  res.json(rows);
});

// Sorties du jour avec point de rassemblement
router.get('/sorties', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const rows = db.prepare(`
    SELECT
      s.id, s.titre, s.description, s.heure, s.nb_max_participants,
      u.pseudo AS organisateur,
      (SELECT COUNT(*) FROM participants WHERE sortie_id = s.id) AS nb_participants,
      (SELECT lat FROM waypoints WHERE sortie_id = s.id ORDER BY ordre ASC LIMIT 1) AS rally_lat,
      (SELECT lng FROM waypoints WHERE sortie_id = s.id ORDER BY ordre ASC LIMIT 1) AS rally_lng,
      (SELECT nom FROM waypoints WHERE sortie_id = s.id ORDER BY ordre ASC LIMIT 1) AS rally_nom
    FROM sorties s
    JOIN users u ON s.created_by = u.id
    WHERE s.date = ? AND s.status = 'active'
    ORDER BY s.heure ASC
  `).all(today);
  res.json(rows);
});

module.exports = router;
