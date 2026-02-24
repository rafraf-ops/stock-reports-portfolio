import express from 'express';
import * as stockPriceAPI from '../services/stock-price-api.js';

const router = express.Router();

// ─── GET /api/stock-price/providers ──────────────────────────────────────────
// Returns status of all configured data providers
router.get('/providers', (req, res) => {
  res.json({ success: true, data: stockPriceAPI.getProviderStatus() });
});

// ─── GET /api/stock-price/cache ───────────────────────────────────────────────
router.get('/cache', (req, res) => {
  res.json({ success: true, data: stockPriceAPI.getCacheStats() });
});

// ─── GET /api/stock-price/:symbol/history?range=1y&interval=1d ───────────────
// Historical OHLCV price data
router.get('/:symbol/history', async (req, res) => {
  try {
    const { symbol } = req.params;
    const range    = req.query.range    || '1y';
    const interval = req.query.interval || '1d';

    const validRanges    = ['1d','5d','1mo','3mo','6mo','1y','2y','5y','max'];
    const validIntervals = ['1m','5m','15m','30m','1h','1d','1wk','1mo'];
    if (!validRanges.includes(range) || !validIntervals.includes(interval)) {
      return res.status(400).json({ success: false, error: 'Invalid range or interval' });
    }

    console.log(`📈 Historical data for ${symbol} (${range}/${interval})`);
    const data = await stockPriceAPI.getHistoricalData(symbol, range, interval);

    res.json({ success: true, data });
  } catch (error) {
    console.error(`History error for ${req.params.symbol}:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /api/stock-price/:symbol/news ───────────────────────────────────────
// Recent news + sentiment analysis
router.get('/:symbol/news', async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    console.log(`📰 News for ${symbol}`);
    const data = await stockPriceAPI.getNewsAndSentiment(symbol, limit);

    res.json({ success: true, data });
  } catch (error) {
    console.error(`News error for ${req.params.symbol}:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /api/stock-price/:symbol ─────────────────────────────────────────────
// Current price – works for US stocks, TASE (.TA), crypto
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    console.log(`💹 Price for ${symbol}`);
    const priceData = await stockPriceAPI.getCurrentPrice(symbol);
    res.json({ success: true, data: priceData });
  } catch (error) {
    console.error(`Price error for ${req.params.symbol}:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
