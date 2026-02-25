import axios from 'axios';
import NodeCache from 'node-cache';
import db from './init-database.js';

// ─── Cache ────────────────────────────────────────────────────────────────────
const priceCache      = new NodeCache({ stdTTL: 300  });   // 5 min – live prices
const historyCache    = new NodeCache({ stdTTL: 3600 });   // 1 hr  – historical
const exchangeCache   = new NodeCache({ stdTTL: 1800 });   // 30 min – FX rates
const metaCache       = new NodeCache({ stdTTL: 86400 });  // 24 hr – asset type lookup

// ─── Persistent DB cache helpers ──────────────────────────────────────────────
// TTLs in seconds
const DB_CACHE_TTL = { price: 300, history: 3600, news: 900, fx: 1800 };

function dbCacheGet(key) {
  try {
    const row = db.prepare('SELECT data, expires_at FROM api_cache WHERE cache_key = ?').get(key);
    if (!row) return null;
    if (Date.now() > row.expires_at) {
      db.prepare('DELETE FROM api_cache WHERE cache_key = ?').run(key);
      return null;
    }
    return JSON.parse(row.data);
  } catch { return null; }
}

function dbCacheSet(key, data, ttlSeconds) {
  try {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    db.prepare(`
      INSERT INTO api_cache (cache_key, data, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
    `).run(key, JSON.stringify(data), expiresAt);
  } catch (e) { console.warn('DB cache write failed:', e.message); }
}

// Purge expired entries periodically (every 30 min)
setInterval(() => {
  try { db.prepare('DELETE FROM api_cache WHERE expires_at < ?').run(Date.now()); } catch {}
}, 30 * 60 * 1000);

const EXCHANGE_RATE_KEY = 'USD_ILS_RATE';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detect asset type from symbol:
 *   - crypto    →  BTC-USD, ETH-USD, any CoinGecko id
 *   - tase      →  ends with .TA  (Tel Aviv Stock Exchange, prices in ILS)
 *   - us        →  everything else (NYSE/NASDAQ, prices in USD)
 */
export function detectAssetType(symbol) {
  const s = symbol.toUpperCase().trim();
  if (s.endsWith('.TA'))    return 'tase';
  if (s.includes('-USD') || s.includes('-BTC') || s.includes('-ETH')) return 'crypto';
  // common crypto symbols without pair suffix
  const knownCrypto = ['BTC','ETH','BNB','SOL','XRP','ADA','DOGE','AVAX','DOT','MATIC','LINK','UNI','LTC'];
  if (knownCrypto.includes(s)) return 'crypto';
  return 'us';
}

function buildMockPrice(symbol) {
  const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const base  = 50 + (hash % 450);
  const v     = (Math.random() - 0.5) * 10;
  const price = parseFloat((base + v).toFixed(2));
  return {
    symbol: symbol.toUpperCase(),
    price,
    change:        parseFloat(((Math.random() - 0.5) * 10).toFixed(2)),
    changePercent: parseFloat(((Math.random() - 0.5) * 5 ).toFixed(2)),
    volume:        Math.floor(1_000_000 + Math.random() * 10_000_000),
    latestTradingDay: new Date().toISOString().split('T')[0],
    previousClose: parseFloat((price - v).toFixed(2)),
    high: parseFloat((price + Math.random() * 5).toFixed(2)),
    low:  parseFloat((price - Math.random() * 5).toFixed(2)),
    currency: 'USD',
    assetType: 'us',
    source: 'mock'
  };
}

// ─── Provider: Yahoo Finance ──────────────────────────────────────────────────
// Works for US stocks, TASE (.TA), crypto (BTC-USD), FX (USDILS=X)

