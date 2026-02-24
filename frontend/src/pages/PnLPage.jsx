import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function fmt(val, currency) {
  const sym  = currency === 'ILS' ? '₪' : '$';
  const abs  = Math.abs(val || 0);
  const sign = val >= 0 ? '+' : '-';
  return `${sign}${sym}${abs.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPlain(val, currency) {
  const sym = currency === 'ILS' ? '₪' : '$';
  return `${sym}${(val || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pnlColor(val) {
  if (val > 0) return 'text-green-600';
  if (val < 0) return 'text-red-600';
  return 'text-gray-600';
}
function pnlBg(val) {
  if (val > 0) return 'bg-green-50 border-green-200';
  if (val < 0) return 'bg-red-50 border-red-200';
  return 'bg-gray-50 border-gray-200';
}

export default function PnLPage() {
  const navigate = useNavigate();
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [currency, setCurrency] = useState('all'); // 'all', 'USD', 'ILS'

  // 1. Fetch holdings & live prices
  const { data: portfolioData } = useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => (await axios.get(`${API_BASE}/portfolio`)).data,
    retry: 1
  });

  const holdings = portfolioData?.data?.holdings || [];
  const fetchSymbols = holdings.map(h => h.symbol).filter(s => /^[A-Za-z0-9.\-]+$/.test(s));

  const { data: pricesData, isLoading: loadingPrices } = useQuery({
    queryKey: ['prices'],
    queryFn: async () => (await axios.get(`${API_BASE}/portfolio/prices`)).data,
    enabled: fetchSymbols.length > 0,
    refetchInterval: 60000,
    retry: 1
  });
  const prices = pricesData?.data || {};

  // 2. Build price query param for P&L
  const priceParam = Object.entries(prices)
    .map(([sym, info]) => `${sym}:${info.price || 0}`)
    .join(',');

  const { data: pnlData, isLoading: loadingPnl, refetch } = useQuery({
    queryKey: ['pnl', priceParam],
    queryFn: async () => {
      const url = priceParam
        ? `${API_BASE}/portfolio/pnl?prices=${encodeURIComponent(priceParam)}`
        : `${API_BASE}/portfolio/pnl`;
      return (await axios.get(url)).data;
    },
    enabled: holdings.length > 0,
    retry: 1
  });

  const rows     = pnlData?.data?.holdings || [];
  const totals   = pnlData?.data?.totals   || {};
  const usdTotal = totals.USD || {};
  const ilsTotal = totals.ILS || {};

  const filteredRows = currency === 'all' ? rows : rows.filter(r => r.currency === currency);

  // 3. AI portfolio analysis
  const handleAiAnalysis = async () => {
    setLoadingAi(true);
    try {
      const tok = localStorage.getItem('token');
      const payload = {
        holdings: rows.map(r => ({
          symbol:        r.symbol,
          currency:      r.currency,
          totalInvested: r.invested,
          currentValue:  r.currentValue,
          profitPct:     r.unrealPct
        })),
        totalPnl:      (usdTotal.unrealized || 0),
        totalInvested: (usdTotal.invested   || 0),
        totalValue:    (usdTotal.currentValue || 0),
      };
      const res = await axios.post(`${API_BASE}/ai/analyze-portfolio`, payload,
        { headers: { Authorization: `Bearer ${tok}` } });
      if (res.data.success) setAiAnalysis(res.data.data);
      else toast.error(res.data.error || 'שגיאה');
    } catch (e) {
      toast.error(e.response?.data?.error || 'שגיאה בניתוח AI');
    }
    setLoadingAi(false);
  };

  const isLoading = loadingPnl || loadingPrices;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50" dir="rtl">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button onClick={() => navigate('/portfolio')} className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2 font-medium">
            ← חזרה לתיק
          </button>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-1">📊 דוח רווח והפסד</h1>
              <p className="text-gray-500 text-sm">רווח לא ממומש + ממומש לפי אחזקה</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => refetch()} disabled={isLoading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50">
                {isLoading ? '⏳' : '🔄'} רענן
              </button>
              <button onClick={handleAiAnalysis} disabled={loadingAi || rows.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 flex items-center gap-2">
                {loadingAi ? <><span className="animate-spin">⏳</span> מנתח...</> : '🤖 ניתוח AI'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* USD Summary */}
          {usdTotal.invested > 0 && <>
            <TotalCard label="השקעה ($)" value={fmtPlain(usdTotal.invested, 'USD')} color="blue" icon="💵" />
            <TotalCard label="שווי נוכחי ($)" value={fmtPlain(usdTotal.currentValue, 'USD')} color="indigo" icon="📈" />
            <TotalCard label="רווח לא ממומש ($)" value={fmt(usdTotal.unrealized, 'USD')} color={usdTotal.unrealized >= 0 ? 'green' : 'red'} icon={usdTotal.unrealized >= 0 ? '🟢' : '🔴'} />
            <TotalCard label={'סה"כ רווח/הפסד ($)'} value={fmt(usdTotal.totalPnl, 'USD')} pct={usdTotal.invested > 0 ? ((usdTotal.totalPnl / usdTotal.invested) * 100).toFixed(2) : null} color={usdTotal.totalPnl >= 0 ? 'green' : 'red'} icon="💰" />
          </>}
          {/* ILS Summary */}
          {ilsTotal.invested > 0 && <>
            <TotalCard label="השקעה (₪)" value={fmtPlain(ilsTotal.invested, 'ILS')} color="blue" icon="🇮🇱" />
            <TotalCard label="שווי נוכחי (₪)" value={fmtPlain(ilsTotal.currentValue, 'ILS')} color="indigo" icon="📈" />
            <TotalCard label="רווח לא ממומש (₪)" value={fmt(ilsTotal.unrealized, 'ILS')} color={ilsTotal.unrealized >= 0 ? 'green' : 'red'} icon={ilsTotal.unrealized >= 0 ? '🟢' : '🔴'} />
            <TotalCard label={'סה"כ רווח/הפסד (₪)'} value={fmt(ilsTotal.totalPnl, 'ILS')} pct={ilsTotal.invested > 0 ? ((ilsTotal.totalPnl / ilsTotal.invested) * 100).toFixed(2) : null} color={ilsTotal.totalPnl >= 0 ? 'green' : 'red'} icon="💰" />
          </>}
        </div>

        {/* AI Analysis Panel */}
        {aiAnalysis && (
          <div className="bg-white rounded-xl shadow-md border border-purple-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">🤖 ניתוח AI של התיק</h2>
              <button onClick={() => setAiAnalysis(null)} className="text-white/70 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-800 leading-relaxed">{aiAnalysis.overall_assessment}</p>
              {aiAnalysis.diversification && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <strong>פיזור סיכונים:</strong> {aiAnalysis.diversification}
                </div>
              )}
              {aiAnalysis.top_advice?.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-700 mb-2">💡 המלצות:</h3>
                  <ul className="space-y-1">
                    {aiAnalysis.top_advice.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-purple-500 mt-0.5">✦</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-gray-400 border-t pt-3">{aiAnalysis.disclaimer}</p>
            </div>
          </div>
        )}

        {/* Currency Filter */}
        {rows.some(r => r.currency === 'ILS') && rows.some(r => r.currency === 'USD') && (
          <div className="flex gap-2">
            {[['all','הכל'],['USD','$ דולר'],['ILS','₪ שקל']].map(([val, label]) => (
              <button key={val} onClick={() => setCurrency(val)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${currency === val ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* P&L Table */}
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">טוען נתוני רווח והפסד...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-gray-500">אין אחזקות להצגה</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
              <h2 className="text-xl font-bold">📋 פירוט רווח והפסד לפי אחזקה</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">סימול</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">כמות</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">עלות ממוצעת</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">מחיר נוכחי</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">השקעה</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">שווי נוכחי</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">רווח לא ממומש</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">רווח ממומש</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">סה"כ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/company/${row.symbol}`)}
                          className="font-bold text-blue-600 hover:text-blue-700 font-mono">
                          {row.symbol}
                        </button>
                        <div className="text-xs text-gray-400">{row.currSym}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.shares?.toLocaleString('he-IL', { maximumFractionDigits: 3 })}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtPlain(row.avgCost, row.currency)}</td>
                      <td className="px-4 py-3 font-semibold">
                        {row.hasLivePrice ? fmtPlain(row.livePrice, row.currency) : <span className="text-gray-400 text-xs">ממתין</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{fmtPlain(row.invested, row.currency)}</td>
                      <td className="px-4 py-3 font-semibold">
                        {row.hasLivePrice ? fmtPlain(row.currentValue, row.currency) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.hasLivePrice ? (
                          <div>
                            <div className={`font-bold ${pnlColor(row.unrealized)}`}>{fmt(row.unrealized, row.currency)}</div>
                            {row.unrealPct != null && (
                              <div className={`text-xs ${pnlColor(row.unrealized)}`}>({row.unrealPct >= 0 ? '+' : ''}{row.unrealPct.toFixed(2)}%)</div>
                            )}
                          </div>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${pnlColor(row.realized)}`}>
                        {row.realized !== 0 ? fmt(row.realized, row.currency) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-base ${pnlColor(row.totalPnl)}`}>
                          {row.hasLivePrice || row.realized !== 0 ? fmt(row.totalPnl, row.currency) : <span className="text-gray-400 text-xs">—</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer totals */}
                {[['USD', usdTotal], ['ILS', ilsTotal]].map(([cur, tot]) => {
                  if (!tot.invested || (currency !== 'all' && currency !== cur)) return null;
                  const sym = cur === 'ILS' ? '₪' : '$';
                  return (
                    <tfoot key={cur} className={`border-t-2 border-gray-300 ${pnlBg(tot.totalPnl)}`}>
                      <tr>
                        <td className="px-4 py-3 font-bold text-gray-800" colSpan={4}>סה"כ {sym}</td>
                        <td className="px-4 py-3 font-bold text-gray-800">{fmtPlain(tot.invested, cur)}</td>
                        <td className="px-4 py-3 font-bold text-gray-800">{fmtPlain(tot.currentValue, cur)}</td>
                        <td className={`px-4 py-3 font-bold ${pnlColor(tot.unrealized)}`}>{fmt(tot.unrealized, cur)}</td>
                        <td className={`px-4 py-3 font-bold ${pnlColor(tot.realized)}`}>{fmt(tot.realized, cur)}</td>
                        <td className={`px-4 py-3 font-bold text-lg ${pnlColor(tot.totalPnl)}`}>
                          {fmt(tot.totalPnl, cur)}
                          {tot.invested > 0 && (
                            <div className="text-xs">({tot.totalPnl >= 0 ? '+' : ''}{((tot.totalPnl / tot.invested) * 100).toFixed(2)}%)</div>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  );
                })}
              </table>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-xs text-gray-500 space-y-1">
          <div className="font-semibold text-gray-700 mb-2">📖 מקרא:</div>
          <div>• <strong>רווח לא ממומש</strong> — (מחיר נוכחי − עלות ממוצעת) × כמות. מתעדכן בזמן אמת.</div>
          <div>• <strong>רווח ממומש</strong> — רווח/הפסד שנוצר ממכירות שכבר בוצעו.</div>
          <div>• <strong>סה"כ</strong> — סכום שני הרווחים.</div>
        </div>
      </div>
    </div>
  );
}

function TotalCard({ label, value, pct, color, icon }) {
  const colors = {
    blue:  'from-blue-500 to-blue-600',
    indigo:'from-indigo-500 to-indigo-600',
    green: 'from-green-500 to-green-600',
    red:   'from-red-500 to-red-600',
    purple:'from-purple-500 to-purple-600',
  };
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className={`bg-gradient-to-r ${colors[color] || colors.blue} p-4 text-white`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold opacity-90">{label}</span>
          <span className="text-xl">{icon}</span>
        </div>
        <div className="text-xl font-bold truncate">{value}</div>
        {pct != null && <div className="text-xs opacity-80">({pct > 0 ? '+' : ''}{pct}%)</div>}
      </div>
    </div>
  );
}
