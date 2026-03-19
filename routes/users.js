const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

// Get current user profile
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare(
    'SELECT id, pseudo, email, moto_marque, moto_cylindree, role, validated, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  res.json(user);
});

// Get current user stats
router.get('/me/stats', authenticate, (req, res) => {
  const sortiesCreated = db.prepare('SELECT COUNT(*) as c FROM sorties WHERE created_by = ?').get(req.user.id).c;
  const sortiesJoined = db.prepare('SELECT COUNT(*) as c FROM participants WHERE user_id = ?').get(req.user.id).c;
  res.json({ sortiesCreated, sortiesJoined });
});

// Update profile
router.put('/me', authenticate, (req, res) => {
  const { pseudo, moto_marque, moto_cylindree, password } = req.body;
  if (!pseudo) return res.status(400).json({ error: 'Le pseudo est requis' });

  try {
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET pseudo=?, moto_marque=?, moto_cylindree=?, password=? WHERE id=?')
        .run(pseudo.trim(), moto_marque || '', moto_cylindree || '', hash, req.user.id);
    } else {
      db.prepare('UPDATE users SET pseudo=?, moto_marque=?, moto_cylindree=? WHERE id=?')
        .run(pseudo.trim(), moto_marque || '', moto_cylindree || '', req.user.id);
    }
    res.json({ message: 'Profil mis à jour avec succès' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Ce pseudo est déjà pris' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