async function yahooGetPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const resp = await axios.get(url, {
    params:  { interval: '1d', range: '1d' },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 8000
  });
  const meta  = resp.data.chart.result[0].meta;
  const price = meta.regularMarketPrice;
  if (!price) throw new Error('No price in Yahoo response');

  // Yahoo returns ILS for .TA symbols automatically
  const currency = meta.currency || 'USD';

  return {
    symbol:          symbol.toUpperCase(),
    price:           parseFloat(price.toFixed(4)),
    change:          parseFloat((price - meta.previousClose).toFixed(4)),
    changePercent:   parseFloat((((price - meta.previousClose) / meta.previousClose) * 100).toFixed(2)),
    volume:          meta.regularMarketVolume || 0,
    latestTradingDay: new Date(meta.regularMarketTime * 1000).toISOString().split('T')[0],
    previousClose:   meta.previousClose,
    high:            meta.regularMarketDayHigh  || price,
    low:             meta.regularMarketDayLow   || price,
    marketCap:       meta.marketCap || null,
    currency,
    assetType:       detectAssetType(symbol),
    source:          'yahoo'
  };
}

// ─── Provider: Alpha Vantage ──────────────────────────────────────────────────
async function alphaVantageGetPrice(symbol) {
  const API_KEY = process.env.ALPHA_VANTAGE_KEY;
  if (!API_KEY || API_KEY === 'demo') throw new Error('No Alpha Vantage key');

  const resp = await axios.get('https://www.alphavantage.co/query', {
    params:  { function: 'GLOBAL_QUOTE', symbol, apikey: API_KEY },
    timeout: 8000
  });
  const q = resp.data['Global Quote'];
  if (!q?.['05. price']) throw new Error('No Alpha Vantage data');

  return {
    symbol:          symbol.toUpperCase(),
    price:           parseFloat(q['05. price']),
    change:          parseFloat(q['09. change']),
    changePercent:   parseFloat(q['10. change percent'].replace('%', '')),
    volume:          parseInt(q['06. volume']),
    latestTradingDay: q['07. latest trading day'],
    previousClose:   parseFloat(q['08. previous close']),
    high:            parseFloat(q['03. high']),
    low:             parseFloat(q['04. low']),
    currency:        'USD',
    assetType:       detectAssetType(symbol),
    source:          'alphavantage'
  };
}

// ─── Provider: Finnhub ────────────────────────────────────────────────────────
async function finnhubGetPrice(symbol) {
  const API_KEY = process.env.FINNHUB_API_KEY;
  if (!API_KEY) throw new Error('No Finnhub key');

  const resp = await axios.get('https://finnhub.io/api/v1/quote', {
    params:  { symbol, token: API_KEY },
    timeout: 8000
  });
  const d = resp.data;
  if (!d?.c || d.c === 0) throw new Error('No Finnhub data');

  return {
    symbol:          symbol.toUpperCase(),
    price:           d.c,
    change:          d.d,
    changePercent:   d.dp,
    high:            d.h,
    low:             d.l,
    previousClose:   d.pc,
    latestTradingDay: new Date(d.t * 1000).toISOString().split('T')[0],
    volume:          0,
    currency:        'USD',
    assetType:       detectAssetType(symbol),
    source:          'finnhub'
  };
}

// ─── Provider: Twelve Data ────────────────────────────────────────────────────
async function twelveDataGetPrice(symbol) {
  const API_KEY = process.env.TWELVE_DATA_KEY;
  if (!API_KEY) throw new Error('No Twelve Data key');

  const resp = await axios.get('https://api.twelvedata.com/price', {
    params:  { symbol, apikey: API_KEY },
    timeout: 8000
  });
  const d = resp.data;
  if (!d?.price) throw new Error('No Twelve Data response');

  return {
    symbol:          symbol.toUpperCase(),
    price:           parseFloat(d.price),
    change:          0,
    changePercent:   0,
    volume:          0,
    latestTradingDay: new Date().toISOString().split('T')[0],
    previousClose:   0,
    high:            0,
    low:             0,
    currency:        'USD',
    assetType:       detectAssetType(symbol),
    source:          'twelvedata'
  };
}

