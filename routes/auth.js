const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { JWT_SECRET } = require('../middleware/auth');

// Register
router.post('/register', (req, res) => {
  const { pseudo, email, password, moto_marque, moto_cylindree } = req.body;

  if (!pseudo || !email || !password) {
    return res.status(400).json({ error: 'Pseudo, email et mot de passe sont obligatoires' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`
      INSERT INTO users (pseudo, email, password, moto_marque, moto_cylindree)
      VALUES (?, ?, ?, ?, ?)
    `).run(pseudo.trim(), email.trim().toLowerCase(), hash, moto_marque || '', moto_cylindree || '');

    // Notifier les admins
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    const notif = db.prepare('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)');
    admins.forEach(a => notif.run(a.id, `Nouvelle inscription en attente : ${pseudo}`, 'new_user'));

    res.json({ message: 'Inscription réussie. Votre compte doit être validé par un administrateur avant de pouvoir vous connecter.' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Ce pseudo ou cet email est déjà utilisé' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }
  if (!user.validated) {
    return res.status(403).json({ error: 'Votre compte est en attente de validation par un administrateur' });
  }

  const token = jwt.sign(
    { id: user.id, pseudo: user.pseudo, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      pseudo: user.pseudo,
      role: user.role,
      moto_marque: user.moto_marque,
      moto_cylindree: user.moto_cylindree
    }
  });
});

module.exports = router;
