import axios from 'axios';

const API_KEY = process.env.FMP_API_KEY;
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

// DEBUG: Check if API key is loaded
console.log('🔑 FMP API Key status:', API_KEY ? `Loaded (${API_KEY.substring(0, 5)}...)` : 'NOT FOUND');

/**
 * Get company profile
 */
export async function getCompanyProfile(symbol) {
  try {
    const url = `${BASE_URL}/profile/${symbol}`;
    const response = await axios.get(url, {
      params: { apikey: API_KEY }
    });
    
    return response.data[0];
  } catch (error) {
    console.error(`FMP profile error for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get income statement (quarterly)
 */
export async function getIncomeStatement(symbol, period = 'quarter', limit = 4) {
  try {
    const url = `${BASE_URL}/income-statement/${symbol}`;
    const response = await axios.get(url, {
      params: { 
        apikey: API_KEY,
        period: period,
        limit: limit
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`FMP income statement error for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get balance sheet
 */
export async function getBalanceSheet(symbol, period = 'quarter', limit = 4) {
  try {
    const url = `${BASE_URL}/balance-sheet-statement/${symbol}`;
    const response = await axios.get(url, {
      params: { 
        apikey: API_KEY,
        period: period,
        limit: limit
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`FMP balance sheet error for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get cash flow statement
 */
export async function getCashFlow(symbol, period = 'quarter', limit = 4) {
  try {
    const url = `${BASE_URL}/cash-flow-statement/${symbol}`;
    const response = await axios.get(url, {
      params: { 
        apikey: API_KEY,
        period: period,
        limit: limit
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`FMP cash flow error for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Extract financial metrics from FMP data
 */
export async function extractFinancialMetrics(symbol) {
  try {
    console.log(`📊 Fetching financial data from FMP for ${symbol}...`);
    
    // Get all three statements
    const [incomeStatements, balanceSheets] = await Promise.all([
      getIncomeStatement(symbol, 'quarter', 1),
      getBalanceSheet(symbol, 'quarter', 1)
    ]);
    
    if (!incomeStatements || incomeStatements.length === 0) {
      throw new Error('No financial data available');
    }
    
    const latestIncome = incomeStatements[0];
    const latestBalance = balanceSheets[0];
    
    console.log(`✓ Got FMP data for ${latestIncome.period} ${latestIncome.calendarYear}`);
    
    return {
      revenue: latestIncome.revenue,
      netIncome: latestIncome.netIncome,
      grossProfit: latestIncome.grossProfit,
      operatingIncome: latestIncome.operatingIncome,
      eps: latestIncome.eps,
      assets: latestBalance?.totalAssets,
      liabilities: latestBalance?.totalLiabilities,
      equity: latestBalance?.totalStockholdersEquity,
      cashFlow: latestIncome.freeCashFlow,
      filingDate: latestIncome.fillingDate || latestIncome.date,
      fiscalYear: latestIncome.calendarYear,
      fiscalQuarter: latestIncome.period,
      source: 'fmp'
    };
    
  } catch (error) {
    console.error(`FMP extraction error for ${symbol}:`, error.message);
    throw error;
  }
}

export default {
  getCompanyProfile,
  getIncomeStatement,
  getBalanceSheet,
  getCashFlow,
  extractFinancialMetrics
};