// ─── Provider: CoinGecko (crypto only, FREE) ──────────────────────────────────
const COINGECKO_IDS = {
  'BTC':   'bitcoin',  'ETH':  'ethereum',  'BNB':   'binancecoin',
  'SOL':   'solana',   'XRP':  'ripple',    'ADA':   'cardano',
  'DOGE':  'dogecoin', 'AVAX': 'avalanche-2','DOT':  'polkadot',
  'MATIC': 'matic-network', 'LINK': 'chainlink', 'UNI': 'uniswap',
  'LTC':   'litecoin', 'ATOM': 'cosmos',    'ALGO':  'algorand',
  'NEAR':  'near',     'FTM':  'fantom',    'SAND':  'the-sandbox',
  'MANA':  'decentraland', 'AAVE': 'aave', 'CRV':   'curve-dao-token'
};

// Normalise "BTC-USD" → "BTC"
function normalizeCryptoSymbol(symbol) {
  return symbol.replace(/-USD$/, '').replace(/-BTC$/, '').replace(/-ETH$/, '').toUpperCase();
}

async function coinGeckoGetPrice(symbol) {
  const base  = normalizeCryptoSymbol(symbol);
  const cgId  = COINGECKO_IDS[base];
  if (!cgId) throw new Error(`Unknown CoinGecko id for ${base}`);

  const apiKey = process.env.COINGECKO_API_KEY; // optional – free tier works without it
  const headers = apiKey ? { 'x-cg-demo-api-key': apiKey } : {};

  const resp = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
    params:  { ids: cgId, vs_currencies: 'usd', include_24hr_change: true, include_24hr_vol: true, include_market_cap: true },
    headers,
    timeout: 8000
  });
  const d = resp.data[cgId];
  if (!d) throw new Error('No CoinGecko data');

  return {
    symbol:          base,
    price:           d.usd,
    change:          0,
    changePercent:   d.usd_24h_change || 0,
    volume:          d.usd_24h_vol    || 0,
    marketCap:       d.usd_market_cap || null,
    latestTradingDay: new Date().toISOString().split('T')[0],
    previousClose:   d.usd / (1 + (d.usd_24h_change || 0) / 100),
    high:            0,
    low:             0,
    currency:        'USD',
    assetType:       'crypto',
    coinGeckoId:     cgId,
    source:          'coingecko'
  };
}

// ─── Smart dispatcher ─────────────────────────────────────────────────────────

/**
 * Get current price for any asset:
 *   - TASE stocks (.TA)  → Yahoo Finance (returns ILS natively)
 *   - Crypto             → CoinGecko → Yahoo Finance
 *   - US stocks          → Yahoo → Finnhub → Alpha Vantage → Twelve Data → mock
 */
