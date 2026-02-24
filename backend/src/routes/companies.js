import express from 'express';
import * as mockDB from '../services/mock-database.js';

const router = express.Router();

/**
 * GET /api/companies
 * Get all companies
 */
router.get('/', async (req, res) => {
  try {
    const companies = mockDB.getCompanies();
    res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/companies/search?q=query
 * Search companies by name or ticker (local DB + SEC)
 */
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.trim().length < 2) {
      return res.json({ success: true, data: { local: [], sec: [] } });
    }

    // Search local database
    const localResults = mockDB.searchCompanies(query);

    // Search SEC tickers list
    let secResults = [];
    try {
      const secAPI = await import('../services/sec-api.js');
      secResults = await secAPI.searchCompanies(query);

      // Filter out companies already in local results
      const localSymbols = new Set(localResults.map(c => c.symbol));
      secResults = secResults.filter(c => !localSymbols.has(c.ticker));
    } catch (err) {
      console.log('SEC search failed, returning local results only:', err.message);
    }

    res.json({
      success: true,
      data: {
        local: localResults,
        sec: secResults
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/companies/:symbol
 * Get company details with latest report
 */
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const company = mockDB.getCompany(symbol);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }
    
    const reports = mockDB.getReports(symbol);
    const latest_report = reports[0] || null;
    const metrics = mockDB.calculateGrowthMetrics(symbol);
    
    res.json({
      success: true,
      data: {
        company,
        latest_report,
        metrics
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/companies/:symbol/reports
 * Get historical reports
 */
router.get('/:symbol/reports', async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit) || 8;
    const reports = mockDB.getReports(symbol, limit);
    
    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/companies/:symbol/analysis
 * Get AI analysis
 */
router.get('/:symbol/analysis', async (req, res) => {
  try {
    const { symbol } = req.params;
    const mockClaudeService = await import('../services/mock-claude-service.js');
    
    const company = mockDB.getCompany(symbol);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }
    
    const reports = mockDB.getReports(symbol, 4);
    const analysis = await mockClaudeService.generateHebrewSummary(company, reports);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/companies/:symbol/refresh
 * Fetch company data from SEC and add to database
 * Falls back to FMP if SEC data unavailable
 */
router.post('/:symbol/refresh', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    console.log(`🔍 Fetching ${symbol} from SEC...`);
    
    // Import SEC API
    const secAPI = await import('../services/sec-api.js');
    
    // Step 1: Get company CIK and basic info
    console.log(`⏳ Step 1: Getting company info for ${symbol}...`);
    let companyInfo;
    try {
      companyInfo = await secAPI.getCompanyCIK(symbol);
      console.log(`✓ Found company: ${companyInfo.name} (CIK: ${companyInfo.cik})`);
    } catch (error) {
      console.error(`❌ Could not find ${symbol} in SEC database`);
      throw new Error(`Company ${symbol} not found in SEC database. Make sure the ticker is correct.`);
    }
    
    // Step 2: Get market cap & sector, then add to database
    console.log(`⏳ Step 2: Getting market cap & sector for ${symbol}...`);
    let marketCap = null;
    let sector = 'Other';

    try {
      const fmpAPI = await import('../services/fmp-api.js');
      const profile = await fmpAPI.getCompanyProfile(symbol);
      if (profile) {
        marketCap = profile.mktCap || null;
        sector = profile.sector || 'Other';
        console.log(`✓ FMP profile: sector=${sector}, marketCap=${marketCap}`);
      }
    } catch (fmpErr) {
      console.log(`⚠️ FMP profile unavailable: ${fmpErr.message}`);
    }

    const company = {
      symbol: symbol.toUpperCase(),
      name: companyInfo.name,
      sector,
      market_cap: marketCap,
      last_updated: new Date().toISOString()
    };

    mockDB.upsertCompany(company);
    console.log(`✓ Company added to database: ${company.name}`);
    
    // Step 3: Try to get financial data - SEC first, then FMP fallback
    let metrics = null;
    let hasFinancialData = false;
    let dataSource = 'none';
    
    try {
  console.log(`⏳ Step 3: Attempting to get financial data...`);
  
  // Try SEC first
  try {
    console.log(`   Trying SEC...`);
    metrics = await secAPI.extractFinancialMetrics(companyInfo.cik);
    
    if (metrics && metrics.revenue) {
      hasFinancialData = true;
      dataSource = 'SEC';
      console.log(`✓ Got data from SEC`);
    } else {
      throw new Error('No SEC data');
    }
  } catch (secError) {
    console.log(`⚠️ SEC data unavailable, trying Alpha Vantage...`);
    
    // Fallback to Alpha Vantage
    try {
      const avAPI = await import('../services/alphavantage-fundamentals.js');
      metrics = await avAPI.extractFinancialMetrics(symbol);
      
      if (metrics && metrics.revenue) {
        hasFinancialData = true;
        dataSource = 'Alpha Vantage';
        console.log(`✓ Got data from Alpha Vantage`);
      }
    } catch (avError) {
      console.log(`⚠️ Alpha Vantage also unavailable: ${avError.message}`);
    }
  }
  
  // Add report if we got data from any source
  if (hasFinancialData && metrics.revenue) {
    const report = {
      symbol: symbol.toUpperCase(),
      revenue: metrics.revenue,
      net_income: metrics.netIncome,
      gross_profit: metrics.grossProfit || null,
      operating_income: metrics.operatingIncome || null,
      total_assets: metrics.assets,
      total_liabilities: metrics.liabilities,
      shareholders_equity: metrics.equity,
      cash_flow_operating: metrics.cashFlow || null,
      eps: metrics.eps,
      filing_date: metrics.filingDate || new Date().toISOString(),
      fiscal_year: metrics.fiscalYear || new Date().getFullYear(),
      fiscal_quarter: metrics.fiscalQuarter || 'Q1'
    };
    
    mockDB.insertReport(report);
    console.log(`✓ Financial report added (source: ${dataSource})`);
    console.log(`   Revenue: $${(metrics.revenue / 1000000).toFixed(0)}M`);
  } else {
    console.log(`⚠️ No financial data available from any source`);
    console.log(`   (Company still added and can be tracked)`);
  }
} catch (metricsError) {
  console.log(`⚠️ Could not get financial metrics: ${metricsError.message}`);
  console.log(`   Company was still added successfully`);
}
    
    console.log(`🎉 Successfully added ${symbol}!`);
    
    // Return success with appropriate message
    const message = hasFinancialData 
      ? `${companyInfo.name} added with financial data from ${dataSource}`
      : `${companyInfo.name} added (financial data unavailable - you can still track it in your portfolio)`;
    
    res.json({
      success: true,
      company: companyInfo.name,
      message: message,
      hasFinancialData: hasFinancialData,
      dataSource: dataSource,
      data: {
        company,
        metrics
      }
    });
    
  } catch (error) {
    console.error(`❌ Error adding ${req.params.symbol}:`, error.message);
    console.error(error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/companies/compare
 * Compare multiple companies
 */
router.post('/compare', async (req, res) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of at least 2 symbols'
      });
    }

    const results = symbols.map(symbol => {
      const company = mockDB.getCompany(symbol);
      const reports = mockDB.getReports(symbol, 4);
      const metrics = mockDB.calculateGrowthMetrics(symbol);
      return { company, reports, metrics };
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;