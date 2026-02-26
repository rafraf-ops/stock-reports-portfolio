import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { companiesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Local-storage helpers (scoped per user to prevent data leakage) ──────────
const historyKey  = uid => `stock_history_${uid  || 'guest'}`;
const favKey      = uid => `stock_favorites_${uid || 'guest'}`;

function getHistory(uid)   { try { return JSON.parse(localStorage.getItem(historyKey(uid))  || '[]'); } catch { return []; } }
function getFavorites(uid) { try { return JSON.parse(localStorage.getItem(favKey(uid)) || '[]'); } catch { return []; } }

function addHistory(uid, item) {
  const h = getHistory(uid).filter(x => x.symbol !== item.symbol);
  h.unshift({ ...item, visitedAt: Date.now() });
  localStorage.setItem(historyKey(uid), JSON.stringify(h.slice(0, 20)));
}

function toggleFavorite(uid, item) {
  const favs = getFavorites(uid);
  const idx  = favs.findIndex(x => x.symbol === item.symbol);
  if (idx >= 0) favs.splice(idx, 1); else favs.unshift({ ...item, savedAt: Date.now() });
  localStorage.setItem(favKey(uid), JSON.stringify(favs.slice(0, 30)));
  return idx < 0; // true = just added
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SECTOR_DOT = {
  Technology: 'bg-blue-500',  Healthcare: 'bg-green-500',
  Financial:  'bg-purple-500', Consumer:   'bg-orange-500',
  Industrial: 'bg-gray-400',  Energy:      'bg-yellow-500',
};
const dotColor = s => SECTOR_DOT[s] || 'bg-gray-300';

function fmtCap(v) {
  if (!v) return null;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 60000);
  if (d < 1)   return 'עכשיו';
  if (d < 60)  return `לפני ${d}ד'`;
  const h = Math.floor(d / 60);
  if (h < 24)  return `לפני ${h}ש'`;
  return `לפני ${Math.floor(h / 24)} ימים`;
}

// ─── Portfolio mini-widget ────────────────────────────────────────────────────
function PortfolioWidget({ token }) {
  const navigate  = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/portfolio', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="rounded-2xl bg-white border border-gray-100 shadow-sm h-36 animate-pulse" />;

  const holdings = data || [];
  if (!holdings.length) return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 text-center">
      <p className="text-3xl mb-1">💼</p>
      <p className="text-sm text-gray-500 mb-3">התיק ריק</p>
      <button onClick={() => navigate('/portfolio')}
        className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-full font-medium">
        + הוסף אחזקה
      </button>
    </div>
  );

  const total   = holdings.reduce((s, h) => s + (h.total_invested || 0), 0);
  const topList = [...holdings].sort((a, b) => (b.total_invested||0) - (a.total_invested||0)).slice(0, 5);

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-l from-purple-600 to-purple-500 px-4 py-3 flex justify-between items-center">
        <div>
          <p className="text-purple-200 text-xs">תיק השקעות</p>
          <p className="text-white font-bold text-lg">${total.toLocaleString('en', { maximumFractionDigits: 0 })}</p>
        </div>
        <button onClick={() => navigate('/portfolio')}
          className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full transition-colors">
          פתח →
        </button>
      </div>
      <div className="divide-y divide-gray-50">
        {topList.map(h => {
          const pct = total > 0 ? (h.total_invested / total) * 100 : 0;
          return (
            <div key={h.symbol}
              onClick={() => navigate(`/company/${h.symbol}`)}
              className="px-4 py-2 flex items-center gap-3 hover:bg-gray-50 cursor-pointer">
              <span className="font-bold text-gray-800 text-sm w-14 shrink-0">{h.symbol}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-400 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-gray-500 w-10 text-left shrink-0">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
      {holdings.length > 5 && (
        <p onClick={() => navigate('/portfolio')}
          className="text-center text-xs text-gray-400 hover:text-purple-600 cursor-pointer py-2">
          + עוד {holdings.length - 5} אחזקות
        </p>
      )}
    </div>
  );
}

// ─── Stock chip (history / favorites row) ─────────────────────────────────────
function StockChip({ item, isFav, onNavigate, onToggleFav, onRemove }) {
  return (
    <div className="group flex items-center gap-2.5 bg-white border border-gray-100 hover:border-blue-200 hover:shadow-sm rounded-xl px-3 py-2.5 cursor-pointer transition-all"
      onClick={() => onNavigate(item)}>
      <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor(item.sector)}`} />
      <div className="flex-1 min-w-0">
        <span className="font-bold text-sm text-gray-800">{item.symbol}</span>
        {item.name && (
          <span className="text-xs text-gray-400 mr-1.5 truncate hidden sm:inline"> · {item.name}</span>
        )}
      </div>
      {item.market_cap && (
        <span className="text-xs text-gray-400 shrink-0 hidden md:block">{fmtCap(item.market_cap)}</span>
      )}
      {item.visitedAt && (
        <span className="text-xs text-gray-300 shrink-0 hidden sm:block">{timeAgo(item.visitedAt)}</span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={e => { e.stopPropagation(); onToggleFav(item); }}
          className={`text-base leading-none transition-transform hover:scale-125 ${isFav ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`}
          title={isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}>★</button>
        {onRemove && (
          <button onClick={e => { e.stopPropagation(); onRemove(item.symbol); }}
            className="text-gray-200 hover:text-red-400 text-xs leading-none">✕</button>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, token } = useAuth();

  const [searchTerm,    setSearchTerm]    = useState('');
  const [isAdding,      setIsAdding]      = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [isSearching,   setIsSearching]   = useState(false);
  const uid = user?.id || 'guest';
  const [history,       setHistory]       = useState(() => getHistory(uid));
  const [favorites,     setFavorites]     = useState(() => getFavorites(uid));
  const [listTab,       setListTab]       = useState('favorites');

  // Reload lists when user switches (login / logout)
  useEffect(() => {
    setHistory(getHistory(uid));
    setFavorites(getFavorites(uid));
  }, [uid]);

  const dropdownRef = useRef(null);
  const inputRef    = useRef(null);
  const debounceRef = useRef(null);

  const { refetch } = useQuery({
    queryKey: ['companies'],
    queryFn: companiesAPI.getAll,
    enabled: false,
  });

  // Debounced live search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchTerm || searchTerm.trim().length < 2) {
      setSearchResults(null); setShowDropdown(false); return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await companiesAPI.search(searchTerm.trim());
        if (res.data.success) { setSearchResults(res.data.data); setShowDropdown(true); }
      } catch { /* ignore */ }
      setIsSearching(false);
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  // Close dropdown on outside click
  useEffect(() => {
    const h = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current    && !inputRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const goToCompany = useCallback((item) => {
    const meta = typeof item === 'string' ? { symbol: item } : item;
    addHistory(uid, meta);
    setHistory(getHistory(uid));
    navigate(`/company/${meta.symbol}`);
  }, [navigate, uid]);

  const handleSelectCompany = async (ticker, isLocal, meta = {}) => {
    setShowDropdown(false); setSearchTerm('');
    if (isLocal) { goToCompany({ symbol: ticker, ...meta }); return; }
    setIsAdding(true);
    const t = toast.loading(`מוסיף את ${ticker}...`);
    try {
      const res = await companiesAPI.refresh(ticker);
      if (res.data.success) {
        toast.success(`${res.data.company} נוספה!`, { id: t, duration: 3000 });
        await refetch();
        goToCompany({ symbol: ticker, ...meta });
      }
    } catch { toast.error(`לא נמצא ${ticker}`, { id: t, duration: 4000 }); }
    setIsAdding(false);
  };

  const handleSearch = async e => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setShowDropdown(false);
    const symbol = searchTerm.toUpperCase().trim();
    const local  = searchResults?.local?.find(c => c.symbol === symbol);
    if (local) { handleSelectCompany(symbol, true, local); return; }
    handleSelectCompany(symbol, !!(searchResults?.local?.find(c => c.symbol.startsWith(symbol))), {});
  };

  const handleToggleFav = item => {
    const nowFav = toggleFavorite(uid, item);
    setFavorites(getFavorites(uid));
    toast(nowFav ? `⭐ ${item.symbol} נוסף` : `${item.symbol} הוסר`, { duration: 1600 });
  };

  const removeFromHistory = symbol => {
    const h = getHistory(uid).filter(x => x.symbol !== symbol);
    localStorage.setItem(historyKey(uid), JSON.stringify(h));
    setHistory(h);
  };

  const isFav       = symbol => favorites.some(f => f.symbol === symbol);
  const hasLocal    = searchResults?.local?.length > 0;
  const hasSec      = searchResults?.sec?.length   > 0;
  const displayList = listTab === 'favorites' ? favorites : history;

  const QUICK = ['AAPL', 'TSLA', 'NVDA', 'AMZN', 'MSFT', 'TEVA.TA', 'CHKP.TA'];

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <span className="font-bold text-gray-800">StockAnalyzer</span>
          </div>
          <div className="flex items-center gap-1">
            {isAuthenticated ? (
              <>
                {/* Desktop nav links — hidden on mobile (bottom nav used instead) */}
                <button onClick={() => navigate('/portfolio')}
                  className="hidden lg:flex text-sm font-medium text-purple-700 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors">
                  💼 תיק
                </button>
                <button onClick={() => navigate('/watchlist')}
                  className="hidden lg:flex text-sm font-medium text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                  🔭 רדאר
                </button>
                <button onClick={() => navigate('/finance')}
                  className="hidden lg:flex text-sm font-medium text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
                  🏦 פיננסי
                </button>
                {user?.id === 1 && (
                  <button onClick={() => navigate('/admin')}
                    className="hidden lg:flex text-sm font-medium text-gray-500 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors">
                    🛡️ ניהול
                  </button>
                )}
                <div className="hidden lg:block h-5 w-px bg-gray-200 mx-1" />
                <span className="text-sm text-gray-500 hidden lg:block">{user?.name}</span>
                <button onClick={() => { logout(); navigate('/'); }}
                  className="hidden lg:flex text-gray-400 hover:text-gray-700 px-2 text-lg" title="התנתק">🚪</button>
                {/* Mobile: show first name only */}
                <span className="text-sm text-gray-500 lg:hidden">{user?.name?.split(' ')[0]}</span>
              </>
            ) : (
              <button onClick={() => navigate('/login')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                🔐 התחבר
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero / Search ────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 pt-12 pb-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 leading-tight">
            ניתוח מניות בזמן אמת
          </h1>
          <p className="text-blue-200 mb-8 text-sm sm:text-base">
            חפש כל מניה אמריקאית או ישראלית · דוחות, גרפים וניתוח AI בעברית
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative">
            <div className="flex rounded-2xl shadow-2xl overflow-visible">
              <input
                ref={inputRef}
                dir="ltr"
                type="text"
                placeholder="AAPL, Tesla, TEVA.TA, אפל..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onFocus={() => { if (hasLocal || hasSec) setShowDropdown(true); }}
                disabled={isAdding}
                className="flex-1 px-5 py-4 text-base sm:text-lg rounded-r-2xl rounded-l-none border-0 focus:outline-none bg-white text-gray-800 placeholder-gray-400"
              />
              {/* Spinner / clear */}
              <div className="absolute left-[5.5rem] top-1/2 -translate-y-1/2">
                {isSearching
                  ? <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                  : searchTerm
                    ? <button type="button" onClick={() => { setSearchTerm(''); setShowDropdown(false); setSearchResults(null); }}
                        className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
                    : null}
              </div>
              <button type="submit" disabled={isAdding || !searchTerm}
                className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white px-6 sm:px-8 font-bold rounded-l-2xl rounded-r-none transition-colors flex items-center justify-center min-w-[56px]">
                {isAdding
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <span>🔍</span>}
              </button>
            </div>

            {/* Dropdown */}
            {showDropdown && (hasLocal || hasSec) && (
              <div ref={dropdownRef}
                className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-72 overflow-y-auto"
                dir="rtl">
                {hasLocal && (
                  <>
                    <div className="px-4 py-2 bg-green-50 text-green-700 text-xs font-semibold border-b border-gray-100 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> במאגר
                    </div>
                    {searchResults.local.map(c => (
                      <button key={c.symbol} type="button"
                        onClick={() => handleSelectCompany(c.symbol, true, c)}
                        className="w-full px-4 py-3 hover:bg-blue-50 flex items-center justify-between border-b border-gray-50 transition-colors text-right">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full ${dotColor(c.sector)}`} />
                          <span className="font-bold text-blue-700 text-sm">{c.symbol}</span>
                          <span className="text-gray-500 text-sm">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {c.market_cap && <span className="text-xs text-gray-400">{fmtCap(c.market_cap)}</span>}
                          <span className="text-green-600 text-xs font-medium">צפה →</span>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {hasSec && (
                  <>
                    <div className="px-4 py-2 bg-blue-50 text-blue-700 text-xs font-semibold border-b border-gray-100 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> SEC
                    </div>
                    {searchResults.sec.map(c => (
                      <button key={c.ticker} type="button"
                        onClick={() => handleSelectCompany(c.ticker, false, { name: c.name })}
                        className="w-full px-4 py-3 hover:bg-blue-50 flex items-center justify-between border-b border-gray-50 transition-colors text-right">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2 h-2 rounded-full bg-blue-300" />
                          <span className="font-bold text-gray-800 text-sm">{c.ticker}</span>
                          <span className="text-gray-500 text-sm">{c.name}</span>
                        </div>
                        <span className="text-blue-500 text-xs font-medium">+ הוסף</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </form>

          {/* Quick-access chips */}
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {QUICK.map(s => (
              <button key={s} type="button"
                onClick={() => handleSelectCompany(s, true, {})}
                className="text-xs text-blue-100 hover:text-white border border-blue-400/40 hover:border-blue-200 px-3 py-1 rounded-full transition-colors bg-blue-600/30 hover:bg-blue-500/40">
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {/* Pull card up over the hero wave */}
      <div className="max-w-6xl mx-auto px-4 -mt-8 pb-12">
        <div className={`grid gap-6 ${isAuthenticated ? 'lg:grid-cols-3' : ''}`}>

          {/* ── Portfolio sidebar (logged-in only) ── */}
          {isAuthenticated && (
            <div className="space-y-4">
              <PortfolioWidget token={token} />

              {/* ── Watchlist / Radar card (prominent) ── */}
              <button
                onClick={() => navigate('/watchlist')}
                className="w-full bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl shadow-sm p-4 flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔭</span>
                  <div className="text-right">
                    <p className="font-bold text-base">רדאר מניות</p>
                    <p className="text-blue-200 text-xs">מעקב יעדי קנייה · Take Profit · Stop Loss</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-blue-300 group-hover:text-white transition-colors rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Quick links */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">גישה מהירה</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'דוח רווח/הפסד', icon: '📊', path: '/portfolio/pnl' },
                    { label: 'ייבוא עסקאות',  icon: '📥', path: '/finance/import' },
                    { label: 'תקציבים',       icon: '🎯', path: '/finance' },
                    { label: 'תיק השקעות',    icon: '💼', path: '/portfolio' },
                  ].map(item => (
                    <button key={item.path} onClick={() => navigate(item.path)}
                      className="flex items-center gap-2 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 p-2.5 rounded-xl text-xs font-medium transition-colors">
                      <span>{item.icon}</span><span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Main right column ── */}
          <div className={isAuthenticated ? 'lg:col-span-2 space-y-5' : 'space-y-5'}>

            {/* Favorites / History card — only for authenticated users */}
            {isAuthenticated && (favorites.length > 0 || history.length > 0) ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Tab header */}
                <div className="flex border-b border-gray-100">
                  {[
                    { id: 'favorites', label: '⭐ מועדפים', count: favorites.length },
                    { id: 'history',   label: '🕐 היסטוריה', count: history.length },
                  ].map(t => (
                    <button key={t.id} onClick={() => setListTab(t.id)}
                      className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                        listTab === t.id
                          ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}>
                      {t.label}
                      {t.count > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t.count}</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-4">
                  {displayList.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <p className="text-3xl mb-2">{listTab === 'favorites' ? '⭐' : '🕐'}</p>
                      <p className="text-sm">
                        {listTab === 'favorites'
                          ? 'אין מועדפים עדיין — לחץ ★ על כל מניה להוספה'
                          : 'אין היסטוריית חיפוש עדיין'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {displayList.map(item => (
                        <StockChip
                          key={item.symbol}
                          item={item}
                          isFav={isFav(item.symbol)}
                          onNavigate={goToCompany}
                          onToggleFav={handleToggleFav}
                          onRemove={listTab === 'history' ? removeFromHistory : null}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Empty state — first visit */
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-14 px-6">
                <p className="text-5xl mb-4">🔍</p>
                <p className="text-lg font-semibold text-gray-700">חפש מניה להתחיל</p>
                <p className="text-sm text-gray-400 mt-2 mb-6">
                  הקלד סימול כמו AAPL, TSLA, TEVA.TA<br />
                  ואנחנו נמשוך את כל הנתונים הזמינים
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {QUICK.map(s => (
                    <button key={s} onClick={() => handleSelectCompany(s, true, {})}
                      className="text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-xl font-medium transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* What you get — 3 feature tiles */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '📈', title: 'גרפי מחיר',       desc: 'מחיר בזמן אמת + היסטוריה' },
                { icon: '📋', title: 'דוחות כספיים',     desc: 'רווח, הכנסות, מאזן, תזרים' },
                { icon: '🤖', title: 'ניתוח AI',         desc: 'קנייה / המתנה / מכירה' },
              ].map(f => (
                <div key={f.title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <div className="text-2xl mb-1.5">{f.icon}</div>
                  <p className="text-xs font-semibold text-gray-700">{f.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-snug">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Sign-up nudge (guests only) */}
            {!isAuthenticated && (
              <div className="bg-gradient-to-l from-blue-600 to-blue-500 rounded-2xl p-5 flex items-center justify-between text-white">
                <div>
                  <p className="font-bold text-base">💡 רוצה יותר?</p>
                  <p className="text-blue-200 text-xs mt-0.5">התחבר לניהול תיק, מועדפים ופיננסי ביתי</p>
                </div>
                <button onClick={() => navigate('/login')}
                  className="bg-white text-blue-700 font-bold text-sm px-5 py-2 rounded-xl hover:bg-blue-50 transition-colors shrink-0 mr-4">
                  התחבר →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
