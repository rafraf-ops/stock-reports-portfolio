import axios from 'axios';
import NodeCache from 'node-cache';

const USER_AGENT = 'Financial Analyzer contact@example.com';
const SEC_BASE_URL = 'https://data.sec.gov';

// Cache SEC tickers list for 1 hour (it rarely changes)
const tickersCache = new NodeCache({ stdTTL: 3600 });
const TICKERS_CACHE_KEY = 'sec_company_tickers';

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200; // 200ms between requests (SEC requires 100ms minimum)

async function rateLimitedRequest(url, options = {}) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
  
  try {
    const response = await axios.get(url, {
      ...options,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Host': 'data.sec.gov',
        ...options.headers
      },
      timeout: 10000
    });
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 403) {
      console.error('❌ SEC API blocked request - rate limited or missing headers');
    }
    throw error;
  }
}

async function getTickersList() {
  let tickers = tickersCache.get(TICKERS_CACHE_KEY);
  if (tickers) return tickers;

  const url = 'https://www.sec.gov/files/company_tickers.json';
  const response = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 15000
  });

  tickers = Object.values(response.data);
  tickersCache.set(TICKERS_CACHE_KEY, tickers);
  console.log(`Cached ${tickers.length} SEC tickers`);
  return tickers;
}

export async function getCompanyCIK(ticker) {
  try {
    const tickers = await getTickersList();

    const company = tickers.find(
      c => c.ticker.toUpperCase() === ticker.toUpperCase()
    );

    if (!company) {
      throw new Error(`Company ${ticker} not found in SEC database`);
    }

    return {
      cik: String(company.cik_str).padStart(10, '0'),
      name: company.title,
      ticker: company.ticker
    };
  } catch (error) {
    console.error('Error fetching CIK:', error.message);
    throw error;
  }
}

export async function searchCompanies(query) {
  try {
    const tickers = await getTickersList();
    const q = query.toLowerCase().trim();

    const results = tickers
      .filter(c =>
        c.ticker.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
      )
      .slice(0, 10)
      .map(c => ({
        ticker: c.ticker,
        name: c.title,
        cik: String(c.cik_str).padStart(10, '0')
      }));

    return results;
  } catch (error) {
    console.error('Error searching companies:', error.message);
    throw error;
  }
}

export async function getCompanyFacts(cik) {
  try {
    // THIS is the correct endpoint for facts (not submissions)
    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
    console.log(`Fetching facts from: ${url}`);
    const data = await rateLimitedRequest(url);
    
    return data;
  } catch (error) {
    console.error('Error fetching company facts:', error.message);
    throw error;
  }
}

export async function extractFinancialMetrics(cik) {
  try {
    const companyFacts = await getCompanyFacts(cik);
    
    console.log('📊 Checking for financial facts...');
    
    // Check what we got back
    if (!companyFacts) {
      console.log('❌ No data returned from SEC');
      throw new Error('No data from SEC');
    }
    
    console.log('Available top-level keys:', Object.keys(companyFacts));
    
    // Check if facts exist
    if (!companyFacts.facts) {
      console.log('⚠️ No facts property in response');
      throw new Error('No facts in SEC response');
    }
    
    console.log('Available fact categories:', Object.keys(companyFacts.facts));
    
    const facts = companyFacts.facts['us-gaap'];
    
    if (!facts) {
      console.log('⚠️ No US-GAAP facts found');
      throw new Error('No US-GAAP facts');
    }
    
    console.log('✓ US-GAAP facts found, extracting data...');
    
    const getLatestValue = (concept) => {
      const data = facts[concept]?.units?.USD;
      if (!data || data.length === 0) return null;
      
      const sorted = data
        .filter(item => item.form === '10-Q' || item.form === '10-K')
        .sort((a, b) => new Date(b.end) - new Date(a.end));
      
      return sorted[0]?.val || null;
    };
    
    const getLatestEntry = (concept) => {
      const data = facts[concept]?.units?.USD;
      if (!data || data.length === 0) return null;
      
      const sorted = data
        .filter(item => item.form === '10-Q' || item.form === '10-K')
        .sort((a, b) => new Date(b.end) - new Date(a.end));
      
      return sorted[0] || null;
    };
    
    // Try multiple revenue field names
    const revenueFields = [
      'Revenues',
      'RevenueFromContractWithCustomerExcludingAssessedTax',
      'SalesRevenueNet',
      'RevenueFromContractWithCustomerIncludingAssessedTax'
    ];
    
    let latestRevenue = null;
    for (const field of revenueFields) {
      latestRevenue = getLatestEntry(field);
      if (latestRevenue) {
        console.log(`✓ Found revenue in field: ${field}`);
        break;
      }
    }
    
    if (!latestRevenue) {
      console.log('⚠️ Could not find revenue data in any field');
    }
    
    return {
      revenue: latestRevenue?.val || null,
      netIncome: getLatestValue('NetIncomeLoss'),
      assets: getLatestValue('Assets'),
      liabilities: getLatestValue('Liabilities'),
      equity: getLatestValue('StockholdersEquity'),
      eps: getLatestValue('EarningsPerShareBasic'),
      filingDate: latestRevenue?.filed || new Date().toISOString(),
      fiscalYear: latestRevenue?.fy || new Date().getFullYear(),
      fiscalQuarter: latestRevenue?.fp || 'Q1',
      source: 'sec'
    };
    
  } catch (error) {
    console.error('Error extracting metrics:', error.message);
    throw error;
  }
}

export default {
  getCompanyCIK,
  getCompanyFacts,
  extractFinancialMetrics,
  searchCompanies
};