export async function getCurrentPrice(symbol) {
  const cacheKey = symbol.toUpperCase();

  // 1) In-memory (fastest)
  const cached = priceCache.get(cacheKey);
  if (cached) { console.log(`✓ Mem-cache hit: ${symbol}`); return cached; }

  // 2) Persistent DB cache (survives restarts, saves API quota)
  const dbKey    = `price_${cacheKey}`;
  const dbCached = dbCacheGet(dbKey);
  if (dbCached) {
    priceCache.set(cacheKey, dbCached); // warm in-memory cache too
    console.log(`✓ DB-cache hit: ${symbol}`);
    return dbCached;
  }

  const assetType = detectAssetType(symbol);
  let result = null;

  // ── TASE (.TA symbols) ──────────────────────────────────────────────────────
  if (assetType === 'tase') {
    try {
      result = await yahooGetPrice(symbol);
      // Yahoo may return currency='ILA' (Israeli Agora = 1/100 shekel) for some .TA stocks.
      // We normalise everything to ILS (shekel) by dividing by 100.
      if (result.currency === 'ILA') {
        result.price         = parseFloat((result.price / 100).toFixed(4));
        result.change        = parseFloat((result.change / 100).toFixed(4));
        result.previousClose = result.previousClose != null ? parseFloat((result.previousClose / 100).toFixed(4)) : null;
        result.high          = result.high != null ? parseFloat((result.high / 100).toFixed(4)) : null;
        result.low           = result.low  != null ? parseFloat((result.low  / 100).toFixed(4)) : null;
      }
      result.currency  = 'ILS';
      result.assetType = 'tase';
      console.log(`✓ TASE ${symbol}: ₪${result.price} (Yahoo)`);
    } catch (e) {
      console.warn(`Yahoo TASE failed for ${symbol}: ${e.message}`);
      result = buildMockPrice(symbol);
      result.currency  = 'ILS';
      result.assetType = 'tase';
    }
    priceCache.set(cacheKey, result);
    if (result.source !== 'mock') dbCacheSet(dbKey, result, DB_CACHE_TTL.price);
    return result;
  }

  // ── Crypto ──────────────────────────────────────────────────────────────────
  if (assetType === 'crypto') {
    // Try CoinGecko first (free, no key needed)
    try {
      result = await coinGeckoGetPrice(symbol);
      console.log(`✓ Crypto ${symbol}: $${result.price} (CoinGecko)`);
    } catch (e) {
      console.warn(`CoinGecko failed for ${symbol}: ${e.message}`);
      try {
        // Yahoo supports BTC-USD, ETH-USD etc.
        const yahooSymbol = normalizeCryptoSymbol(symbol) + '-USD';
        result = await yahooGetPrice(yahooSymbol);
        result.symbol   = normalizeCryptoSymbol(symbol);
        result.assetType = 'crypto';
        console.log(`✓ Crypto ${symbol}: $${result.price} (Yahoo)`);
      } catch (e2) {
        console.warn(`All crypto providers failed for ${symbol}`);
        result = buildMockPrice(symbol);
        result.assetType = 'crypto';
      }
    }
    priceCache.set(cacheKey, result);
    if (result.source !== 'mock') dbCacheSet(dbKey, result, DB_CACHE_TTL.price);
    return result;
  }

  // ── US / international stocks ───────────────────────────────────────────────
  const providers = [
    { name: 'yahoo',       fn: () => yahooGetPrice(symbol) },
    { name: 'finnhub',     fn: () => finnhubGetPrice(symbol) },
    { name: 'alphavantage',fn: () => alphaVantageGetPrice(symbol) },
    { name: 'twelvedata',  fn: () => twelveDataGetPrice(symbol) }
  ];

  for (const p of providers) {
    try {
      result = await p.fn();
      console.log(`✓ ${symbol}: $${result.price} (${p.name})`);
      break;
    } catch (e) {
      console.warn(`${p.name} failed for ${symbol}: ${e.message}`);
    }
  }

  if (!result) {
    console.warn(`All providers failed for ${symbol} – using mock`);
    result = buildMockPrice(symbol);
  }

  priceCache.set(cacheKey, result);
  if (result.source !== 'mock') dbCacheSet(dbKey, result, DB_CACHE_TTL.price);
  return result;
}

// Convenience aliases
export const getCurrentPriceYahoo        = (s) => yahooGetPrice(s);
export const getCurrentPriceAlphaVantage = (s) => alphaVantageGetPrice(s);

/**
 * Fetch multiple prices in parallel
 */
export async function getMultiplePrices(symbols) {
  const results = await Promise.allSettled(symbols.map(s => getCurrentPrice(s)));
  const prices = {};
  results.forEach((r, i) => {
    prices[symbols[i]] = r.status === 'fulfilled' ? r.value : buildMockPrice(symbols[i]);
  });
  return prices;
}

// ─── Historical price data ────────────────────────────────────────────────────

/**
 * Get historical OHLCV data.
 * @param {string} symbol
 * @param {string} range   – '1d','5d','1mo','3mo','6mo','1y','2y','5y','max'
 * @param {string} interval – '1m','5m','15m','1h','1d','1wk','1mo'
 */
