import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import companiesRouter from './routes/companies.js';
import portfolioRouter from './routes/portfolio.js';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import stockPriceRouter from './routes/stock-price.js';
import aiRouter from './routes/ai.js';
import financeRouter from './routes/finance.js';
import importRouter from './routes/import.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cookieParser());
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/auth', authRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/stock-price', stockPriceRouter);
app.use('/api/ai', aiRouter);
app.use('/api/finance', financeRouter);
app.use('/api/import', importRouter);


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
