import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { watchlistAPI } from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(v, currency = 'USD') {
  if (v == null || v === '') return '—';
  const sym = currency === 'ILS' ? '₪' : '$';
  return `${sym}${parseFloat(v).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v) {
  if (v == null) return '—';
  const n = parseFloat(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function pctFrom(current, base) {
  if (!current || !base) return null;
  return ((current - base) / base) * 100;
}

const STATUS_LABELS = { watching: 'עוקב', bought: 'נרכש', skipped: 'דולג' };
const STATUS_COLORS = {
  watching: 'bg-blue-100 text-blue-800',
  bought:   'bg-green-100 text-green-800',
  skipped:  'bg-gray-100 text-gray-500',
};

// ─── Row action highlight ─────────────────────────────────────────────────────
function rowHighlight(item, livePrice) {
  if (!livePrice || !item.target_buy_price) return '';
  const price = livePrice.price;
  // Near buy target (within 3%)
  if (price <= item.target_buy_price * 1.03) return 'bg-green-50 border-l-4 border-green-400';
  // Stop loss hit
  if (item.stop_loss_price && price <= item.stop_loss_price) return 'bg-red-50 border-l-4 border-red-400';
  // Take profit reached
  if (item.take_profit_price && price >= item.take_profit_price) return 'bg-yellow-50 border-l-4 border-yellow-400';
  return '';
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────
const EMPTY_FORM = {
  symbol: '', name: '', currency: 'USD',
  start_watch_price: '', target_buy_price: '',
  take_profit_price: '', stop_loss_price: '',
  notes: '', status: 'watching',
};

function WatchlistModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item ? {
    symbol:            item.symbol,
    name:              item.name || '',
    currency:          item.currency || 'USD',
    start_watch_price: item.start_watch_price ?? '',
    target_buy_price:  item.target_buy_price  ?? '',
    take_profit_price: item.take_profit_price ?? '',
    stop_loss_price:   item.stop_loss_price   ?? '',
    notes:             item.notes || '',
    status:            item.status || 'watching',
  } : { ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.symbol.trim()) { toast.error('נדרש סמל מניה'); return; }
    setLoading(true);
    try {
      await onSave({
        ...form,
        symbol:            form.symbol.toUpperCase().trim(),
        start_watch_price: form.start_watch_price !== '' ? parseFloat(form.start_watch_price) : null,
        target_buy_price:  form.target_buy_price  !== '' ? parseFloat(form.target_buy_price)  : null,
        take_profit_price: form.take_profit_price !== '' ? parseFloat(form.take_profit_price) : null,
        stop_loss_price:   form.stop_loss_price   !== '' ? parseFloat(form.stop_loss_price)   : null,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" dir="rtl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-800">{item ? 'עריכת מניה ברדאר' : 'הוספת מניה לרדאר'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">סמל מניה *</label>
              <input
                value={form.symbol} onChange={e => set('symbol', e.target.value.toUpperCase())}
                disabled={!!item}
                placeholder="AAPL / NVDA / ESLT.TA"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">שם</label>
              <input
                value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Apple Inc."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">מטבע</label>
              <select
                value={form.currency} onChange={e => set('currency', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="USD">USD ($)</option>
                <option value="ILS">ILS (₪)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">סטטוס</label>
              <select
                value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="watching">עוקב</option>
                <option value="bought">נרכש</option>
                <option value="skipped">דולג</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">מחירי מטרה</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'start_watch_price', label: 'מחיר בעת תחילת מעקב' },
                { key: 'target_buy_price',  label: 'מחיר קנייה מטרה' },
                { key: 'take_profit_price', label: 'מחיר Take Profit' },
                { key: 'stop_loss_price',   label: 'מחיר Stop Loss' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={form[key]} onChange={e => set(key, e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">הערות</label>
            <textarea
              value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder="הערות חופשיות..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              ביטול
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
              {loading ? 'שומר...' : item ? 'שמור שינויים' : 'הוסף לרדאר'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WatchlistPage() {
  const navigate     = useNavigate();
  const token        = localStorage.getItem('token');

  const [items,     setItems]     = useState([]);
  const [prices,    setPrices]    = useState({});
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [deleting,  setDeleting]  = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!token) { navigate('/login'); return; }
    try {
      const [listRes, priceRes] = await Promise.all([
        watchlistAPI.getAll(token),
        watchlistAPI.getPrices(token).catch(() => ({ data: { data: {} } })),
      ]);
      setItems(listRes.data.data || []);
      setPrices(priceRes.data.data || {});
    } catch (e) {
      toast.error('שגיאה בטעינת הרדאר');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  async function handleSave(formData) {
    try {
      if (editItem) {
        await watchlistAPI.update(token, editItem.id, formData);
        toast.success('הרשומה עודכנה');
      } else {
        await watchlistAPI.add(token, formData);
        toast.success('המניה נוספה לרדאר');
      }
      setShowModal(false);
      setEditItem(null);
      await fetchAll();
    } catch (e) {
      const msg = e.response?.data?.error || 'שגיאה בשמירה';
      toast.error(msg);
      throw e;
    }
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      await watchlistAPI.remove(token, id);
      toast.success('הוסר מהרדאר');
      await fetchAll();
    } catch {
      toast.error('שגיאה במחיקה');
    } finally {
      setDeleting(null);
    }
  }

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = filterStatus === 'all' ? items : items.filter(i => i.status === filterStatus);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const nearBuy   = items.filter(i => {
    const p = prices[i.symbol]?.price;
    return p && i.target_buy_price && p <= i.target_buy_price * 1.03;
  }).length;
  const stopHit   = items.filter(i => {
    const p = prices[i.symbol]?.price;
    return p && i.stop_loss_price && p <= i.stop_loss_price;
  }).length;
  const tpReached = items.filter(i => {
    const p = prices[i.symbol]?.price;
    return p && i.take_profit_price && p >= i.take_profit_price;
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">רדאר מניות</h1>
              <p className="text-xs text-gray-500">{items.length} מניות במעקב</p>
            </div>
          </div>
          <button
            onClick={() => { setEditItem(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            הוסף מניה
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* Alert summary */}
        {(nearBuy > 0 || stopHit > 0 || tpReached > 0) && (
          <div className="grid grid-cols-3 gap-3">
            {nearBuy > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{nearBuy}</p>
                <p className="text-xs text-green-600 font-medium">קרובות ליעד קנייה</p>
              </div>
            )}
            {tpReached > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{tpReached}</p>
                <p className="text-xs text-yellow-600 font-medium">הגיעו ל-Take Profit</p>
              </div>
            )}
            {stopHit > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{stopHit}</p>
                <p className="text-xs text-red-600 font-medium">פגעו ב-Stop Loss</p>
              </div>
            )}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2">
          {[['all', 'הכל'], ['watching', 'עוקב'], ['bought', 'נרכש'], ['skipped', 'דולג']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterStatus(val)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterStatus === val
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
              {val !== 'all' && (
                <span className={`mr-1.5 text-xs ${filterStatus === val ? 'opacity-80' : 'text-gray-400'}`}>
                  ({items.filter(i => i.status === val).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-4xl mb-3">🔭</p>
            <p className="text-gray-500 font-medium mb-1">הרדאר ריק</p>
            <p className="text-sm text-gray-400 mb-4">הוסף מניות שאתה עוקב אחריהן לצורך קנייה</p>
            <button
              onClick={() => { setEditItem(null); setShowModal(true); }}
              className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold"
            >
              + הוסף מניה ראשונה
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {[
                      'מניה', 'מחיר נוכחי', 'שינוי %',
                      'מחיר התחלת מעקב', '% ממחיר מעקב',
                      'מחיר קנייה מטרה', 'Take Profit', 'Stop Loss',
                      'סטטוס', 'הערות', ''
                    ].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(item => {
                    const live    = prices[item.symbol];
                    const curPrice = live?.price;
                    const pctFromWatch = pctFrom(curPrice, item.start_watch_price);
                    const pctChg       = live?.changePercent;
                    const highlight    = rowHighlight(item, live);

                    return (
                      <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${highlight}`}>
                        {/* Symbol + Name */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => navigate(`/company/${item.symbol}`)}
                            className="text-right"
                          >
                            <p className="font-bold text-blue-600 hover:underline">{item.symbol}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[110px]">{item.name}</p>
                          </button>
                        </td>

                        {/* Current price */}
                        <td className="px-4 py-3 whitespace-nowrap font-mono font-semibold text-gray-800">
                          {curPrice != null ? fmtPrice(curPrice, item.currency) : (
                            <span className="text-gray-300 text-xs">טוען...</span>
                          )}
                        </td>

                        {/* Change % */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {pctChg != null ? (
                            <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded-full ${
                              pctChg >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {fmtPct(pctChg)}
                            </span>
                          ) : '—'}
                        </td>

                        {/* Start watch price */}
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-600">
                          {fmtPrice(item.start_watch_price, item.currency)}
                        </td>

                        {/* % from watch price */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {pctFromWatch != null ? (
                            <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded-full ${
                              pctFromWatch >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {fmtPct(pctFromWatch)}
                            </span>
                          ) : '—'}
                        </td>

                        {/* Target buy */}
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-600">
                          {fmtPrice(item.target_buy_price, item.currency)}
                        </td>

                        {/* Take profit */}
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-green-700">
                          {fmtPrice(item.take_profit_price, item.currency)}
                        </td>

                        {/* Stop loss */}
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-red-600">
                          {fmtPrice(item.stop_loss_price, item.currency)}
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[item.status]}`}>
                            {STATUS_LABELS[item.status]}
                          </span>
                        </td>

                        {/* Notes */}
                        <td className="px-4 py-3 max-w-[160px]">
                          <span className="text-xs text-gray-400 line-clamp-2 block">{item.notes || '—'}</span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditItem(item); setShowModal(true); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="עריכה"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deleting === item.id}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                              title="מחיקה"
                            >
                              {deleting === item.id ? (
                                <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="border-t border-gray-100 px-4 py-3 flex gap-4 text-xs text-gray-400 flex-wrap">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-r-4 border-green-400 bg-green-50 inline-block" /> קרוב ליעד קנייה (±3%)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-r-4 border-yellow-400 bg-yellow-50 inline-block" /> הגיע ל-Take Profit</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-r-4 border-red-400 bg-red-50 inline-block" /> פגע ב-Stop Loss</span>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <WatchlistModal
          item={editItem}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}
