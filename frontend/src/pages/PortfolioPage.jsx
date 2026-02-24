import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const token = localStorage.getItem('token');
if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// ─── Simple helpers ─────────────────────────────────────────────────────────────────────────────────
function detectAssetType(symbol) {
  const s = (symbol || '').toUpperCase().trim();
  if (s.endsWith('.TA')) return 'tase';
  const crypto = ['BTC','ETH','BNB','SOL','XRP','ADA','DOGE','AVAX','DOT','MATIC','LINK','UNI','LTC'];
  if (s.includes('-USD') || crypto.includes(s)) return 'crypto';
  return 'us';
}

function assetBadge(type) {
  if (type === 'tase')   return { label: 'ת"א',    color: 'bg-blue-100 text-blue-800' };
  if (type === 'crypto') return { label: 'קריפטו',  color: 'bg-yellow-100 text-yellow-800' };
  return                          { label: 'ארה"ב',  color: 'bg-green-100 text-green-800' };
}

// Format money in a holding's own currency
function fmtMoney(amount, currency) {
  const sym = currency === 'ILS' ? '₪' : '$';
  return `${sym}${(amount || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [showCashModal,  setShowCashModal]  = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(null);

  const { data: portfolioData, isLoading, error } = useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const tok = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/portfolio`, { headers: { Authorization: `Bearer ${tok}` } });
      return res.data;
    },
    retry: 1
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => (await axios.get(`${API_BASE}/portfolio/transactions`)).data,
    retry: 1
  });

  const { data: cashData } = useQuery({
    queryKey: ['cash'],
    queryFn: async () => (await axios.get(`${API_BASE}/portfolio/cash`)).data,
    retry: 1
  });

  const holdings      = Array.isArray(portfolioData?.data?.holdings) ? portfolioData.data.holdings : [];
  const transactions  = Array.isArray(transactionsData?.data) ? transactionsData.data : [];
  const cashBalance   = cashData?.data?.balance || 0;
  const cashTxs       = Array.isArray(cashData?.data?.transactions) ? cashData.data.transactions : [];
  const totalPositions = portfolioData?.data?.totalPositions || 0;

  const { data: pricesData, isLoading: loadingPrices } = useQuery({
    queryKey: ['prices'],
    queryFn: async () => (await axios.get(`${API_BASE}/portfolio/prices`)).data,
    enabled: holdings.length > 0,
    refetchInterval: 60000,
    retry: 1
  });
  const prices = pricesData?.data || {};

  const enriched = holdings.map(h => {
    const type      = detectAssetType(h.symbol);
    const currency  = h.currency || (type === 'tase' ? 'ILS' : 'USD');
    const priceInfo = prices[h.symbol] || {};
    const livePrice = priceInfo.price || 0;

    const currentValue = h.total_shares * livePrice;
    const profitLoss   = livePrice > 0 ? currentValue - h.total_invested : 0;
    const profitPct    = h.total_invested > 0 && livePrice > 0 ? (profitLoss / h.total_invested) * 100 : 0;

    return {
      ...h,
      assetType:    type,
      currency,
      livePrice,
      currentValue,
      profitLoss,
      profitPct,
      changePercent: priceInfo.changePercent || 0,
    };
  });

  if (isLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
      <p className="text-gray-600 text-lg">טוען תיק...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 max-w-md text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-red-900 mb-2">שגיאה בטעינת התיק</h2>
        <p className="text-red-700 mb-4">{error.message}</p>
        <button onClick={() => navigate('/login')} className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold">חזרה להתחברות</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Toaster position="top-center" />

      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button onClick={() => navigate('/')} className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2 font-medium">← חזרה לדף הבית</button>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-1">💼 התיק שלי</h1>
              <p className="text-gray-500 text-sm">מניות ת"א מוצגות בשקלים • מניות ארה"ב מוצגות בדולרים</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate('/portfolio/pnl')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow text-sm">
                📊 דוח רווח/הפסד
              </button>
              <button onClick={() => queryClient.invalidateQueries(['prices'])} disabled={loadingPrices}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow text-sm disabled:opacity-50">
                {loadingPrices ? '⏳' : '🔄'} רענן מחירים
              </button>
              <button onClick={() => setShowAddModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow text-sm">
                ➕ הוסף עסקה
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <SummaryCard title="מזומן ($)" value={`$${cashBalance.toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2})}`} subtitle="זמין להשקעה" icon="💵" color="green" onClick={() => setShowCashModal(true)} clickable />
          <SummaryCard title="פוזיציות" value={totalPositions} subtitle={`${holdings.reduce((s,h)=>s+h.total_shares,0).toLocaleString()} מניות`} icon="🎯" color="blue" />
          <SummaryCard title="עדכון מחירים" value={loadingPrices ? '...' : '✓ עדכני'} subtitle="כל 60 שניות" icon="🔄" color="purple" />
        </div>

        {/* Holdings table */}
        {holdings.length > 0 ? (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-5 text-white">
              <h2 className="text-xl font-bold">📊 אחזקות נוכחיות</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">סימול</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">שוק</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">כמות</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">מחיר כניסה</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">מחיר נוכחי</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">שינוי יומי</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">שווי</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">רווח/הפסד</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {enriched.map((h, i) => {
                    const badge = assetBadge(h.assetType);
                    const up = h.changePercent >= 0;
                    const plUp = h.profitLoss >= 0;
                    return (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <button onClick={() => navigate(`/company/${h.symbol}`)} className="font-bold text-blue-600 hover:text-blue-700 text-base">{h.symbol}</button>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.color}`}>{badge.label}</span>
                        </td>
                        <td className="px-4 py-3 font-medium">{h.total_shares?.toLocaleString('he-IL',{maximumFractionDigits:3})}</td>
                        <td className="px-4 py-3 text-gray-600">{fmtMoney(h.average_cost, h.currency)}</td>
                        <td className="px-4 py-3 font-semibold">
                          {h.livePrice > 0 ? fmtMoney(h.livePrice, h.currency) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {h.changePercent !== 0 && (
                            <span className={up ? 'text-green-600' : 'text-red-600'}>
                              {up ? '▲' : '▼'} {Math.abs(h.changePercent).toFixed(2)}%
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-base">
                          {h.livePrice > 0 ? fmtMoney(h.currentValue, h.currency) : fmtMoney(h.total_invested, h.currency)}
                        </td>
                        <td className="px-4 py-3">
                          {h.livePrice > 0 ? (
                            <div>
                              <div className={`font-bold ${plUp ? 'text-green-600' : 'text-red-600'}`}>
                                {plUp ? '+' : ''}{fmtMoney(h.profitLoss, h.currency)}
                              </div>
                              <div className={`text-xs ${plUp ? 'text-green-600' : 'text-red-600'}`}>
                                ({plUp ? '+' : ''}{h.profitPct.toFixed(2)}%)
                              </div>
                            </div>
                          ) : <span className="text-gray-400 text-xs">ממתין למחיר</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => { setSelectedSymbol(h.symbol); setShowAddModal(true); }}
                            className="text-blue-600 hover:text-blue-700 font-medium text-xs whitespace-nowrap">
                            קנה / מכור
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-200 mb-8">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">התיק ריק</h3>
            <p className="text-gray-600 mb-2">הוסף מניות ת"א (סימול.TA), מניות ארה"ב, או קריפטו</p>
            <p className="text-gray-500 text-sm mb-6">דוגמאות: AAPL · TEVA.TA · BTC</p>
            <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold">➕ הוסף עסקה ראשונה</button>
          </div>
        )}

        {cashTxs.length > 0 && <CashSection balance={cashBalance} transactions={cashTxs} onAddClick={() => setShowCashModal(true)} />}
        <TransactionHistory transactions={transactions} />
      </div>

      {showAddModal && <AddTransactionModal onClose={() => { setShowAddModal(false); setSelectedSymbol(null); }} defaultSymbol={selectedSymbol} />}
      {showCashModal && <CashModal onClose={() => setShowCashModal(false)} />}
    </div>
  );
}

// ─── Summary Card ────────────────────────────────────────────────────────────────────────────────
function SummaryCard({ title, value, subtitle, icon, color, onClick, clickable }) {
  const colors = { blue:'from-blue-500 to-blue-600', green:'from-green-500 to-green-600', purple:'from-purple-500 to-purple-600', orange:'from-orange-500 to-orange-600' };
  const Wrap = clickable ? 'button' : 'div';
  return (
    <Wrap onClick={onClick} className={`bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow ${clickable ? 'cursor-pointer' : ''} w-full text-left`}>
      <div className={`bg-gradient-to-r ${colors[color]||colors.blue} p-4 text-white`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold opacity-90">{title}</span>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="text-2xl font-bold truncate">{value}</div>
      </div>
      {subtitle && <div className="px-4 py-2 text-xs font-semibold text-gray-600">{subtitle}</div>}
    </Wrap>
  );
}

// ─── Cash Section ────────────────────────────────────────────────────────────────────────────────
function CashSection({ balance, transactions, onAddClick }) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: async (id) => { await axios.delete(`${API_BASE}/portfolio/cash/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries(['cash']); toast.success('נמחק'); }
  });
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-8">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-5 text-white flex justify-between items-center">
        <h2 className="text-xl font-bold">💵 תנועות מזומן</h2>
        <button onClick={onAddClick} className="bg-white text-green-600 px-4 py-1.5 rounded-lg font-semibold text-sm">➕ הוספ/משוך</button>
      </div>
      <div className="p-5 space-y-2">
        {transactions.slice(0,5).map(tx => (
          <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${tx.type==='deposit'?'bg-green-100':'bg-red-100'}`}>{tx.type==='deposit'?'⬇️':'⬆️'}</div>
              <div>
                <div className="font-semibold text-sm">{tx.type==='deposit'?'הפקדה':'משיכה'}</div>
                <div className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString('he-IL')}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`font-bold ${tx.type==='deposit'?'text-green-600':'text-red-600'}`}>{tx.type==='deposit'?'+':'-'}${tx.amount.toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
              <button onClick={()=>{if(window.confirm('למחוק?'))del.mutate(tx.id);}} className="text-red-500 hover:text-red-700 text-sm">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Transaction History ──────────────────────────────────────────────────────────────────────────────
function TransactionHistory({ transactions }) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: async (id) => { await axios.delete(`${API_BASE}/portfolio/transaction/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries(['portfolio','transactions']); toast.success('העסקה נמחקה'); }
  });
  if (!transactions.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-5 text-white">
        <h2 className="text-xl font-bold">📜 היסטוריית עסקאות</h2>
      </div>
      <div className="p-5 space-y-3">
        {transactions.map(tx => {
          const curr = tx.currency || 'USD';
          const sym  = curr === 'ILS' ? '₪' : '$';
          const total = tx.quantity * tx.price;
          const badge = assetBadge(detectAssetType(tx.symbol||''));
          return (
            <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl ${tx.type==='buy'?'bg-green-100':'bg-red-100'}`}>{tx.type==='buy'?'📈':'📉'}</div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base">{tx.symbol}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.color}`}>{badge.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tx.type==='buy'?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>{tx.type==='buy'?'קנייה':'מכירה'}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {tx.quantity} × {sym}{parseFloat(tx.price).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2})} = {sym}{total.toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2})}  •  {new Date(tx.date).toLocaleDateString('he-IL')}
                  </div>
                  {tx.notes && <div className="text-xs text-gray-400 mt-0.5">{tx.notes}</div>}
                </div>
              </div>
              <button onClick={()=>{if(window.confirm('למחוק עסקה זו?'))del.mutate(tx.id);}} className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded">🗑️</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Cash Modal ─────────────────────────────────────────────────────────────────────────────────────────
function CashModal({ onClose }) {
  const [form, setForm] = useState({ type:'deposit', amount:'', date:new Date().toISOString().split('T')[0], notes:'' });
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: async (d) => { await axios.post(`${API_BASE}/portfolio/cash`, d); },
    onSuccess: () => { queryClient.invalidateQueries(['portfolio','cash']); toast.success('נוסף!'); onClose(); },
    onError: (e) => toast.error(e.response?.data?.error || 'שגיאה')
  });
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">💵 תנועת מזומן</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>
        <form onSubmit={e=>{e.preventDefault();add.mutate(form);}} className="space-y-4">
          <div className="flex gap-4">
            {['deposit','withdrawal'].map(t=>(
              <button key={t} type="button" onClick={()=>setForm({...form,type:t})}
                className={`flex-1 py-3 rounded-lg font-semibold text-sm ${form.type===t?(t==='deposit'?'bg-green-600 text-white':'bg-red-600 text-white'):'bg-gray-100 text-gray-700'}`}>
                {t==='deposit'?'⬇️ הפקדה':'⬆️ משיכה'}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">סכום ($)</label>
            <input type="number" required step="0.01" min="0.01" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="1000.00" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">תאריך</label>
            <input type="date" required className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
          </div>
          <div className="flex gap-4 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold text-sm">ביטול</button>
            <button type="submit" disabled={add.isPending} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold text-sm disabled:opacity-50">{add.isPending?'שומר...':'הוסף'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Transaction Modal ────────────────────────────────────────────────────────────────────────────
function AddTransactionModal({ onClose, defaultSymbol }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    symbol:   defaultSymbol || '',
    type:     'buy',
    quantity: '',
    price:    '',
    date:     new Date().toISOString().split('T')[0],
    notes:    '',
    currency: defaultSymbol?.toUpperCase().endsWith('.TA') ? 'ILS' : 'USD'
  });

  // ── Symbol search state ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]     = useState(defaultSymbol || '');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const [showDropdown, setShowDropdown]   = useState(false);
  const searchTimeout                     = useRef(null);
  const dropdownRef                       = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchInput = (val) => {
    setSearchQuery(val);
    // If it looks like a complete ticker already, use it directly
    const upper = val.toUpperCase().trim();
    if (/^[A-Z0-9]{2,6}(\.TA)?$/.test(upper) && val.length >= 2) {
      setForm(prev => ({ ...prev, symbol: upper, currency: upper.endsWith('.TA') ? 'ILS' : 'USD' }));
    }
    clearTimeout(searchTimeout.current);
    if (val.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const tok = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE}/portfolio/search-symbol?q=${encodeURIComponent(val)}`,
          { headers: { Authorization: `Bearer ${tok}` } });
        setSearchResults(res.data.data || []);
        setShowDropdown(true);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 350);
  };

  const selectResult = (hit) => {
    setSearchQuery(`${hit.symbol} — ${hit.name}`);
    setForm(prev => ({ ...prev, symbol: hit.symbol, currency: hit.currency }));
    setShowDropdown(false);
  };

  const currSym = form.currency === 'ILS' ? '₪' : '$';
  const isTase  = form.symbol.toUpperCase().endsWith('.TA');
  const total   = form.quantity && form.price ? (parseFloat(form.quantity) * parseFloat(form.price)) : null;

  const add = useMutation({
    mutationFn: async (data) => { await axios.post(`${API_BASE}/portfolio/transaction`, data); },
    onSuccess:  () => { queryClient.invalidateQueries(['portfolio','transactions','prices']); toast.success('עסקה נוספה! ✓'); onClose(); },
    onError:    (e) => toast.error(e.response?.data?.error || 'שגיאה')
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.symbol) return toast.error('בחר סימול מניה');
    add.mutate({ ...form, quantity: parseFloat(form.quantity), price: parseFloat(form.price) });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold">➕ הוסף עסקה</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Symbol Search ── */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-semibold text-gray-700 mb-1">חיפוש מניה</label>
            <div className="relative">
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-base"
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder="חפש לפי שם: teva / bezeq / lahav / AAPL..."
                autoComplete="off"
              />
              {searching && (
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm animate-pulse">🔍</span>
              )}
            </div>

            {/* Dropdown results */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {searchResults.map((hit) => (
                  <button
                    key={hit.symbol}
                    type="button"
                    onClick={() => selectResult(hit)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 transition-colors text-right border-b border-gray-100 last:border-0"
                  >
                    <div className="text-right">
                      <div className="font-bold text-gray-900 font-mono">{hit.symbol}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[220px]">{hit.name}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ml-2 ${hit.isTase ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {hit.isTase ? '₪ ת"א' : '$ US'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected symbol badge */}
            {form.symbol && (
              <div className={`mt-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 ${isTase ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                {isTase ? '📍 ת"א — מחיר בשקלים (₪)' : '🇺🇸 ארה"ב — מחיר בדולרים ($)'}
                <span className="font-mono bg-white px-1.5 py-0.5 rounded border">{form.symbol}</span>
              </div>
            )}
          </div>

          {/* Buy / Sell */}
          <div className="flex gap-3">
            {['buy','sell'].map(t => (
              <button key={t} type="button" onClick={() => setForm({...form, type:t})}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm ${form.type===t?(t==='buy'?'bg-green-600 text-white':'bg-red-600 text-white'):'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {t==='buy'?'📈 קנייה':'📉 מכירה'}
              </button>
            ))}
          </div>

          {/* Currency */}
          <div className="flex gap-2">
            {[{val:'USD',label:'$ דולר'},{val:'ILS',label:'₪ שקל'}].map(c => (
              <button key={c.val} type="button" onClick={() => setForm({...form, currency:c.val})}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm ${form.currency===c.val?'bg-blue-600 text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Quantity + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">כמות (מניות)</label>
              <input type="number" required step="0.001" min="0.001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={form.quantity} onChange={e => setForm({...form, quantity:e.target.value})}
                placeholder="100" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">מחיר ({currSym} למניה)</label>
              <input type="number" required step="0.01" min="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={form.price} onChange={e => setForm({...form, price:e.target.value})}
                placeholder={form.currency === 'ILS' ? '10.33' : '18.10'} />
            </div>
          </div>

          {/* Total preview */}
          {total !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between items-center">
              <span className="font-semibold text-blue-900 text-sm">סה"כ:</span>
              <span className="text-2xl font-bold text-blue-900">
                {currSym}{total.toLocaleString('he-IL', {minimumFractionDigits:2, maximumFractionDigits:2})}
              </span>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">תאריך</label>
            <input type="date" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={form.date} onChange={e => setForm({...form, date:e.target.value})} />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">הערות</label>
            <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows="2"
              value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} />
          </div>

          <div className="flex gap-4 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold text-sm">ביטול</button>
            <button type="submit" disabled={add.isPending || !form.symbol}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold text-sm disabled:opacity-50">
              {add.isPending ? 'שומר...' : 'הוסף עסקה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}