import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../database.db');
const db = new Database(dbPath);

console.log('🔧 Initializing database...');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create companies table
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sector TEXT,
    industry TEXT,
    market_cap REAL,
    country TEXT DEFAULT 'US',
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create financial reports table
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_symbol TEXT NOT NULL,
    report_type TEXT NOT NULL,
    filing_date DATE,
    period_end DATE,
    fiscal_year INTEGER,
    fiscal_quarter INTEGER,
    revenue REAL,
    net_income REAL,
    eps REAL,
    gross_profit REAL,
    operating_income REAL,
    total_assets REAL,
    total_liabilities REAL,
    shareholders_equity REAL,
    cash_flow_operating REAL,
    raw_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_symbol) REFERENCES companies(symbol)
  );
`);

// Create analysis cache table
db.exec(`
  CREATE TABLE IF NOT EXISTS analysis_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_symbol TEXT NOT NULL,
    report_id INTEGER,
    analysis_type TEXT DEFAULT 'summary',
    language TEXT DEFAULT 'he',
    summary_text TEXT,
    insights TEXT,
    risks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_symbol) REFERENCES companies(symbol),
    FOREIGN KEY (report_id) REFERENCES reports(id)
  );
`);

// Create indices for better performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_reports_symbol ON reports(company_symbol);
  CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(filing_date);
  CREATE INDEX IF NOT EXISTS idx_analysis_symbol ON analysis_cache(company_symbol);
`);

// Insert sample companies for testing
const insertCompany = db.prepare(`
  INSERT OR IGNORE INTO companies (symbol, name, sector, industry, country)
  VALUES (?, ?, ?, ?, ?)
`);

const sampleCompanies = [
  ['NVDA', 'NVIDIA Corporation', 'Technology', 'Semiconductors', 'US'],
  ['AAPL', 'Apple Inc.', 'Technology', 'Consumer Electronics', 'US'],
  ['MSFT', 'Microsoft Corporation', 'Technology', 'Software', 'US'],
  ['GOOGL', 'Alphabet Inc.', 'Technology', 'Internet Services', 'US'],
  ['TSLA', 'Tesla, Inc.', 'Automotive', 'Electric Vehicles', 'US'],
  ['AMD', 'Advanced Micro Devices', 'Technology', 'Semiconductors', 'US'],
  ['INTC', 'Intel Corporation', 'Technology', 'Semiconductors', 'US']
];

const insertMany = db.transaction((companies) => {
  for (const company of companies) {
    insertCompany.run(...company);
  }
});

insertMany(sampleCompanies);

console.log('✅ Database initialized successfully!');
console.log(`📊 Added ${sampleCompanies.length} sample companies`);
console.log(`📁 Database location: ${dbPath}`);

db.close();
