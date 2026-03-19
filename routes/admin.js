const router = require('express').Router();
const db = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// List all users
router.get('/users', authenticate, requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, pseudo, email, moto_marque, moto_cylindree, role, validated, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json(users);
});

// Validate user
router.put('/users/:id/validate', authenticate, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  db.prepare('UPDATE users SET validated = 1 WHERE id = ?').run(req.params.id);

  db.prepare('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)')
    .run(req.params.id, 'Votre compte a été validé ! Bienvenue sur Zot Ride.', 'account_validated');

  res.json({ message: `${user.pseudo} validé avec succès` });
});

// Delete / reject user
router.delete('/users/:id', authenticate, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Impossible de supprimer un administrateur' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'Utilisateur supprimé' });
});

// List all sorties (admin view)
router.get('/sorties', authenticate, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT s.*,
           u.pseudo AS organisateur,
           (SELECT COUNT(*) FROM participants WHERE sortie_id = s.id) AS nb_participants
    FROM sorties s
    JOIN users u ON s.created_by = u.id
    ORDER BY s.created_at DESC
  `).all();
  res.json(rows);
});

// Get dashboard stats
router.get('/stats', authenticate, requireAdmin, (req, res) => {
  const totalUsers = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role != 'admin'").get().c;
  const pendingUsers = db.prepare("SELECT COUNT(*) AS c FROM users WHERE validated = 0 AND role != 'admin'").get().c;
  const totalSorties = db.prepare("SELECT COUNT(*) AS c FROM sorties").get().c;
  const totalParticipations = db.prepare("SELECT COUNT(*) AS c FROM participants").get().c;
  res.json({ totalUsers, pendingUsers, totalSorties, totalParticipations });
});

module.exports = router;
