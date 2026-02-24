import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SOURCES = [
  { id: 'auto',      label: 'זיהוי אוטומטי',   icon: '🔍', desc: 'ננסה לזהות את המקור אוטומטית' },
  { id: 'max',       label: 'Max / לאומי קארד', icon: '💳', desc: 'ייצוא XLS מאתר Max' },
  { id: 'cal',       label: 'כאל ויזה',         icon: '💳', desc: 'ייצוא XLS מאתר כאל' },
  { id: 'isracard',  label: 'ישראכארט / אמקס',  icon: '💳', desc: 'ייצוא XLS/TXT מישראכארט' },
  { id: 'hapoalim',  label: 'בנק הפועלים',      icon: '🏦', desc: 'ייצוא XLS מחשבון עובר ושב' },
  { id: 'leumi',     label: 'בנק לאומי',        icon: '🏦', desc: 'ייצוא XLS מבנק לאומי' },
  { id: 'discount',  label: 'בנק דיסקונט',      icon: '🏦', desc: 'ייצוא XLS מבנק דיסקונט' },
  { id: 'paypal',    label: 'PayPal',            icon: '🌐', desc: 'ייצוא CSV מ-PayPal' },
  { id: 'wise',      label: 'Wise',              icon: '🌐', desc: 'ייצוא CSV מ-Wise' },
  { id: 'generic',   label: 'CSV כללי',          icon: '📄', desc: 'מיפוי עמודות ידני' },
];

const CATEGORIES = [
  'מזון','מסעדות','תחבורה','דלק','בריאות','ביגוד','בידור',
  'חינוך','חשמל','מים','ביטוח','שכירות','משכנתה','תקשורת',
  'מתנות','משכורת','השקעות','אחר'
];

const CATEGORY_ICONS = {
  'מזון':'🛒','מסעדות':'🍽️','תחבורה':'🚗','דלק':'⛽','בריאות':'💊',
  'ביגוד':'👗','בידור':'🎬','חינוך':'📚','חשמל':'⚡','מים':'💧',
  'ביטוח':'🛡️','שכירות':'🏠','משכנתה':'🏦','תקשורת':'📱',
  'מתנות':'🎁','משכורת':'💼','השקעות':'📈','אחר':'📦'
};

const STEPS = ['upload', 'preview', 'confirm', 'done'];