export async function getHistoricalData(symbol, range = '1y', interval = '1d') {
  const cacheKey = `hist_${symbol}_${range}_${interval}`;

  // In-memory first
  const cached = historyCache.get(cacheKey);
  if (cached) return cached;

  // Persistent DB cache
  const dbKey    = `history_${symbol}_${range}_${interval}`;
  const dbCached = dbCacheGet(dbKey);
  if (dbCached) {
    historyCache.set(cacheKey, dbCached);
    return dbCached;
  }

  const assetType = detectAssetType(symbol);

  // ── Try Yahoo Finance (works for stocks, TASE, crypto) ──────────────────────
  try {
    const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const resp = await axios.get(url, {
      params:  { interval, range },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 12000
    });

    const result    = resp.data.chart.result[0];
    const timestamps= result.timestamp || [];
    const ohlcv     = result.indicators.quote[0];
    const meta      = result.meta;
    const currency  = meta.currency || (assetType === 'tase' ? 'ILS' : 'USD');

    // Normalise ILA (Israeli Agora) → ILS (shekel) by dividing prices by 100
    const ilaDivisor = (meta.currency === 'ILA') ? 100 : 1;
    const displayCurrency = ilaDivisor === 100 ? 'ILS' : currency;

    const data = timestamps.map((ts, i) => ({
      date:   new Date(ts * 1000).toISOString().split('T')[0],
      open:   ohlcv.open?.[i]   != null ? parseFloat((ohlcv.open[i]   / ilaDivisor).toFixed(4)) : null,
      high:   ohlcv.high?.[i]   != null ? parseFloat((ohlcv.high[i]   / ilaDivisor).toFixed(4)) : null,
      low:    ohlcv.low?.[i]    != null ? parseFloat((ohlcv.low[i]    / ilaDivisor).toFixed(4)) : null,
      close:  ohlcv.close?.[i]  != null ? parseFloat((ohlcv.close[i]  / ilaDivisor).toFixed(4)) : null,
      volume: ohlcv.volume?.[i] || 0
    })).filter(d => d.close != null);

    const payload = { symbol: symbol.toUpperCase(), range, interval, currency: displayCurrency, assetType, data, source: 'yahoo' };
    historyCache.set(cacheKey, payload);
    dbCacheSet(dbKey, payload, DB_CACHE_TTL.history);
    return payload;

  } catch (e) {
    console.warn(`Yahoo history failed for ${symbol}: ${e.message}`);
  }

  // ── Alpha Vantage fallback (US stocks only) ──────────────────────────────────
  if (assetType === 'us') {
    const AV_KEY = process.env.ALPHA_VANTAGE_KEY;
    if (AV_KEY && AV_KEY !== 'demo') {
      try {
        const fn   = interval === '1d' ? 'TIME_SERIES_DAILY' : 'TIME_SERIES_WEEKLY';
        const key  = interval === '1d' ? 'Time Series (Daily)' : 'Weekly Time Series';
        const resp = await axios.get('https://www.alphavantage.co/query', {
          params:  { function: fn, symbol, outputsize: 'compact', apikey: AV_KEY },
          timeout: 10000
        });
        const series = resp.data[key];
        if (!series) throw new Error('No AV series');

        const data = Object.entries(series).map(([date, v]) => ({
          date,
          open:   parseFloat(v['1. open']),
          high:   parseFloat(v['2. high']),
          low:    parseFloat(v['3. low']),
          close:  parseFloat(v['4. close']),
          volume: parseInt(v['5. volume']) || 0
        })).sort((a, b) => a.date.localeCompare(b.date));

        const payload = { symbol: symbol.toUpperCase(), range, interval, currency: 'USD', assetType, data, source: 'alphavantage' };
        historyCache.set(cacheKey, payload);
        dbCacheSet(dbKey, payload, DB_CACHE_TTL.history);
        return payload;
      } catch (e) {
        console.warn(`AV history failed for ${symbol}: ${e.message}`);
      }
    }
  }

  // ── CoinGecko fallback (crypto) ──────────────────────────────────────────────
  if (assetType === 'crypto') {
    try {
      const base = normalizeCryptoSymbol(symbol);
      const cgId = COINGECKO_IDS[base];
      if (cgId) {
        const days = range === '1d' ? 1 : range === '5d' ? 5 : range === '1mo' ? 30 :
                     range === '3mo' ? 90 : range === '6mo' ? 180 : range === '1y' ? 365 :
                     range === '2y' ? 730 : 1825;
        const resp = await axios.get(`https://api.coingecko.com/api/v3/coins/${cgId}/market_chart`, {
          params:  { vs_currency: 'usd', days },
          timeout: 12000
        });
        const data = resp.data.prices.map(([ts, price]) => ({
          date:   new Date(ts).toISOString().split('T')[0],
          open:   price, high: price, low: price, close: price, volume: 0
        }));
        const payload = { symbol: base, range, interval, currency: 'USD', assetType: 'crypto', data, source: 'coingecko' };
        historyCache.set(cacheKey, payload);
        dbCacheSet(dbKey, payload, DB_CACHE_TTL.history);
        return payload;
      }
    } catch (e) {
      console.warn(`CoinGecko history failed: ${e.message}`);
    }
  }

  return { symbol, range, interval, currency: 'USD', assetType, data: [], source: 'none' };
}

