import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = '/api/finance';

const CATEGORY_ICONS = {
  'מזון': '🛒', 'מסעדות': '🍽️', 'תחבורה': '🚗', 'דלק': '⛽',
  'בריאות': '💊', 'ביגוד': '👗', 'בידור': '🎬', 'חינוך': '📚',
  'חשמל': '⚡', 'מים': '💧', 'ביטוח': '🛡️', 'שכירות': '🏠',
  'משכנתה': '🏦', 'חיסכון': '💰', 'משכורת': '💼', 'השקעות': '📈',
  'מתנות': '🎁', 'תקשורת': '📱', 'אחר': '📦'
};

const EXPENSE_CATEGORIES = [
  'מזון','מסעדות','תחבורה','דלק','בריאות','ביגוד','בידור',
  'חינוך','חשמל','מים','ביטוח','שכירות','משכנתה','תקשורת','מתנות','אחר'
];

const INCOME_CATEGORIES = ['משכורת','השקעות','חיסכון','מתנות','אחר'];

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function fmt(n, currency = 'ILS') {
  const symbol = currency === 'USD' ? '$' : '₪';
  return `${symbol}${Number(n || 0).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const defaultForm = {
  type: 'expense', amount: '', currency: 'ILS', category: 'מזון',
  sub_category: '', description: '', date: new Date().toISOString().split('T')[0], account_id: ''
};

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200', month: String(month), year: String(year) });
      if (filterType !== 'all') params.set('type', filterType);
      if (filterCategory) params.set('category', filterCategory);

      const [txRes, accRes] = await Promise.all([
        fetch(`${API}/transactions?${params}`, { headers }),
        fetch(`${API}/accounts`, { headers }),
      ]);
      const [txData, accData] = await Promise.all([txRes.json(), accRes.json()]);
      if (txData.success) setTransactions(txData.data);
      if (accData.success) setAccounts(accData.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [month, year, filterType, filterCategory, token]);

  useEffect(() => { load(); }, [load]);

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`${API}/transactions`, {
        method: 'POST', headers,
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          account_id: form.account_id ? parseInt(form.account_id) : undefined
        })
      });
      setShowForm(false);
      setForm(defaultForm);
      load();
    } catch (err) { console.error(err); }
    setSubmitting(false);
  }

  async function handleDelete(id) {
    if (!confirm('למחוק עסקה זו?')) return;
    await fetch(`${API}/transactions/${id}`, { method: 'DELETE', headers });
    load();
  }

  // Totals for filtered view
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Group by date
  const grouped = transactions.reduce((acc, tx) => {
    const key = tx.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/finance')} className="text-gray-500 hover:text-gray-700 text-sm">
              ← לוח בקרה
            </button>
            <span className="text-gray-300">|</span>
            <h1 className="text-lg font-bold text-gray-800">💳 עסקאות</h1>
          </div>
          <button onClick={() => setShowForm(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">
            + הוסף עסקה
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap gap-3">
            {/* Month/Year */}
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {MONTH_NAMES.map((n, i) => <option key={i} value={i+1}>{n}</option>)}
            </select>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            {/* Type filter */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {[['all','הכל'],['expense','הוצאות'],['income','הכנסות']].map(([val, label]) => (
                <button key={val} onClick={() => setFilterType(val)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${filterType === val ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              <option value="">כל הקטגוריות</option>
              {[...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].filter((v, i, a) => a.indexOf(v) === i).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
            <p className="text-xs text-green-600 font-medium">הכנסות</p>
            <p className="text-lg font-bold text-green-700">{fmt(totalIncome)}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
            <p className="text-xs text-red-600 font-medium">הוצאות</p>
            <p className="text-lg font-bold text-red-700">{fmt(totalExpense)}</p>
          </div>
          <div className={`border rounded-xl p-3 text-center ${totalIncome - totalExpense >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-red-50 border-red-100'}`}>
            <p className={`text-xs font-medium ${totalIncome - totalExpense >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>יתרה</p>
            <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
              {fmt(totalIncome - totalExpense)}
            </p>
          </div>
        </div>

        {/* Transaction list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">אין עסקאות בתקופה זו</p>
            <button onClick={() => setShowForm(true)} className="mt-4 text-sm text-indigo-600 hover:underline">
              הוסף עסקה ראשונה
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDates.map(date => (
              <div key={date} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Date header */}
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-600">{formatDate(date)}</span>
                  <span className={`text-xs font-medium ${
                    grouped[date].reduce((s,t) => t.type==='income' ? s+t.amount : s-t.amount, 0) >= 0
                    ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {grouped[date].reduce((s,t) => t.type==='income' ? s+t.amount : s-t.amount, 0) >= 0 ? '+' : ''}
                    {fmt(grouped[date].reduce((s,t) => t.type==='income' ? s+t.amount : s-t.amount, 0))}
                  </span>
                </div>

                {/* Transactions for this date */}
                <div className="divide-y divide-gray-50">
                  {grouped[date].map(tx => (
                    <div key={tx.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${
                          tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {CATEGORY_ICONS[tx.category] || '📦'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{tx.description || tx.category}</p>
                          <p className="text-xs text-gray-400">
                            {tx.category}{tx.sub_category ? ` · ${tx.sub_category}` : ''}
                            {tx.account_name ? ` · ${tx.account_name}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                          {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount, tx.currency)}
                        </span>
                        <button onClick={() => handleDelete(tx.id)} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-6 w-full max-w-lg sm:mx-4" dir="rtl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold">עסקה חדשה</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type toggle */}
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {[['expense','💸 הוצאה'],['income','💰 הכנסה']].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => {
                    setForm(p => ({ ...p, type: val, category: val === 'income' ? 'משכורת' : 'מזון' }));
                  }} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${form.type === val
                    ? val === 'expense' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Amount */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">סכום</label>
                  <input required type="number" step="0.01" min="0.01" value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">מטבע</label>
                  <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="ILS">₪ שקל</option>
                    <option value="USD">$ דולר</option>
                    <option value="EUR">€ יורו</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">קטגוריה</label>
                  <select required value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    {categories.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c] || '📦'} {c}</option>)}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">תאריך</label>
                  <input required type="date" value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">תיאור (אופציונלי)</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="לדוגמה: קניות בשוק"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              {/* Account */}
              {accounts.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">חשבון (אופציונלי)</label>
                  <select value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">ללא חשבון ספציפי</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold">
                  {submitting ? 'שומר...' : 'הוסף עסקה'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold">
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return `יום ${days[d.getDay()]}, ${d.getDate()} ב${months[d.getMonth()]} ${d.getFullYear()}`;
}
