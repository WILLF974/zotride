const router = require('express').Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

// Get notifications for current user
router.get('/', authenticate, (req, res) => {
  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);
  const unreadCount = db.prepare(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0'
  ).get(req.user.id).c;
  res.json({ notifications, unreadCount });
});

// Mark all as read
router.put('/read', authenticate, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'Notifications marquées comme lues' });
});

// Mark single notification as read
router.put('/:id/read', authenticate, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  res.json({ message: 'OK' });
});

module.exports = router;
