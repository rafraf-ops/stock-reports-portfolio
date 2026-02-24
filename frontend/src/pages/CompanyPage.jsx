import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { companiesAPI, formatCurrency, formatPercentage, formatDate } from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
import FinancialChart from '../components/FinancialChart';
import FinancialMetrics from '../components/FinancialMetrics';
import TechnicalIndicators from '../components/TechnicalIndicators';
import StockPriceChart from '../components/StockPriceChart';
import StockNewsPanel from '../components/StockNewsPanel';
import AiStockAnalysis from '../components/AiStockAnalysis';

// ─── Favorites (localStorage) ─────────────────────────────────────────────────
const FAVORITE_KEY = 'stock_favorites';
function getFavorites() { try { return JSON.parse(localStorage.getItem(FAVORITE_KEY) || '[]'); } catch { return []; } }
function toggleFavorite(item) {
  const favs = getFavorites();
  const idx  = favs.findIndex(x => x.symbol === item.symbol);
  if (idx >= 0) favs.splice(idx, 1); else favs.unshift({ ...item, savedAt: Date.now() });
  localStorage.setItem(FAVORITE_KEY, JSON.stringify(favs.slice(0, 30)));
  return idx < 0; // true = just added
}

export default function CompanyPage() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // overview, chart, news, technical, reports
  const [refreshingAnalysis, setRefreshingAnalysis] = useState(false);
  const [isFav, setIsFav] = useState(() => getFavorites().some(f => f.symbol === symbol?.toUpperCase()));

  // TASE stocks (symbol ends with .TA) have no SEC data — show dedicated view
  const isTase = symbol?.toUpperCase().endsWith('.TA');

  const { data: companyData, isLoading: loadingCompany, error: companyError } = useQuery({
    queryKey: ['company', symbol],
    queryFn: () => companiesAPI.getOne(symbol),
    retry: 1,
    enabled: !isTase   // skip SEC lookup entirely for TASE stocks
  });
  
  const { data: reportsData, isLoading: loadingReports } = useQuery({
    queryKey: ['reports', symbol],
    queryFn: () => companiesAPI.getReports(symbol, 8),
    enabled: !!companyData,
    retry: 1
  });
  
  const { data: analysisData, isLoading: loadingAnalysis, refetch: refetchAnalysis } = useQuery({
    queryKey: ['analysis', symbol],
    queryFn: () => companiesAPI.getAnalysis(symbol),
    enabled: !!companyData,
    retry: 1
  });

  // Fetch current stock price
