import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Companies API
export const companiesAPI = {
  getAll:      ()                       => api.get('/companies'),
  search:      (query)                  => api.get('/companies/search', { params: { q: query } }),
  getOne:      (symbol)                 => api.get(`/companies/${symbol}`),
  getReports:  (symbol, limit = 8)      => api.get(`/companies/${symbol}/reports`, { params: { limit } }),
  getAnalysis: (symbol, refresh = false)=> api.get(`/companies/${symbol}/analysis`, { params: { refresh } }),
  refresh:     (symbol)                 => api.post(`/companies/${symbol}/refresh`),
  compare:     (symbols)                => api.post('/companies/compare', { symbols }),
};

// Stock Price API – US stocks, TASE (.TA), crypto
export const stockPriceAPI = {
  // Current price (ILS for .TA, USD for others)
  getPrice: (symbol) =>
    api.get(`/stock-price/${symbol}`),

  // Historical OHLCV data
  // range: '1d'|'5d'|'1mo'|'3mo'|'6mo'|'1y'|'2y'|'5y'|'max'
  // interval: '1d'|'1wk'|'1mo'
  getHistory: (symbol, range = '1y', interval = '1d') =>
    api.get(`/stock-price/${symbol}/history`, { params: { range, interval } }),

  // Recent news + sentiment
  getNews: (symbol, limit = 20) =>
    api.get(`/stock-price/${symbol}/news`, { params: { limit } }),

  // Provider status (which APIs are configured)
  getProviders: () =>
    api.get('/stock-price/providers'),
};

// Watchlist API
export const watchlistAPI = {
  getAll:     (token)           => api.get('/watchlist',        { headers: { Authorization: `Bearer ${token}` } }),
  getPrices:  (token)           => api.get('/watchlist/prices', { headers: { Authorization: `Bearer ${token}` } }),
  add:        (token, data)     => api.post('/watchlist',       data, { headers: { Authorization: `Bearer ${token}` } }),
  update:     (token, id, data) => api.put(`/watchlist/${id}`,  data, { headers: { Authorization: `Bearer ${token}` } }),
  remove:     (token, id)       => api.delete(`/watchlist/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
};

// Helper to format currency
export const formatCurrency = (value, decimals = 2) => {
  if (!value) return 'לא זמין';
  
  const billion = value / 1000000000;
  const million = value / 1000000;
  
  if (billion >= 1) {
    return `$${billion.toFixed(decimals)}B`;
  } else if (million >= 1) {
    return `$${million.toFixed(decimals)}M`;
  } else {
    return `$${value.toLocaleString()}`;
  }
};

// Helper to format percentage
export const formatPercentage = (value, showSign = true) => {
  if (value === null || value === undefined) return 'לא זמין';
  
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${parseFloat(value).toFixed(2)}%`;
};

// Helper to format date
export const formatDate = (dateString) => {
  if (!dateString) return 'לא זמין';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export default api;
