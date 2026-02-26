import express from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/auth.js';
import * as userDB from '../services/user-database.js';
import db from '../services/init-database.js';

const router = express.Router();

// ── Admin guard — only user #1 (dev@local.com) can access ────────────────────
const requireAdmin = (req, res, next) => {
  if (req.user?.id !== 1) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

router.use(requireAuth, requireAdmin);

// ── GET /api/admin/users  — list all users ───────────────────────────────────
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT
        u.id, u.email, u.name, u.provider, u.created_at,
        COUNT(DISTINCT ph.id) AS holdings,
        COUNT(DISTINCT wl.id) AS watchlist_items
      FROM users u
      LEFT JOIN portfolio_holdings ph ON ph.user_id = u.id
      LEFT JOIN watchlist           wl ON wl.user_id = u.id
      GROUP BY u.id
      ORDER BY u.id
    `).all();
    res.json({ success: true, data: users });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/admin/users/:id/reset-password  — set new password ─────────────
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const user = userDB.findUserById(Number(id));
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.provider !== 'local') {
      return res.status(400).json({ success: false, error: `User uses ${user.provider} login — no password to reset` });
    }

    const hash = await bcrypt.hash(password, 10);
    userDB.updateUserPassword(user.id, hash);

    // Invalidate any pending reset tokens
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?').run(user.id);

    res.json({ success: true, message: `Password updated for ${user.email}` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── DELETE /api/admin/users/:id  — delete a user (non-admin only) ────────────
router.delete('/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (Number(id) === 1) {
      return res.status(400).json({ success: false, error: 'Cannot delete the admin user' });
    }
    const user = userDB.findUserById(Number(id));
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Remove user data then the user
    db.prepare('DELETE FROM portfolio_holdings WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM transactions       WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM watchlist          WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users              WHERE id = ?').run(id);

    res.json({ success: true, message: `User ${user.email} deleted` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