const { data: priceData } = useQuery({
  queryKey: ['price', symbol],
  queryFn: async () => {
    const res = await axios.get(`${API_BASE}/stock-price/${symbol}`);
    return res.data;
  },
  refetchInterval: 60000, // Refresh every minute
  retry: 1
});

  
  // Mock technical data (replace with real API call later)
  const technicalData = {
    current: {
      price: 145.67,
      volume: 25000000,
      avgVolume: 20000000,
      volumeRatio: '1.25'
    },
    movingAverages: {
      sma20: 142.34,
      sma50: 138.90,
      sma200: 125.50,
      ema12: 143.20,
      ema26: 140.80
    },
    indicators: {
      rsi: 58.5,
      macd: {
        value: 2.45,
        signal: 1.80,
        histogram: 0.65
      },
      bollingerBands: {
        upper: 152.30,
        middle: 145.20,
        lower: 138.10
      },
      atr: 3.45
    },
    trend: {
      direction: 'uptrend',
      strength: 4,
      description: 'מגמת עלייה - רוב המדדים חיוביים'
    },
    signals: {
      overall: 'buy',
      score: 3.5,
      details: [
        { type: 'buy', indicator: 'RSI', reason: 'RSI בטווח ניטרלי-חיובי', strength: 'weak' },
        { type: 'buy', indicator: 'MACD', reason: 'Bullish crossover', strength: 'medium' },
        { type: 'buy', indicator: 'Trend', reason: 'מגמת עלייה מתמשכת', strength: 'strong' }
      ]
    }
  };
  const currentPrice = priceData?.data?.price || null;
  const priceChange = priceData?.data?.change || 0;
  const priceChangePercent = priceData?.data?.changePercent || 0;
  const company = companyData?.data?.data?.company;
  const latestReport = companyData?.data?.data?.latest_report;
  const metrics = companyData?.data?.data?.metrics;
  const reports = reportsData?.data?.data || [];
  const analysis = analysisData?.data?.data;
  
  const ensureArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };
  
  const handleRefreshAnalysis = async () => {
    setRefreshingAnalysis(true);
    const loadingToast = toast.loading('מעדכן ניתוח...');
    
    try {
      await companiesAPI.getAnalysis(symbol, true);
      await refetchAnalysis();
      toast.success('הניתוח עודכן בהצלחה!', { id: loadingToast });
    } catch (error) {
      toast.error('שגיאה בעדכון הניתוח', { id: loadingToast });
    }
    setRefreshingAnalysis(false);
  };
  
  const handleRefreshData = async () => {
    const loadingToast = toast.loading('מעדכן נתונים מ-SEC...');
    
    try {
      await companiesAPI.refresh(symbol);
      toast.success('הנתונים עודכנו בהצלחה!', { id: loadingToast });
      window.location.reload();
    } catch (error) {
      toast.error('שגיאה בעדכון הנתונים', { id: loadingToast });
    }
  };

  const handleToggleFav = () => {
    const meta = companyData?.data?.data?.company || companyData?.data?.data || {};
    const nowFav = toggleFavorite({
      symbol:     symbol?.toUpperCase(),
      name:       meta?.name || symbol,
      sector:     meta?.sector,
      market_cap: meta?.market_cap,
    });
    setIsFav(nowFav);
    toast(nowFav ? `⭐ ${symbol} נוסף למועדפים` : `${symbol} הוסר ממועדפים`, { duration: 1800 });
  };

  // ── TASE stock: show dedicated price-only page (no SEC data) ────────────────
  if (isTase) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Toaster position="top-center" />
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <button
              onClick={() => navigate(-1)}
              className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2 font-medium transition-colors"
            >
              ← חזרה
            </button>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <h1 className="text-4xl font-bold text-gray-900">{symbol}</h1>
                  {priceData?.data?.price != null && (
                    <div className="flex items-center gap-3">
                      <div className="text-3xl font-bold text-gray-900">
                        ₪{priceData.data.price.toFixed(2)}
                      </div>
                      <div className={`flex items-center gap-1 ${(priceData.data.change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <span className="text-xl font-semibold">
                          {(priceData.data.change || 0) >= 0 ? '▲' : '▼'}
                        </span>
                        <span className="text-lg font-semibold">
                          {(priceData.data.change || 0) >= 0 ? '+' : ''}{(priceData.data.changePercent || 0).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                    🇮🇱 בורסת תל אביב
                  </span>
                  <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                    ₪ שקל חדש
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleToggleFav}
                  className={`px-5 py-3 rounded-lg font-semibold transition-all shadow-md border-2 text-lg ${
                    isFav
                      ? 'bg-yellow-400 hover:bg-yellow-300 border-yellow-400 text-white'
                      : 'bg-white hover:bg-yellow-50 border-gray-200 hover:border-yellow-300 text-gray-500 hover:text-yellow-500'
                  }`}
                  title={isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                >
                  {isFav ? '★' : '☆'}
                </button>
                <button
                  onClick={() => navigate('/portfolio')}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-md"
                >
                  📊 הוסף לתיק
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Tab bar – chart, news & AI for TASE */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex gap-1">
              <TabButton active={activeTab === 'chart'} onClick={() => setActiveTab('chart')} icon="📈">גרף מחיר</TabButton>
              <TabButton active={activeTab === 'news'}  onClick={() => setActiveTab('news')}  icon="📰">חדשות</TabButton>
              <TabButton active={activeTab === 'ai'}    onClick={() => setActiveTab('ai')}    icon="🤖">ניתוח AI</TabButton>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            💡 מניית בורסת ת"א — מוצגים נתוני מחיר בזמן אמת מ-Yahoo Finance בשקלים. נתוני דוחות SEC אינם רלוונטיים.
          </div>

          {(activeTab === 'chart' || activeTab === 'overview') && (
            <StockPriceChart
              symbol={symbol}
              currency="ILS"
              currentPrice={priceData?.data?.price || null}
            />
          )}

          {activeTab === 'news' && <StockNewsPanel symbol={symbol} />}

          {activeTab === 'ai' && (
            <AiStockAnalysis
              symbol={symbol}
              name={symbol}
              price={priceData?.data?.price}
              changePercent={priceData?.data?.changePercent}
              currency="ILS"
              isTase={true}
            />
          )}
        </div>
      </div>
    );
  }

  if (loadingCompany) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 text-lg">טוען נתונים עבור {symbol}...</p>
      </div>
    );
  }

  if (companyError || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">חברה לא נמצאה</h2>
          <p className="text-gray-600 mb-2">לא נמצא מידע עבור החברה {symbol}</p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-right">
            <p className="text-sm text-yellow-800 mb-2">
              <strong>סיבות אפשריות:</strong>
            </p>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• הסימול שגוי או לא קיים</li>
              <li>• החברה לא ציבורית בארה"ב</li>
              <li>• החברה לא דיווחה לאחרונה ל-SEC</li>
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleRefreshData}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              נסה לטעון מ-SEC
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              חזור לדף הבית
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  const hasFinancialData = latestReport && latestReport.revenue;
  const keyPoints = ensureArray(analysis?.key_points);
  const risks = ensureArray(analysis?.risks);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button 
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2 font-medium transition-colors"
          >
            ← חזרה לדף הבית
          </button>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
  <div>
    <div className="flex items-center gap-4 mb-2">
      <h1 className="text-4xl font-bold text-gray-900">{company.name}</h1>
      
      {currentPrice && (
        <div className="flex items-center gap-3">
          <div className="text-3xl font-bold text-gray-900">
            ${currentPrice.toFixed(2)}
          </div>
          <div className={`flex items-center gap-1 ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <span className="text-xl font-semibold">
              {priceChange >= 0 ? '▲' : '▼'}
            </span>
            <span className="text-lg font-semibold">
              {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
            </span>
          </div>
        </div>
      )}
    </div>
    
    <div className="flex items-center gap-4 flex-wrap">
      <span className="text-2xl text-gray-600 font-semibold">{company.symbol}</span>
                <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                  {company.sector || 'טכנולוגיה'}
                </span>
                {company.industry && (
                  <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                    {company.industry}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleToggleFav}
                className={`px-5 py-3 rounded-lg font-semibold transition-all shadow-md border-2 text-lg ${
                  isFav
                    ? 'bg-yellow-400 hover:bg-yellow-300 border-yellow-400 text-white'
                    : 'bg-white hover:bg-yellow-50 border-gray-200 hover:border-yellow-300 text-gray-500 hover:text-yellow-500'
                }`}
                title={isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}
              >
                {isFav ? '★' : '☆'}
              </button>
              <button
                onClick={handleRefreshData}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"
              >
                🔄 רענן נתונים
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              icon="📊"
            >
              סקירה כללית
            </TabButton>
            <TabButton
              active={activeTab === 'chart'}
              onClick={() => setActiveTab('chart')}
              icon="📈"
            >
              גרף מחיר
            </TabButton>
            <TabButton
              active={activeTab === 'news'}
              onClick={() => setActiveTab('news')}
              icon="📰"
            >
              חדשות
            </TabButton>
            <TabButton
              active={activeTab === 'technical'}
              onClick={() => setActiveTab('technical')}
              icon="🔬"
            >
              טכני
            </TabButton>
            <TabButton
              active={activeTab === 'reports'}
              onClick={() => setActiveTab('reports')}
              icon="📑"
            >
              דוחות
            </TabButton>
            <TabButton
              active={activeTab === 'ai'}
              onClick={() => setActiveTab('ai')}
              icon="🤖"
            >
              ניתוח AI
            </TabButton>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* No Data Warning */}
        {!hasFinancialData && (
  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
    <div className="flex items-start gap-4">
      <span className="text-4xl">💡</span>
      <div className="flex-1">
        <h3 className="font-bold text-blue-900 text-lg mb-2">חברה זמינה ללא נתוני SEC</h3>
        <p className="text-blue-800 mb-4">
          {company.name} זמינה במערכת, אך נתונים פיננסיים מפורטים מ-SEC אינם זמינים כרגע.
          זה נפוץ בחברות חדשות יותר או חברות עם מבנה דיווח שונה.
        </p>
        <div className="bg-white rounded-lg p-4 mb-4">
          <p className="text-blue-900 font-semibold mb-2">🎯 מה אפשר לעשות:</p>
          <ul className="text-blue-800 space-y-1 text-sm">
            <li>✅ להוסיף את המניה לתיק שלך</li>
            <li>✅ לעקוב אחרי עסקאות קנייה ומכירה</li>
            <li>✅ לראות מחירים בזמן אמת</li>
            <li>✅ לחשב רווח והפסד</li>
          </ul>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefreshData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold"
          >
            נסה שוב לטעון נתונים
          </button>
          <button
            onClick={() => navigate('/portfolio')}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold"
          >
            הוסף לתיק שלי
          </button>
        </div>
      </div>
    </div>
  </div>
)}
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Financial Metrics */}
            {hasFinancialData && (
              <FinancialMetrics 
                company={company}
                latestReport={latestReport}
                metrics={metrics}
                reports={reports}
              />
            )}
            
            {/* AI Analysis */}
            <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">💡 ניתוח AI</h2>
                <button 
                  onClick={handleRefreshAnalysis}
                  disabled={refreshingAnalysis || loadingAnalysis}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {refreshingAnalysis ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
                      מעדכן...
                    </span>
                  ) : (
                    '🔄 עדכן ניתוח'
                  )}
                </button>
              </div>
              
              {loadingAnalysis ? (
                <div className="flex justify-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
              ) : analysis ? (
                <div className="space-y-6">
                  {analysis.summary && (
                    <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
                      <h3 className="font-bold text-gray-900 text-lg mb-3 flex items-center gap-2">
                        <span>📋</span> סיכום
                      </h3>
                      <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
                    </div>
                  )}
                  
                  {analysis.investor_impact && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                      <h3 className="font-bold text-blue-900 text-lg mb-3 flex items-center gap-2">
                        <span>💼</span> משמעות למשקיעים
                      </h3>
                      <p className="text-blue-800 leading-relaxed">{analysis.investor_impact}</p>
                    </div>
                  )}
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    {keyPoints.length > 0 && (
                      <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                        <h3 className="font-bold text-green-900 text-lg mb-4 flex items-center gap-2">
                          <span>✨</span> נקודות מפתח
                        </h3>
                        <ul className="space-y-3">
                          {keyPoints.map((point, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="text-green-600 text-xl flex-shrink-0">•</span>
                              <span className="text-green-800 leading-relaxed">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {risks.length > 0 && (
                      <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
                        <h3 className="font-bold text-yellow-900 text-lg mb-4 flex items-center gap-2">
                          <span>⚠️</span> סיכונים
                        </h3>
                        <ul className="space-y-3">
                          {risks.map((risk, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="text-yellow-600 text-xl flex-shrink-0">•</span>
                              <span className="text-yellow-800 leading-relaxed">{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <div className="text-6xl mb-4">🤖</div>
                  <p className="text-gray-600 text-lg mb-4">אין ניתוח AI זמין כרגע</p>
                  <button 
                    onClick={handleRefreshAnalysis}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"
                  >
                    צור ניתוח חדש
                  </button>
                </div>
              )}
            </div>
            
            {/* Charts */}
            {!loadingReports && reports.length > 1 && (
              <FinancialChart 
                data={metrics?.trend || reports} 
                title="📈 מגמות פיננסיות"
              />
            )}
          </div>
        )}
        
        {/* Price Chart Tab */}
        {activeTab === 'chart' && (
          <div className="space-y-6">
            <StockPriceChart
              symbol={symbol}
              currency={priceData?.data?.currency || 'USD'}
              currentPrice={currentPrice}
            />
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
              💡 הגרף מציג נתוני מחיר מ-Yahoo Finance. עבור מניות ת"א (סיומת .TA) המחירים מוצגים בשקלים.
            </div>
          </div>
        )}

        {/* News Tab */}
        {activeTab === 'news' && (
          <div className="space-y-6">
            <StockNewsPanel symbol={symbol} />
          </div>
        )}

        {/* Technical Analysis Tab */}
        {activeTab === 'technical' && (
          <div className="space-y-8">
            {/* Show live price chart at the top of technical tab too */}
            <StockPriceChart
              symbol={symbol}
              currency={priceData?.data?.currency || 'USD'}
              currentPrice={currentPrice}
            />
            <TechnicalIndicators data={technicalData} />
          </div>
        )}
        
        {/* Historical Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-8">
            {!loadingReports && reports.length > 0 ? (
              <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
                  <h2 className="text-2xl font-bold mb-2">📊 דוחות כספיים היסטוריים</h2>
                  <p className="text-blue-100">היסטוריה של {reports.length} רבעונים אחרונים</p>
                </div>
                
                <div className="p-8">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b-2 border-gray-200">
                          <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">תקופה</th>
                          <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">הכנסות</th>
                          <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">רווח נקי</th>
                          <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">EPS</th>
                          <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">מרווח רווח</th>
                          <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">צמיחה</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reports.map((report, i) => {
                          const margin = report.revenue ? ((report.net_income / report.revenue) * 100).toFixed(2) : 'N/A';
                          const prevReport = reports[i + 1];
                          const growth = prevReport && prevReport.revenue ? 
                            (((report.revenue - prevReport.revenue) / prevReport.revenue) * 100).toFixed(2) : null;
                          
                          return (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-gray-900">Q{report.fiscal_quarter} {report.fiscal_year}</div>
                                <div className="text-xs text-gray-500">{formatDate(report.filing_date)}</div>
                              </td>
                              <td className="px-6 py-4 font-medium">{formatCurrency(report.revenue)}</td>
                              <td className="px-6 py-4 font-medium">{formatCurrency(report.net_income)}</td>
                              <td className="px-6 py-4">{report.eps ? `$${report.eps.toFixed(2)}` : 'N/A'}</td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                  parseFloat(margin) > 20 ? 'bg-green-100 text-green-800' :
                                  parseFloat(margin) > 10 ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {margin}%
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {growth ? (
                                  <span className={`flex items-center gap-1 font-semibold ${
                                    parseFloat(growth) >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {parseFloat(growth) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(growth))}%
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-gray-600 text-lg">אין דוחות היסטוריים זמינים</p>
              </div>
            )}
          </div>
        )}

        {/* AI Analysis Tab */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <AiStockAnalysis
              symbol={symbol}
              name={company?.name || symbol}
              price={currentPrice}
              changePercent={priceChangePercent}
              currency={priceData?.data?.currency || 'USD'}
              isTase={false}
              sector={company?.sector}
              marketCap={company?.market_cap}
            />
          </div>
        )}

        {/* News Tab */}
        {activeTab === 'news' && (
          <StockNewsPanel symbol={symbol} />
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-4 font-semibold transition-all border-b-4 whitespace-nowrap ${
        active 
          ? 'text-blue-600 border-blue-600 bg-blue-50' 
          : 'text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      <span className="mr-2">{icon}</span>
      {children}
    </button>
  );
}