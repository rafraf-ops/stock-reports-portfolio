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

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function fmt(n, currency = 'ILS') {
  const symbol = currency === 'USD' ? '$' : '₪';
  return `${symbol}${Number(n || 0).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function FinancePage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState(null);
  const [yearly, setYearly] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', type: 'checking', currency: 'ILS', balance: '', color: '#6366f1' });
  const [activeTab, setActiveTab] = useState('dashboard');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, yearRes, accRes, budRes, txRes] = await Promise.all([
        fetch(`${API}/summary/monthly?month=${month}&year=${year}`, { headers }),
        fetch(`${API}/summary/yearly?year=${year}`, { headers }),
        fetch(`${API}/accounts`, { headers }),
        fetch(`${API}/budgets?month=${month}&year=${year}`, { headers }),
        fetch(`${API}/transactions?limit=8&month=${month}&year=${year}`, { headers }),
      ]);
      const [s, y, a, b, t] = await Promise.all([sumRes.json(), yearRes.json(), accRes.json(), budRes.json(), txRes.json()]);
      if (s.success) setSummary(s.data);
      if (y.success) setYearly(y.data);
      if (a.success) setAccounts(a.data);
      if (b.success) setBudgets(b.data);
      if (t.success) setRecentTx(t.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [month, year, token]);

  useEffect(() => { load(); }, [load]);

  async function handleAddAccount(e) {
    e.preventDefault();
    await fetch(`${API}/accounts`, {
      method: 'POST', headers,
      body: JSON.stringify({ ...newAccount, balance: parseFloat(newAccount.balance) || 0 })
    });
    setShowAddAccount(false);
    setNewAccount({ name: '', type: 'checking', currency: 'ILS', balance: '', color: '#6366f1' });
    load();
  }

  async function handleDeleteAccount(id) {
    if (!confirm('למחוק חשבון זה?')) return;
    await fetch(`${API}/accounts/${id}`, { method: 'DELETE', headers });
    load();
  }

  const totalBalance = accounts.reduce((s, a) => s + (a.currency === 'ILS' ? a.balance : a.balance * 3.7), 0);
  const savingsRate = summary && summary.income > 0 ? Math.round((summary.savings / summary.income) * 100) : 0;

  // Build budget progress
  const budgetProgress = budgets.map(b => {
    const spent = summary?.byCategory?.find(c => c.category === b.category)?.total || 0;
    const pct = Math.min(Math.round((spent / b.amount) * 100), 100);
    return { ...b, spent, pct, over: spent > b.amount };
  });

  // Bar chart data for yearly summary
  const maxVal = Math.max(...yearly.map(m => Math.max(m.income, m.expenses)), 1);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1">
              ← בית
            </button>
            <span className="text-gray-300">|</span>
            <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">🏠 ניהול פיננסי ביתי</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/finance/import')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-sm">
              📥 ייבוא
            </button>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              {MONTH_NAMES.map((n, i) => <option key={i} value={i+1}>{n}</option>)}
            </select>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 border-b border-gray-200">
            {[
              { id: 'dashboard', label: '📊 לוח בקרה' },
              { id: 'accounts', label: '🏦 חשבונות' },
              { id: 'budgets', label: '🎯 תקציבים' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Dashboard Tab ── */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryCard label="סה״כ הכנסות" value={fmt(summary?.income)} color="green" icon="💰" />
                  <SummaryCard label="סה״כ הוצאות" value={fmt(summary?.expenses)} color="red" icon="💸" />
                  <SummaryCard label="חיסכון חודשי" value={fmt(summary?.savings)}
                    color={summary?.savings >= 0 ? 'indigo' : 'red'} icon="🏦" />
                  <SummaryCard label="אחוז חיסכון" value={`${savingsRate}%`}
                    color={savingsRate >= 20 ? 'green' : savingsRate >= 10 ? 'yellow' : 'red'} icon="📈" />
                </div>

                {/* Two columns: categories + recent transactions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Spending by category */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h2 className="font-semibold text-gray-700 mb-4">הוצאות לפי קטגוריה</h2>
                    {summary?.byCategory?.length ? (
                      <div className="space-y-3">
                        {summary.byCategory.slice(0, 8).map(cat => {
                          const pct = summary.expenses > 0 ? (cat.total / summary.expenses) * 100 : 0;
                          return (
                            <div key={cat.category}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="flex items-center gap-1">
                                  <span>{CATEGORY_ICONS[cat.category] || '📦'}</span>
                                  <span className="text-gray-700">{cat.category}</span>
                                </span>
                                <span className="font-medium text-gray-800">{fmt(cat.total)}</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState text="אין הוצאות החודש" />
                    )}
                  </div>

                  {/* Recent Transactions */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="font-semibold text-gray-700">עסקאות אחרונות</h2>
                      <button onClick={() => navigate('/finance/transactions')}
                        className="text-xs text-indigo-600 hover:underline">הצג הכל →</button>
                    </div>
                    {recentTx.length ? (
                      <div className="space-y-2">
                        {recentTx.map(tx => (
                          <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{CATEGORY_ICONS[tx.category] || '📦'}</span>
                              <div>
                                <p className="text-sm font-medium text-gray-800 leading-tight">{tx.description || tx.category}</p>
                                <p className="text-xs text-gray-400">{tx.category} · {tx.date}</p>
                              </div>
                            </div>
                            <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                              {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount, tx.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState text="אין עסקאות החודש" />
                    )}
                    <button onClick={() => navigate('/finance/transactions')}
                      className="mt-4 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium py-2 rounded-lg transition-colors">
                      + הוסף עסקה
                    </button>
                  </div>
                </div>

                {/* Yearly Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="font-semibold text-gray-700 mb-4">סיכום שנתי {year}</h2>
                  {yearly.length ? (
                    <div className="flex items-end gap-1 h-36">
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = yearly.find(r => r.month === i + 1);
                        const inc = m?.income || 0;
                        const exp = m?.expenses || 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full flex gap-0.5 items-end" style={{ height: '100px' }}>
                              <div className="flex-1 bg-green-400 rounded-t opacity-80"
                                style={{ height: `${(inc / maxVal) * 100}%`, minHeight: inc > 0 ? '2px' : 0 }} />
                              <div className="flex-1 bg-red-400 rounded-t opacity-80"
                                style={{ height: `${(exp / maxVal) * 100}%`, minHeight: exp > 0 ? '2px' : 0 }} />
                            </div>
                            <span className="text-xs text-gray-400">{MONTH_NAMES[i].slice(0, 3)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState text="אין נתונים לשנה זו" />
                  )}
                  <div className="flex gap-4 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded inline-block"/>הכנסות</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded inline-block"/>הוצאות</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Accounts Tab ── */}
            {activeTab === 'accounts' && (
              <div className="space-y-4">
                {/* Total balance banner */}
                <div className="bg-gradient-to-l from-indigo-600 to-indigo-500 rounded-xl p-5 text-white flex justify-between items-center">
                  <div>
                    <p className="text-indigo-200 text-sm">יתרה כוללת (换算 ל-₪)</p>
                    <p className="text-3xl font-bold mt-1">{fmt(totalBalance)}</p>
                  </div>
                  <span className="text-5xl opacity-30">🏦</span>
                </div>

                {/* Account cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {accounts.map(acc => (
                    <div key={acc.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 relative">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.color }} />
                          <span className="font-semibold text-gray-800">{acc.name}</span>
                        </div>
                        <button onClick={() => handleDeleteAccount(acc.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 capitalize">{acc.type} · {acc.currency}</p>
                      <p className={`text-2xl font-bold mt-3 ${acc.balance >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
                        {fmt(acc.balance, acc.currency)}
                      </p>
                    </div>
                  ))}

                  {/* Add account card */}
                  <button onClick={() => setShowAddAccount(true)}
                    className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-4 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex flex-col items-center justify-center gap-2 min-h-[120px]">
                    <span className="text-2xl">+</span>
                    <span className="text-sm font-medium">הוסף חשבון</span>
                  </button>
                </div>

                {/* Add account modal */}
                {showAddAccount && (
                  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" dir="rtl">
                      <h2 className="text-lg font-bold mb-4">חשבון חדש</h2>
                      <form onSubmit={handleAddAccount} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">שם החשבון</label>
                          <input required value={newAccount.name} onChange={e => setNewAccount(p => ({ ...p, name: e.target.value }))}
                            placeholder="לדוגמה: עו״ש בנק הפועלים"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">סוג</label>
                            <select value={newAccount.type} onChange={e => setNewAccount(p => ({ ...p, type: e.target.value }))}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                              <option value="checking">עו״ש</option>
                              <option value="savings">חיסכון</option>
                              <option value="credit">אשראי</option>
                              <option value="cash">מזומן</option>
                              <option value="other">אחר</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">מטבע</label>
                            <select value={newAccount.currency} onChange={e => setNewAccount(p => ({ ...p, currency: e.target.value }))}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                              <option value="ILS">₪ שקל</option>
                              <option value="USD">$ דולר</option>
                              <option value="EUR">€ יורו</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">יתרה התחלתית</label>
                          <input type="number" step="0.01" value={newAccount.balance}
                            onChange={e => setNewAccount(p => ({ ...p, balance: e.target.value }))}
                            placeholder="0"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">צבע</label>
                          <div className="flex gap-2">
                            {['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899'].map(c => (
                              <button type="button" key={c} onClick={() => setNewAccount(p => ({ ...p, color: c }))}
                                className={`w-7 h-7 rounded-full transition-transform ${newAccount.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                                style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                          <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium">
                            הוסף חשבון
                          </button>
                          <button type="button" onClick={() => setShowAddAccount(false)}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium">
                            ביטול
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Budgets Tab ── */}
            {activeTab === 'budgets' && (
              <BudgetsTab
                budgetProgress={budgetProgress}
                month={month} year={year}
                headers={headers}
                onRefresh={load}
                summary={summary}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, icon }) {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.indigo}`}>
      <div className="flex justify-between items-start">
        <p className="text-xs font-medium opacity-70">{label}</p>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-xl font-bold mt-2">{value}</p>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-8 text-gray-400">
      <p className="text-3xl mb-2">📭</p>
      <p className="text-sm">{text}</p>
    </div>
  );
}

const EXPENSE_CATEGORIES = [
  'מזון','מסעדות','תחבורה','דלק','בריאות','ביגוד','בידור',
  'חינוך','חשמל','מים','ביטוח','שכירות','משכנתה','תקשורת','מתנות','אחר'
];

function BudgetsTab({ budgetProgress, month, year, headers, onRefresh, summary }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'מזון', amount: '', currency: 'ILS', period: 'monthly' });

  async function handleAdd(e) {
    e.preventDefault();
    await fetch('/api/finance/budgets', {
      method: 'POST', headers,
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount), month, year })
    });
    setShowForm(false);
    setForm({ category: 'מזון', amount: '', currency: 'ILS', period: 'monthly' });
    onRefresh();
  }

  async function handleDelete(id) {
    await fetch(`/api/finance/budgets/${id}`, { method: 'DELETE', headers });
    onRefresh();
  }

  const totalBudget = budgetProgress.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgetProgress.reduce((s, b) => s + b.spent, 0);
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Overall budget banner */}
      {budgetProgress.length > 0 && (
        <div className={`rounded-xl p-5 text-white ${overallPct > 100 ? 'bg-red-500' : overallPct > 80 ? 'bg-yellow-500' : 'bg-indigo-600'}`}>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">תקציב כולל</span>
            <span className="font-bold">{overallPct}%</span>
          </div>
          <div className="h-2.5 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(overallPct, 100)}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-sm opacity-80">
            <span>נוצל: ₪{totalSpent.toLocaleString()}</span>
            <span>תקציב: ₪{totalBudget.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Budget rows */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {budgetProgress.length ? budgetProgress.map(b => (
          <div key={b.id} className="px-4 py-3">
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                <span>{CATEGORY_ICONS[b.category] || '📦'}</span>
                <span className="text-sm font-medium text-gray-800">{b.category}</span>
                {b.over && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">חריגה!</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  ₪{b.spent.toLocaleString()} / ₪{b.amount.toLocaleString()}
                </span>
                <button onClick={() => handleDelete(b.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${b.over ? 'bg-red-500' : b.pct > 80 ? 'bg-yellow-400' : 'bg-indigo-500'}`}
                style={{ width: `${b.pct}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">{b.pct}% מהתקציב</p>
          </div>
        )) : (
          <div className="py-8">
            <EmptyState text="לא הוגדרו תקציבים לחודש זה" />
          </div>
        )}
      </div>

      {/* Add budget button */}
      <button onClick={() => setShowForm(true)}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow">
        + הגדר תקציב חדש
      </button>

      {/* Categories without budget */}
      {summary?.byCategory?.filter(c => !budgetProgress.find(b => b.category === c.category)).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-700 mb-2">⚠️ קטגוריות ללא תקציב</p>
          <div className="flex flex-wrap gap-2">
            {summary.byCategory.filter(c => !budgetProgress.find(b => b.category === c.category)).map(c => (
              <span key={c.category} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                {CATEGORY_ICONS[c.category] || '📦'} {c.category}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add budget modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" dir="rtl">
            <h2 className="text-lg font-bold mb-4">תקציב חדש</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריה</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_ICONS[c] || '📦'} {c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סכום תקציב (₪)</label>
                <input required type="number" step="1" min="1" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="לדוגמה: 2000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium">
                  שמור תקציב
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium">
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
