import db from './init-database.js';

// Initialize with default companies if database is empty
const existingCompanies = db.prepare('SELECT COUNT(*) as count FROM companies').get();

if (existingCompanies.count === 0) {
  console.log('📊 Initializing default companies...');
  
  const defaultCompanies = [
    { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', market_cap: 2800000000000 },
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', market_cap: 3000000000000 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', market_cap: 3100000000000 },
  ];
  
  defaultCompanies.forEach(c => {
    db.prepare(`
      INSERT INTO companies (symbol, name, sector, market_cap, last_updated)
      VALUES (?, ?, ?, ?, ?)
    `).run(c.symbol, c.name, c.sector, c.market_cap, new Date().toISOString());
  });
  
  // Add sample reports for NVDA
  const sampleReports = [
    { symbol: 'NVDA', revenue: 35082000000, net_income: 19309000000, eps: 0.78, filing_date: '2024-11-20', fiscal_year: 2024, fiscal_quarter: 'Q3' },
    { symbol: 'NVDA', revenue: 30040000000, net_income: 16599000000, eps: 0.67, filing_date: '2024-08-28', fiscal_year: 2024, fiscal_quarter: 'Q2' },
  ];
  
  sampleReports.forEach(r => {
    db.prepare(`
      INSERT INTO reports (symbol, revenue, net_income, eps, filing_date, fiscal_year, fiscal_quarter)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(r.symbol, r.revenue, r.net_income, r.eps, r.filing_date, r.fiscal_year, r.fiscal_quarter);
  });
  
  console.log('✅ Default data loaded');
}

export const getCompanies = () => {
  return db.prepare('SELECT * FROM companies ORDER BY symbol').all();
};

export const getCompany = (symbol) => {
  return db.prepare('SELECT * FROM companies WHERE symbol = ?').get(symbol.toUpperCase());
};

export const searchCompanies = (query) => {
  const pattern = `%${query}%`;
  return db.prepare(
    'SELECT * FROM companies WHERE symbol LIKE ? OR name LIKE ? ORDER BY symbol LIMIT 10'
  ).all(pattern, pattern);
};

export const getReports = (symbol, limit = 8) => {
  return db.prepare(`
    SELECT * FROM reports 
    WHERE symbol = ? 
    ORDER BY filing_date DESC 
    LIMIT ?
  `).all(symbol.toUpperCase(), limit);
};

export const insertReport = (report) => {
  const result = db.prepare(`
    INSERT INTO reports (
      symbol, revenue, net_income, gross_profit, operating_income,
      total_assets, total_liabilities, shareholders_equity,
      cash_flow_operating, eps, filing_date, fiscal_year, fiscal_quarter
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    report.symbol,
    report.revenue,
    report.net_income,
    report.gross_profit || null,
    report.operating_income || null,
    report.total_assets || null,
    report.total_liabilities || null,
    report.shareholders_equity || null,
    report.cash_flow_operating || null,
    report.eps || null,
    report.filing_date,
    report.fiscal_year,
    report.fiscal_quarter
  );
  
  return { lastInsertRowid: result.lastInsertRowid };
};

export const upsertCompany = (company) => {
  const existing = getCompany(company.symbol);
  
  if (existing) {
    db.prepare(`
      UPDATE companies 
      SET name = ?, sector = ?, market_cap = ?, last_updated = ?
      WHERE symbol = ?
    `).run(
      company.name,
      company.sector,
      company.market_cap,
      company.last_updated,
      company.symbol
    );
  } else {
    db.prepare(`
      INSERT INTO companies (symbol, name, sector, market_cap, last_updated)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      company.symbol,
      company.name,
      company.sector,
      company.market_cap,
      company.last_updated
    );
  }
  
  return company;
};

export const calculateGrowthMetrics = (symbol) => {
  const reports = getReports(symbol, 2);
  
  if (reports.length < 2) return null;
  
  const latest = reports[0];
  const previous = reports[1];
  
  if (!latest.revenue || !previous.revenue) return null;
  
  return {
    revenue_qoq: ((latest.revenue - previous.revenue) / previous.revenue * 100).toFixed(2),
    net_income_qoq: latest.net_income && previous.net_income 
      ? ((latest.net_income - previous.net_income) / previous.net_income * 100).toFixed(2)
      : null,
    profit_margin: latest.net_income 
      ? ((latest.net_income / latest.revenue) * 100).toFixed(2)
      : null,
    trend: reports.map(r => ({
      date: r.filing_date,
      revenue: r.revenue,
      net_income: r.net_income,
      quarter: r.fiscal_quarter,
      fiscal_year: r.fiscal_year
    }))
  };
};

export const getCachedAnalysis = (symbol) => {
  // Not implemented yet
  return null;
};

export const saveAnalysis = (analysis) => {
  // Not implemented yet
  return { lastInsertRowid: 0 };
};

export default {
  getCompanies,
  getCompany,
  searchCompanies,
  getReports,
  insertReport,
  upsertCompany,
  calculateGrowthMetrics,
  getCachedAnalysis,
  saveAnalysis
};