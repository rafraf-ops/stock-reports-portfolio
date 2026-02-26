import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import companiesRouter from './routes/companies.js';
import portfolioRouter from './routes/portfolio.js';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import stockPriceRouter from './routes/stock-price.js';
import aiRouter from './routes/ai.js';
import financeRouter from './routes/finance.js';
import importRouter from './routes/import.js';
import watchlistRouter from './routes/watchlist.js';
import adminRouter from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables — explicit path works regardless of PM2 cwd
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ── JWT secret sanity check ──────────────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
  console.warn('⚠️  WARNING: JWT_SECRET is not set or uses the default value. Set a strong secret in .env!');
}

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security headers (Helmet) ────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow frontend dev server embedding
  contentSecurityPolicy: false,     // Configure separately if needed
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, same-origin)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Global rate limiter – anti-bot / DDoS protection ────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,                  // max 300 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

// ── Strict limiter for auth endpoints ────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 login/register attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts. Please try again in 15 minutes.' },
});

// ── Strict limiter for AI/expensive endpoints ─────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // max 10 AI calls per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'AI rate limit reached. Please wait a moment.' },
});

// ── Price API limiter (prevent scraping) ──────────────────────────────────────
const priceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // max 60 price requests per minute per IP (1/sec)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Price API rate limit reached.' },
});

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Financial Analyzer API',
    version: '1.0.0',
    endpoints: {
      companies: '/api/companies',
      analysis: '/api/companies/:symbol/analysis',
      compare: '/api/companies/compare'
    }
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/stock-price', priceLimiter, stockPriceRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/finance', financeRouter);
app.use('/api/import', importRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/admin',    adminRouter);


// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   Financial Analyzer API Server          ║
║   Running on http://localhost:${PORT}       ║
╚═══════════════════════════════════════════╝

Available endpoints:
  GET  /api/companies
  GET  /api/companies/:symbol
  GET  /api/companies/:symbol/reports
  GET  /api/companies/:symbol/analysis
  POST /api/companies/:symbol/refresh
  POST /api/companies/compare

Environment:
  NODE_ENV: ${process.env.NODE_ENV || 'development'}
  Claude API: ${process.env.CLAUDE_API_KEY ? '✓ Configured' : '✗ Missing'}
  Database: ${process.env.DATABASE_PATH || './database.db'}
  `);
});

export default app;