export default function ImportPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const fileRef = useRef(null);

  const [step, setStep] = useState('upload');
  const [source, setSource] = useState('auto');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Preview state
  const [previewData, setPreviewData] = useState(null);   // { source, transactions, headers, rows, requiresMapping }
  const [transactions, setTransactions] = useState([]);   // editable list

  // Mapping state (for generic CSV)
  const [colMap, setColMap] = useState({ date: '', description: '', amount: '', type: '', currency: '' });

  // Commit state
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [defaultCategory, setDefaultCategory] = useState('אחר');
  const [result, setResult] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch('/api/finance/accounts', { headers })
      .then(r => r.json())
      .then(d => { if (d.success) setAccounts(d.data); });
  }, []);

  // ── Step 1: Upload ──────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (source !== 'auto') formData.append('source', source);

      const res = await fetch('/api/import/preview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setPreviewData(data);

      if (data.requiresMapping) {
        // Generic CSV: pre-guess columns
        const hdrs = (data.headers || []).map(h => h.toLowerCase());
        setColMap({
          date:        guessCol(hdrs, ['date','תאריך','datum']),
          description: guessCol(hdrs, ['description','תיאור','שם','name','merchant','payee','details']),
          amount:      guessCol(hdrs, ['amount','סכום','sum','total','gross','net']),
          type:        guessCol(hdrs, ['type','סוג','debit','credit']),
          currency:    guessCol(hdrs, ['currency','מטבע','curr']),
        });
      } else {
        setTransactions(data.transactions.map((t, i) => ({ ...t, _id: i, _keep: true, category: t.category || autoGuessCategory(t.description) })));
      }
      setStep('preview');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  // ── Apply generic mapping ───────────────────────────────────────────────────

  function applyMapping() {
    const { headers: hdrs, rows } = previewData;
    const colIdx = (key) => hdrs.findIndex(h => h === colMap[key]);

    const mapped = rows.map((row, i) => {
      const dateRaw = row[colIdx('date')] || '';
      const desc    = row[colIdx('description')] || '';
      const rawAmt  = row[colIdx('amount')] || '';
      const typRaw  = row[colIdx('type')]   || '';
      const curr    = row[colIdx('currency')] || 'ILS';

      // Try to parse date
      let date = null;
      const isoM = String(dateRaw).match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoM) date = isoM[0];
      const ilM = String(dateRaw).match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
      if (!date && ilM) {
        let y = ilM[3]; if (y.length === 2) y = '20' + y;
        date = `${y}-${ilM[2].padStart(2,'0')}-${ilM[1].padStart(2,'0')}`;
      }

      const amtNum = parseFloat(String(rawAmt).replace(/,/g, '').replace(/[₪$€]/g, '')) || 0;
      const amount = Math.abs(amtNum);

      let type = 'expense';
      const tl = String(typRaw).toLowerCase();
      if (tl.includes('income') || tl.includes('credit') || tl.includes('הכנסה') || tl.includes('זכות')) type = 'income';
      else if (amtNum > 0 && !tl) type = 'income';

      return { _id: i, _keep: date && amount > 0, date, description: desc, amount, type, currency: curr.trim() || 'ILS', category: autoGuessCategory(desc) };
    }).filter(t => t.date && t.amount > 0);

    setTransactions(mapped);
    setStep('confirm');
  }

  // ── Step 3: Commit ──────────────────────────────────────────────────────────

  async function handleCommit() {
    setLoading(true);
    setError('');
    try {
      const toImport = transactions.filter(t => t._keep !== false);
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: toImport.map(({ _id, _keep, ...t }) => t),
          account_id: selectedAccount || null,
          defaultCategory
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResult(data);
      setStep('done');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const keepCount = transactions.filter(t => t._keep !== false).length;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/finance')} className="text-gray-500 hover:text-gray-700 text-sm">
            ← לוח בקרה
          </button>
          <span className="text-gray-300">|</span>
          <h1 className="text-lg font-bold text-gray-800">📥 ייבוא עסקאות</h1>
        </div>

        {/* Step indicator */}
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-2">
            {[
              { id: 'upload', label: 'העלאה' },
              { id: 'preview', label: 'תצוגה מקדימה' },
              { id: 'confirm', label: 'אישור' },
              { id: 'done', label: 'סיום' }
            ].map((s, idx) => {
              const stepIdx = STEPS.indexOf(step);
              const thisIdx = STEPS.indexOf(s.id);
              return (
                <React.Fragment key={s.id}>
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${thisIdx <= stepIdx ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${thisIdx < stepIdx ? 'bg-indigo-600 text-white' : thisIdx === stepIdx ? 'border-2 border-indigo-600 text-indigo-600' : 'border-2 border-gray-200 text-gray-400'}`}>
                      {thisIdx < stepIdx ? '✓' : idx + 1}
                    </div>
                    {s.label}
                  </div>
                  {idx < 3 && <div className={`flex-1 h-0.5 ${thisIdx < stepIdx ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex gap-2">
            <span>⚠️</span><span>{error}</span>
            <button onClick={() => setError('')} className="mr-auto text-red-400">✕</button>
          </div>
        )}

        {/* ── STEP 1: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-5">
            {/* Source selector */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-700 mb-3">1. בחר מקור הנתונים</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {SOURCES.map(s => (
                  <button key={s.id} onClick={() => setSource(s.id)}
                    className={`p-3 rounded-xl border-2 text-right transition-colors ${source === s.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{s.icon}</span>
                      <span className="text-sm font-semibold text-gray-800">{s.label}</span>
                    </div>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* File drop zone */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-700 mb-3">2. העלה קובץ</h2>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${file ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30'}`}>
                {file ? (
                  <div>
                    <p className="text-3xl mb-2">📄</p>
                    <p className="font-semibold text-indigo-700">{file.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    <button onClick={e => { e.stopPropagation(); setFile(null); }}
                      className="mt-2 text-xs text-red-400 hover:text-red-600">הסר</button>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl mb-3">📂</p>
                    <p className="text-gray-600 font-medium">גרור ושחרר קובץ כאן</p>
                    <p className="text-gray-400 text-sm mt-1">או לחץ לבחירת קובץ</p>
                    <p className="text-gray-300 text-xs mt-2">CSV, XLS, XLSX, TXT עד 10MB</p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx,.txt,.tsv" className="hidden"
                  onChange={e => { const f = e.target.files[0]; if (f) setFile(f); }} />
              </div>
            </div>

            {/* How to export instructions */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-700 mb-2">📖 איך לייצא מהבנק?</p>
              <div className="text-xs text-blue-600 space-y-1">
                <p>• <strong>Max:</strong> כניסה לאתר ← עסקאות ← ייצוא ל-Excel</p>
                <p>• <strong>כאל:</strong> כניסה לאתר ← עסקאות ← הורד ל-Excel</p>
                <p>• <strong>ישראכארט:</strong> כניסה לאתר ← חיוביי כרטיס ← ייצוא</p>
                <p>• <strong>פועלים:</strong> כניסה לאתר ← תנועות בחשבון ← ייצוא ל-Excel</p>
                <p>• <strong>PayPal:</strong> Activity → Statements → Download CSV</p>
                <p>• <strong>Wise:</strong> Statement → Download CSV</p>
              </div>
            </div>

            <button onClick={handleUpload} disabled={!file || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold shadow text-base flex items-center justify-center gap-2">
              {loading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>מעבד...</> : '→ המשך'}
            </button>
          </div>
        )}

        {/* ── STEP 2: Preview ── */}
        {step === 'preview' && previewData && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="font-semibold text-gray-700">תצוגה מקדימה</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    זוהה: <strong>{SOURCES.find(s => s.id === previewData.source)?.label || previewData.source}</strong>
                    {' · '}{previewData.totalRows} שורות סה"כ
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${previewData.requiresMapping ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                  {previewData.requiresMapping ? '⚠️ נדרש מיפוי' : '✓ זוהה אוטומטית'}
                </span>
              </div>

              {previewData.requiresMapping ? (
                /* Generic CSV: column mapping UI */
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">בחר איזו עמודה מכילה כל שדה:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'date', label: 'תאריך *' },
                      { key: 'description', label: 'תיאור' },
                      { key: 'amount', label: 'סכום *' },
                      { key: 'type', label: 'סוג (הכנסה/הוצאה)' },
                      { key: 'currency', label: 'מטבע' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                        <select value={colMap[key]} onChange={e => setColMap(p => ({ ...p, [key]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                          <option value="">-- בחר עמודה --</option>
                          {previewData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Raw preview table */}
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>{previewData.headers.map(h => <th key={h} className="px-2 py-1.5 text-right font-medium text-gray-600 border-b border-gray-100">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {previewData.preview.slice(0,5).map((row, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            {row.map((cell, j) => <td key={j} className="px-2 py-1.5 text-gray-700 max-w-[120px] truncate">{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button onClick={applyMapping} disabled={!colMap.date || !colMap.amount}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold">
                    החל מיפוי →
                  </button>
                </div>
              ) : (
                /* Auto-parsed: show editable preview */
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-2 text-right text-gray-500">✓</th>
                          <th className="px-2 py-2 text-right text-gray-500">תאריך</th>
                          <th className="px-2 py-2 text-right text-gray-500">תיאור</th>
                          <th className="px-2 py-2 text-right text-gray-500">סכום</th>
                          <th className="px-2 py-2 text-right text-gray-500">סוג</th>
                          <th className="px-2 py-2 text-right text-gray-500">קטגוריה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.slice(0, 8).map(tx => (
                          <tr key={tx._id} className={`border-b border-gray-50 ${tx._keep === false ? 'opacity-40 line-through' : ''}`}>
                            <td className="px-2 py-1.5">
                              <input type="checkbox" checked={tx._keep !== false}
                                onChange={e => setTransactions(prev => prev.map(t => t._id === tx._id ? { ...t, _keep: e.target.checked } : t))} />
                            </td>
                            <td className="px-2 py-1.5 text-gray-600">{tx.date}</td>
                            <td className="px-2 py-1.5 text-gray-800 max-w-[180px] truncate">{tx.description}</td>
                            <td className={`px-2 py-1.5 font-medium ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                              {tx.type === 'income' ? '+' : '-'}{tx.amount?.toFixed(2)} {tx.currency}
                            </td>
                            <td className="px-2 py-1.5">
                              <span className={`px-1.5 py-0.5 rounded-full text-xs ${tx.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {tx.type === 'income' ? 'הכנסה' : 'הוצאה'}
                              </span>
                            </td>
                            <td className="px-2 py-1.5">
                              <select value={tx.category || 'אחר'}
                                onChange={e => setTransactions(prev => prev.map(t => t._id === tx._id ? { ...t, category: e.target.value } : t))}
                                className="text-xs border border-gray-200 rounded px-1 py-0.5">
                                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {transactions.length > 8 && (
                      <p className="text-center text-xs text-gray-400 py-2">+ עוד {transactions.length - 8} עסקאות</p>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    💡 כל הקטגוריות זוהו אוטומטית — תוכל לשנות כאן או אחרי הייבוא
                  </p>

                  <button onClick={() => setStep('confirm')}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold">
                    המשך לאישור ({transactions.filter(t => t._keep !== false).length} עסקאות) →
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => setStep('upload')} className="text-sm text-gray-400 hover:text-gray-600">
              ← חזור לבחירת קובץ
            </button>
          </div>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 'confirm' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
              <h2 className="font-semibold text-gray-700">אישור ייבוא</h2>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-indigo-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-indigo-700">{keepCount}</p>
                  <p className="text-xs text-indigo-500 mt-0.5">עסקאות לייבא</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">
                    ₪{transactions.filter(t => t._keep !== false && t.type === 'expense').reduce((s,t) => s + t.amount, 0).toFixed(0)}
                  </p>
                  <p className="text-xs text-red-400 mt-0.5">סה"כ הוצאות</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    ₪{transactions.filter(t => t._keep !== false && t.type === 'income').reduce((s,t) => s + t.amount, 0).toFixed(0)}
                  </p>
                  <p className="text-xs text-green-400 mt-0.5">סה"כ הכנסות</p>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שייך לחשבון (אופציונלי)</label>
                  <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">ללא חשבון ספציפי</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריה ברירת מחדל (לעסקאות לא מזוהות)</label>
                  <select value={defaultCategory} onChange={e => setDefaultCategory(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                ⚠️ ייבוא כפול: אם כבר ייבאת קובץ זה, העסקאות יתווספו שוב. ודא שלא ייבאת את אותה תקופה פעמיים.
              </div>

              <button onClick={handleCommit} disabled={loading || keepCount === 0}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold shadow text-base flex items-center justify-center gap-2">
                {loading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>שומר...</> : `✓ ייבא ${keepCount} עסקאות`}
              </button>
            </div>

            <button onClick={() => setStep('preview')} className="text-sm text-gray-400 hover:text-gray-600">
              ← חזור לתצוגה מקדימה
            </button>
          </div>
        )}

        {/* ── STEP 4: Done ── */}
        {step === 'done' && result && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
            <p className="text-6xl">🎉</p>
            <h2 className="text-xl font-bold text-gray-800">הייבוא הושלם בהצלחה!</h2>
            <div className="flex justify-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{result.imported}</p>
                <p className="text-gray-500">עסקאות יובאו</p>
              </div>
              {result.skipped > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-400">{result.skipped}</p>
                  <p className="text-gray-400">דולגו</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button onClick={() => navigate('/finance')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold shadow">
                לוח בקרה →
              </button>
              <button onClick={() => navigate('/finance/transactions')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-semibold">
                צפה בעסקאות
              </button>
              <button onClick={() => { setStep('upload'); setFile(null); setPreviewData(null); setTransactions([]); setResult(null); }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-semibold">
                ייבוא נוסף
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function guessCol(headers, candidates) {
  for (const c of candidates) {
    const found = headers.find(h => h.toLowerCase().includes(c.toLowerCase()));
    if (found) return found;
  }
  return '';
}

const CATEGORY_RULES = [
  { kw: ['סופרסל','שופרסל','רמי לוי','יינות ביתן','ויקטורי'], cat: 'מזון' },
  { kw: ['מסעדה','קפה','שוורמה','פיצה','coffee','cafe','burger'], cat: 'מסעדות' },
  { kw: ['פז','דלק','סונול','ten','תן'], cat: 'דלק' },
  { kw: ['רכבת','אוטובוס','uber','gett','רב קו'], cat: 'תחבורה' },
  { kw: ['רופא','קופת חולים','מכבי','מאוחדת','כללית','superpharm','סופר פארם'], cat: 'בריאות' },
  { kw: ['h&m','zara','fox','ביגוד','נעליים'], cat: 'ביגוד' },
  { kw: ['netflix','spotify','סינמה','קולנוע','hot','yes'], cat: 'בידור' },
  { kw: ['חברת חשמל','iec'], cat: 'חשמל' },
  { kw: ['ביטוח','הפניקס','מגדל','הראל'], cat: 'ביטוח' },
  { kw: ['שכירות','rent'], cat: 'שכירות' },
  { kw: ['פלאפון','cellcom','partner','012','תקשורת'], cat: 'תקשורת' },
  { kw: ['משכורת','salary','wage'], cat: 'משכורת' },
];

function autoGuessCategory(desc) {
  if (!desc) return 'אחר';
  const lower = String(desc).toLowerCase();
  for (const { kw, cat } of CATEGORY_RULES) {
    if (kw.some(k => lower.includes(k.toLowerCase()))) return cat;
  }
  return 'אחר';
}
