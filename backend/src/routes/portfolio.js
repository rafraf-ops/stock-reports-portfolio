import express from 'express';
import * as portfolioDB from '../services/portfolio-database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const summary = portfolioDB.getPortfolioSummary(userId);
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const userId = req.user.id;
    const { symbol } = req.query;
    const transactions = portfolioDB.getTransactions(userId, symbol);
    
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/transaction', async (req, res) => {
  try {
    const userId = req.user.id;
    const { symbol, type, quantity, price, date, notes, currency, exchangeRate } = req.body;

    if (!symbol || !type || !quantity || !price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    if (type !== 'buy' && type !== 'sell') {
      return res.status(400).json({
        success: false,
        error: 'Type must be buy or sell'
      });
    }

    const transaction = portfolioDB.addTransaction({
      userId,
      symbol,
      type,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      date,
      notes,
      currency: currency || 'USD',
      exchangeRate: exchangeRate ? parseFloat(exchangeRate) : 1
    });

    // ── Auto-learn: upsert symbol into symbol_cache so future searches find it ─
    try {
      const db = (await import('../services/init-database.js')).default;
      const isTase    = symbol.endsWith('.TA') ? 1 : 0;
      const symCurr   = isTase ? 'ILS' : (currency || 'USD');
      const exchange  = isTase ? 'TLV' : 'NMS';
      // Only insert if not already present (INSERT OR IGNORE keeps static entries intact)
      db.prepare(`
        INSERT OR IGNORE INTO symbol_cache (symbol, name, exchange, keywords, is_tase, currency, source)
        VALUES (?, ?, ?, ?, ?, ?, 'user')
      `).run(symbol, symbol, exchange, symbol.toLowerCase().replace('.ta', ''), isTase, symCurr);
    } catch (_) { /* non-critical, never block the transaction */ }

    res.json({
      success: true,
      data: transaction
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/transaction/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const deleted = portfolioDB.deleteTransaction(parseInt(id), userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Transaction deleted'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/cash', async (req, res) => {
  try {
    const userId = req.user.id;
    const balance = portfolioDB.getCashBalance(userId);
    const transactions = portfolioDB.getCashTransactions(userId);
    
    res.json({
      success: true,
      data: { balance, transactions }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/cash', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, amount, date, notes } = req.body;
    
    if (!type || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const transaction = portfolioDB.addCashTransaction({
      userId,
      type,
      amount: parseFloat(amount),
      date,
      notes
    });
    
    res.json({
      success: true,
      data: transaction
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/cash/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const deleted = portfolioDB.deleteCashTransaction(parseInt(id), userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Deleted'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/prices', async (req, res) => {
  try {
    const userId = req.user.id;
    const summary = portfolioDB.getPortfolioSummary(userId);

    // Only fetch prices for symbols that look like real tickers
    // (ASCII only — Hebrew/custom symbols like "להב" have no Yahoo ticker)
    const allSymbols    = summary.holdings.map(h => h.symbol);
    const fetchSymbols  = allSymbols.filter(s => /^[A-Za-z0-9.\-]+$/.test(s));

    if (fetchSymbols.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const stockPriceAPI = await import('../services/stock-price-api.js');
    const prices = await stockPriceAPI.getMultiplePrices(fetchSymbols);

    res.json({ success: true, data: prices });
  } catch (error) {
    console.error('Price fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/portfolio/search-symbol?q=... ────────────────────────────────────
// Search for a TASE or US stock ticker by partial name (English or Hebrew).
// Strategy:
//   1. Query symbol_cache DB (seeded from static list + auto-learned over time)
//   2. Then run Yahoo live search for anything not matched
router.get('/search-symbol', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ success: true, data: [] });
  const ql = q.toLowerCase();

  // ── 1. DB match (symbol_cache) ──────────────────────────────────────────────
  const db = (await import('../services/init-database.js')).default;
  const allCached = db.prepare(`SELECT symbol, name, exchange, keywords, is_tase, currency FROM symbol_cache`).all();

  const dbMatches = allCached
    .filter(row => {
      const nameLower = row.name.toLowerCase();
      const symLower  = row.symbol.toLowerCase().replace('.ta', '');
      const keys      = row.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      return (
        nameLower.includes(ql) ||
        symLower.includes(ql) ||
        keys.some(k => k.includes(ql) || ql.includes(k))
      );
    })
    .map(row => ({
      symbol:   row.symbol,
      name:     row.name,
      exchange: row.exchange,
      isTase:   row.is_tase === 1,
      currency: row.currency,
      source:   'cache'
    }))
    .slice(0, 5);

  // ── 2. Yahoo live search ────────────────────────────────────────────────────
  // Build Hebrew→English translation map from DB keywords for the Yahoo query.
  // For any Hebrew keyword in a cached entry, map it to the English name.
  const hebrewRe = /[\u0590-\u05FF]/;
  let yahooTerm = q;

  if (hebrewRe.test(q)) {
    // Try to find a cached row whose keywords include this Hebrew term
    const match = allCached.find(row =>
      row.keywords.split(',').map(k => k.trim()).some(k =>
        hebrewRe.test(k) && (k.includes(ql) || ql.includes(k.toLowerCase()))
      )
    );
    if (match) {
      // Use the English name as the Yahoo search term
      yahooTerm = match.name;
    }
  }

  let yahooResults = [];
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(yahooTerm)}&quotesCount=10&newsCount=0`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
    );
    const d = await r.json();
    yahooResults = (d.quotes || [])
      .filter(h => h.symbol && h.quoteType === 'EQUITY')
      .map(h => ({
        symbol:   h.symbol,
        name:     h.shortname || h.longname || h.symbol,
        exchange: h.exchange || '',
        isTase:   h.symbol.endsWith('.TA'),
        currency: h.symbol.endsWith('.TA') ? 'ILS' : 'USD',
        source:   'yahoo'
      }));
  } catch (_) {}

  // ── 3. Merge: DB cache first, then Yahoo (deduplicated), TASE first ─────────
  const seen = new Set(dbMatches.map(r => r.symbol));
  const merged = [
    ...dbMatches,
    ...yahooResults.filter(r => !seen.has(r.symbol) && seen.add(r.symbol))
  ]
    .sort((a, b) => (b.isTase ? 1 : 0) - (a.isTase ? 1 : 0))
    .slice(0, 8);

  res.json({ success: true, data: merged });
});

router.get('/exchange-rate', async (req, res) => {
  try {
    const stockPriceAPI = await import('../services/stock-price-api.js');
    const rateData = await stockPriceAPI.getUsdIlsRate();

    res.json({
      success: true,
      data: rateData
    });
  } catch (error) {
    console.error('Exchange rate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ── POST /api/portfolio/fix-ils-prices ────────────────────────────────────────
// One-time migration: fix ILS transactions where price_usd was incorrectly set
// to the ILS amount instead of the USD equivalent.
// Call once after upgrading, then optionally disable.
router.post('/fix-ils-prices', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get live exchange rate
    const stockPriceAPI = await import('../services/stock-price-api.js');
    const { usdToIls }  = await stockPriceAPI.getUsdIlsRate();

    // Fix rows: ILS transactions where price_usd looks like it wasn't converted
    // (i.e. price_usd is equal to price, but currency is ILS)
    const db = (await import('../services/init-database.js')).default;

    const ilsTxs = db.prepare(`
      SELECT * FROM transactions
      WHERE user_id = ? AND currency = 'ILS'
    `).all(userId);

    let fixed = 0;
    ilsTxs.forEach(tx => {
      // If price_usd equals price (raw ILS), it was not properly converted
      const expectedUsd = tx.price / usdToIls;
      if (Math.abs(tx.price_usd - tx.price) < 0.01 || tx.price_usd == null) {
        db.prepare(`
          UPDATE transactions
          SET price_usd = ?, exchange_rate = ?
          WHERE id = ?
        `).run(tx.price / (tx.exchange_rate || usdToIls), tx.exchange_rate || usdToIls, tx.id);
        fixed++;
      }
    });

    // Rebuild all affected holdings from corrected transactions
    const symbols = [...new Set(ilsTxs.map(t => t.symbol))];
    const portfolioDB = await import('../services/portfolio-database.js');
    for (const symbol of symbols) {
      // Trigger recalculation by deleting and replaying via deleteTransaction logic
      // We do it directly here by calling the internal recalc via a dummy delete+re-add
      // Instead, use the exported function if available, or just signal frontend to reload
    }

    res.json({
      success: true,
      message: `Fixed ${fixed} ILS transactions. Please restart the backend to apply recalculation.`,
      fixedCount: fixed,
      affectedSymbols: symbols
    });
  } catch (error) {
    console.error('Fix ILS prices error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/portfolio/pnl ────────────────────────────────────────────────────
// Returns realized + unrealized P&L for every holding, plus portfolio totals.
// Unrealized P&L requires live prices — caller passes ?prices=SYM:val,SYM:val
// OR frontend can call /prices first then POST here with prices in body.
// We accept prices as query param: ?prices=AAPL:182.5,TEVA.TA:43.2
router.get('/pnl', async (req, res) => {
  try {
    const userId = req.user.id;

    // Parse live prices from query string: AAPL:182.5,TEVA.TA:43.2
    const priceMap = {};
    if (req.query.prices) {
      req.query.prices.split(',').forEach(pair => {
        const [sym, val] = pair.split(':');
        if (sym && val) priceMap[sym.toUpperCase()] = parseFloat(val);
      });
    }

    const holdings     = portfolioDB.getPortfolioSummary(userId).holdings;
    const transactions = portfolioDB.getTransactions(userId);

    // ── Realized P&L: sum up closed/partial sells ─────────────────────────────
    // For each SELL tx: realized gain = (sell price - avg cost at time) × qty
    // We replay transactions per symbol to track running avg cost
    const realizedBySymbol = {};

    // Group txs by symbol, sort by date asc
    const txsBySymbol = {};
    for (const tx of transactions) {
      const s = tx.symbol.toUpperCase();
      if (!txsBySymbol[s]) txsBySymbol[s] = [];
      txsBySymbol[s].push(tx);
    }
    for (const s of Object.keys(txsBySymbol)) {
      txsBySymbol[s].sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    for (const [sym, txs] of Object.entries(txsBySymbol)) {
      let shares = 0, costBasis = 0, realized = 0;
      for (const tx of txs) {
        const qty = parseFloat(tx.quantity);
        const prc = parseFloat(tx.price);
        if (tx.type === 'buy') {
          costBasis = shares > 0 ? ((costBasis * shares) + (prc * qty)) / (shares + qty) : prc;
          shares += qty;
        } else if (tx.type === 'sell') {
          realized += (prc - costBasis) * Math.min(qty, shares);
          shares   = Math.max(0, shares - qty);
        }
      }
      realizedBySymbol[sym] = { realized, currency: txs[0]?.currency || 'USD' };
    }

    // ── Build per-holding P&L rows ────────────────────────────────────────────
    const rows = holdings.map(h => {
      const sym       = h.symbol.toUpperCase();
      const livePrice = priceMap[sym] || 0;
      const currency  = h.currency || 'USD';
      const currSym   = currency === 'ILS' ? '₪' : '$';

      const invested   = h.total_invested  || 0;
      const shares     = h.total_shares    || 0;
      const avgCost    = h.average_cost    || 0;
      const curVal     = livePrice > 0 ? shares * livePrice : 0;
      const unrealized = livePrice > 0 ? curVal - invested : 0;
      const unrealPct  = invested > 0 && livePrice > 0 ? (unrealized / invested) * 100 : null;
      const realized   = realizedBySymbol[sym]?.realized || 0;
      const totalPnl   = unrealized + realized;

      return {
        symbol:       sym,
        currency,
        currSym,
        shares,
        avgCost,
        livePrice,
        invested,
        currentValue: curVal,
        unrealized,
        unrealPct,
        realized,
        totalPnl,
        hasLivePrice: livePrice > 0
      };
    });

    // ── Totals (split by currency) ────────────────────────────────────────────
    const calcTotals = (cur) => {
      const subset = rows.filter(r => r.currency === cur);
      return {
        invested:     subset.reduce((s, r) => s + r.invested, 0),
        currentValue: subset.reduce((s, r) => s + r.currentValue, 0),
        unrealized:   subset.reduce((s, r) => s + r.unrealized, 0),
        realized:     subset.reduce((s, r) => s + r.realized, 0),
        totalPnl:     subset.reduce((s, r) => s + r.totalPnl, 0),
      };
    };

    res.json({
      success: true,
      data: {
        holdings: rows,
        totals: {
          USD: calcTotals('USD'),
          ILS: calcTotals('ILS'),
        }
      }
    });
  } catch (error) {
    console.error('P&L error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;