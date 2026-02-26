import express from 'express';
import db from '../services/init-database.js';
import { requireAuth } from '../middleware/auth.js';
import { getCurrentPrice } from '../services/stock-price-api.js';

const router = express.Router();

// All watchlist routes require authentication
router.use(requireAuth);

// ── GET /api/watchlist  – list all items for current user ────────────────────
router.get('/', (req, res) => {
  try {
    const items = db.prepare(`
      SELECT * FROM watchlist WHERE user_id = ? ORDER BY added_at DESC
    `).all(req.user.id);
    res.json({ success: true, data: items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/watchlist/prices  – live prices for all watchlist items ──────────
router.get('/prices', async (req, res) => {
  try {
    const items = db.prepare(`
      SELECT symbol FROM watchlist WHERE user_id = ?
    `).all(req.user.id);

    if (!items.length) return res.json({ success: true, data: {} });

    const results = await Promise.allSettled(
      items.map(({ symbol }) => getCurrentPrice(symbol).then(p => ({ symbol, ...p })))
    );

    const prices = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') prices[items[i].symbol] = r.value;
    });

    res.json({ success: true, data: prices });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/watchlist  – add new item ──────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const {
      symbol, name, currency = 'USD',
      start_watch_price, target_buy_price,
      take_profit_price, stop_loss_price,
      notes, status = 'watching'
    } = req.body;

    if (!symbol) return res.status(400).json({ success: false, error: 'symbol is required' });

    const sym = symbol.toUpperCase().trim();
    const VALID_STATUS = ['watching', 'bought', 'skipped'];
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${VALID_STATUS.join(', ')}` });
    }

    const stmt = db.prepare(`
      INSERT INTO watchlist
        (user_id, symbol, name, currency, start_watch_price, target_buy_price,
         take_profit_price, stop_loss_price, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      req.user.id, sym,
      name || sym,
      currency.toUpperCase(),
      start_watch_price ?? null,
      target_buy_price  ?? null,
      take_profit_price ?? null,
      stop_loss_price   ?? null,
      notes || null,
      status
    );

    const item = db.prepare('SELECT * FROM watchlist WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id);
    res.status(201).json({ success: true, data: item });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'Symbol already in watchlist' });
    }
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── PUT /api/watchlist/:id  – update item ────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM watchlist WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

    const {
      name, currency,
      start_watch_price, target_buy_price,
      take_profit_price, stop_loss_price,
      notes, status
    } = req.body;

    const VALID_STATUS = ['watching', 'bought', 'skipped'];
    const newStatus = status ?? existing.status;
    if (!VALID_STATUS.includes(newStatus)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${VALID_STATUS.join(', ')}` });
    }

    db.prepare(`
      UPDATE watchlist SET
        name              = ?,
        currency          = ?,
        start_watch_price = ?,
        target_buy_price  = ?,
        take_profit_price = ?,
        stop_loss_price   = ?,
        notes             = ?,
        status            = ?,
        updated_at        = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      name              ?? existing.name,
      (currency         ?? existing.currency).toUpperCase(),
      start_watch_price ?? existing.start_watch_price,
      target_buy_price  ?? existing.target_buy_price,
      take_profit_price ?? existing.take_profit_price,
      stop_loss_price   ?? existing.stop_loss_price,
      notes             ?? existing.notes,
      newStatus,
      id, req.user.id
    );

    const updated = db.prepare('SELECT * FROM watchlist WHERE id = ? AND user_id = ?').get(id, req.user.id);
    res.json({ success: true, data: updated });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── DELETE /api/watchlist/:id  – remove item ─────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM watchlist WHERE id = ? AND user_id = ?').run(id, req.user.id);
    if (!result.changes) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