// ─── News & Sentiment ─────────────────────────────────────────────────────────

/**
 * Get recent news and sentiment for a symbol.
 * Uses Finnhub (free tier) or Alpha Vantage news.
 */
export async function getNewsAndSentiment(symbol, limit = 20) {
  const cacheKey = `news_${symbol}`;
  const cached   = newsCache.get(cacheKey);
  if (cached) return cached;

  const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

  // ── Finnhub company news ────────────────────────────────────────────────────
  if (FINNHUB_KEY) {
    try {
      const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
      const to   = new Date().toISOString().split('T')[0];
      const resp = await axios.get('https://finnhub.io/api/v1/company-news', {
        params:  { symbol, from, to, token: FINNHUB_KEY },
        timeout: 8000
      });
      const articles = (resp.data || []).slice(0, limit).map(a => ({
        headline: a.headline,
        summary:  a.summary,
        url:      a.url,
        source:   a.source,
        datetime: new Date(a.datetime * 1000).toISOString(),
        sentiment: null  // Finnhub free tier doesn't include sentiment
      }));

      // Try Finnhub sentiment
      let sentimentData = null;
      try {
        const sr = await axios.get('https://finnhub.io/api/v1/news-sentiment', {
          params:  { symbol, token: FINNHUB_KEY },
          timeout: 5000
        });
        if (sr.data?.sentiment) {
          sentimentData = {
            bullish:  sr.data.sentiment.bullishPercent,
            bearish:  sr.data.sentiment.bearishPercent,
            score:    sr.data.companyNewsScore,
            articlesMentions: sr.data.buzz?.articlesInLastWeek
          };
        }
      } catch (_) {}

      const payload = { symbol, articles, sentiment: sentimentData, source: 'finnhub' };
      newsCache.set(cacheKey, payload);
      return payload;
    } catch (e) {
      console.warn(`Finnhub news failed for ${symbol}: ${e.message}`);
    }
  }

  // ── Alpha Vantage news fallback ─────────────────────────────────────────────
  const AV_KEY = process.env.ALPHA_VANTAGE_KEY;
  if (AV_KEY && AV_KEY !== 'demo') {
    try {
      const resp = await axios.get('https://www.alphavantage.co/query', {
        params:  { function: 'NEWS_SENTIMENT', tickers: symbol, limit, apikey: AV_KEY },
        timeout: 10000
      });
      const feed = resp.data?.feed || [];
      const articles = feed.map(a => ({
        headline: a.title,
        summary:  a.summary,
        url:      a.url,
        source:   a.source,
        datetime: a.time_published,
        sentiment: a.overall_sentiment_label
      }));

      const avgSentiment = feed.reduce((sum, a) => sum + parseFloat(a.overall_sentiment_score || 0), 0) / (feed.length || 1);
      const payload = { symbol, articles, sentiment: { score: avgSentiment }, source: 'alphavantage' };
      newsCache.set(cacheKey, payload);
      return payload;
    } catch (e) {
      console.warn(`AV news failed for ${symbol}: ${e.message}`);
    }
  }

  return { symbol, articles: [], sentiment: null, source: 'none' };
}

