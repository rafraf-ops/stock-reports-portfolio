# import axios from 'axios';

import axios from 'axios';

const API_KEY = process.env.ALPHA_VANTAGE_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

console.log('🔑 Alpha Vantage API Key:', API_KEY ? 'Loaded' : 'NOT SET');

// Rate limiting - Alpha Vantage allows 5 calls per minute
let lastCallTime = 0;
const MIN_DELAY = 12000; // 12 seconds between calls

async function rateLimitedCall(params) {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  
  if (timeSinceLastCall < MIN_DELAY) {
    const waitTime = MIN_DELAY - timeSinceLastCall;
    console.log(`   ⏳ Rate limiting: waiting ${(waitTime/1000).toFixed(1)}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastCallTime = Date.now();
  
  const response = await axios.get(BASE_URL, { params, timeout: 15000 });
  return response;
}

const API_KEY = process.env.ALPHA_VANTAGE_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

console.log('🔑 Alpha Vantage API Key:', API_KEY ? 'Loaded' : 'NOT SET');

async function getCompanyOverview(symbol) {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'OVERVIEW',
        symbol: symbol,
        apikey: API_KEY
      },
      timeout: 10000
    });
    
    if (response.data.Note) {
      throw new Error('API rate limit reached');
    }
    
    if (!response.data.Symbol) {
      throw new Error('No data available');
    }
    
    return response.data;
  } catch (error) {
    console.error(`Alpha Vantage overview error for ${symbol}:`, error.message);
    throw error;
  }
}

async function getIncomeStatement(symbol) {
  try {
    const response = await rateLimitedCall({
      function: 'INCOME_STATEMENT',
      symbol: symbol,
      apikey: API_KEY
    });
    
    if (response.data.Note) {
      throw new Error('API rate limit reached');
    }
    
    return response.data;
  } catch (error) {
    console.error(`Alpha Vantage income statement error for ${symbol}:`, error.message);
    throw error;
  }
}

async function getBalanceSheet(symbol) {
  try {
    const response = await rateLimitedCall({
      function: 'BALANCE_SHEET',
      symbol: symbol,
      apikey: API_KEY
    });
    
    if (response.data.Note) {
      throw new Error('API rate limit reached');
    }
    
    return response.data;
  } catch (error) {
    console.error(`Alpha Vantage balance sheet error for ${symbol}:`, error.message);
    throw error;
  }
}
export async function extractFinancialMetrics(symbol) {
  try {
    console.log(`📊 Fetching financial data from Alpha Vantage for ${symbol}...`);
    
    if (!API_KEY || API_KEY === 'demo') {
      throw new Error('Alpha Vantage API key not configured');
    }
    
    console.log(`   -> Getting income statement and balance sheet...`);
    
    const [incomeData, balanceData] = await Promise.all([
      getIncomeStatement(symbol),
      getBalanceSheet(symbol)
    ]);
    
    console.log(`   -> Income reports:`, incomeData.quarterlyReports?.length || 0);
    console.log(`   -> Balance reports:`, balanceData.quarterlyReports?.length || 0);
    
    const latestIncome = incomeData.quarterlyReports?.[0];
    const latestBalance = balanceData.quarterlyReports?.[0];
    
    if (!latestIncome) {
      throw new Error('No quarterly income data available');
    }
    
    console.log(`   ✓ Got data for ${latestIncome.fiscalDateEnding}`);
    
    return {
      revenue: parseInt(latestIncome.totalRevenue || 0),
      netIncome: parseInt(latestIncome.netIncome || 0),
      grossProfit: parseInt(latestIncome.grossProfit || 0),
      operatingIncome: parseInt(latestIncome.operatingIncome || 0),
      eps: parseFloat(latestIncome.reportedEPS || 0),
      assets: parseInt(latestBalance?.totalAssets || 0),
      liabilities: parseInt(latestBalance?.totalLiabilities || 0),
      equity: parseInt(latestBalance?.totalShareholderEquity || 0),
      cashFlow: parseInt(latestIncome.operatingCashflow || 0),
      filingDate: latestIncome.fiscalDateEnding,
      fiscalYear: latestIncome.fiscalDateEnding.split('-')[0],
      fiscalQuarter: 'Q' + Math.ceil(parseInt(latestIncome.fiscalDateEnding.split('-')[1]) / 3),
      source: 'alphavantage'
    };
    
  } catch (error) {
    console.error(`Alpha Vantage extraction error for ${symbol}:`, error.message);
    throw error;
  }
}

export default {
  extractFinancialMetrics,
  getCompanyOverview,
  getIncomeStatement,
  getBalanceSheet
};