// Separate short-lived cache for news (15 min)
const newsCache = new NodeCache({ stdTTL: 900 });

// ─── USD/ILS Exchange Rate ────────────────────────────────────────────────────

export async function getUsdIlsRate() {
  const cached = exchangeCache.get(EXCHANGE_RATE_KEY);
  if (cached) return cached;

  // Yahoo Finance USDILS=X
  try {
    const resp = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/USDILS=X', {
      params:  { interval: '1d', range: '1d' },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 5000
    });
    const rate = resp.data.chart.result[0].meta.regularMarketPrice;
    if (rate && rate > 0) {
      const data = { usdToIls: parseFloat(rate.toFixed(4)), source: 'yahoo', updatedAt: new Date().toISOString() };
      exchangeCache.set(EXCHANGE_RATE_KEY, data);
      console.log(`✓ USD/ILS: ${data.usdToIls} (Yahoo)`);
      return data;
    }
  } catch (e) {
    console.warn(`Yahoo FX failed: ${e.message}`);
  }

  // Bank of Israel fallback
  try {
    const resp = await axios.get('https://boi.org.il/PublicApi/GetExchangeRates?asArray=true', { timeout: 5000 });
    const usdEntry = resp.data.find(r => r.key === 'USD');
    if (usdEntry) {
      const data = { usdToIls: parseFloat(usdEntry.currentExchangeRate.toFixed(4)), source: 'boi', updatedAt: new Date().toISOString() };
      exchangeCache.set(EXCHANGE_RATE_KEY, data);
      console.log(`✓ USD/ILS: ${data.usdToIls} (Bank of Israel)`);
      return data;
    }
  } catch (e) {
    console.warn(`Bank of Israel FX failed: ${e.message}`);
  }

  console.warn('⚠ Using fallback USD/ILS rate 3.7');
  return { usdToIls: 3.7, source: 'fallback', updatedAt: new Date().toISOString() };
}

// ─── Provider status / diagnostics ───────────────────────────────────────────

export function getProviderStatus() {
  return {
    yahoo:        { available: true,  keyRequired: false },
    alphavantage: { available: !!process.env.ALPHA_VANTAGE_KEY, keyRequired: true  },
    finnhub:      { available: !!process.env.FINNHUB_API_KEY,   keyRequired: true  },
    twelvedata:   { available: !!process.env.TWELVE_DATA_KEY,    keyRequired: true  },
    coingecko:    { available: true,  keyRequired: false, note: 'optional key for higher limits' }
  };
}

export function clearPriceCache()    { priceCache.flushAll();   }
export function clearHistoryCache()  { historyCache.flushAll(); }
export function getCacheStats() {
  return {
    prices:    { keys: priceCache.keys().length,   ...priceCache.getStats()   },
    history:   { keys: historyCache.keys().length, ...historyCache.getStats() },
    exchange:  { keys: exchangeCache.keys().length }
  };
}

export default {
  getCurrentPrice, getCurrentPriceYahoo, getCurrentPriceAlphaVantage,
  getMultiplePrices, getHistoricalData, getNewsAndSentiment,
  getUsdIlsRate, detectAssetType, getProviderStatus,
  clearPriceCache, clearHistoryCache, getCacheStats
};
