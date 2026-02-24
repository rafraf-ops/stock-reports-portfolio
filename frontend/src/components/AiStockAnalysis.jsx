import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const SENTIMENT_CONFIG = {
  bullish: { label: 'אופטימי',  color: 'bg-green-100 text-green-800 border-green-300',  icon: '📈' },
  bearish: { label: 'פסימי',    color: 'bg-red-100 text-red-800 border-red-300',         icon: '📉' },
  neutral: { label: 'ניטרלי',   color: 'bg-yellow-100 text-yellow-800 border-yellow-300',icon: '➡️' },
};
const REC_CONFIG = {
  'קנייה':   { color: 'bg-green-600 text-white', icon: '✅' },
  'המתנה': { color: 'bg-yellow-500 text-white', icon: '⏳' },
  'מכירה':  { color: 'bg-red-600 text-white',   icon: '🔴' },
};

export default function AiStockAnalysis({ symbol, name, price, changePercent, currency, isTase, news }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const tok = localStorage.getItem('token');
      const res = await axios.post(
        `${API_BASE}/ai/analyze-stock`,
        { symbol, name, price, changePercent, currency, isTase,
          news: (news || []).slice(0, 5).map(n => ({ title: n.title })) },
        { headers: { Authorization: `Bearer ${tok}` } }
      );
      if (res.data.success) { setAnalysis(res.data.data); setDone(true); }
      else toast.error(res.data.error || 'שגיאה');
    } catch (e) {
      if (e.response?.status === 503) toast.error('מפתח API לא מוגדר — הוסף CLAUDE_API_KEY ל-.env');
      else toast.error(e.response?.data?.error || 'שגיאה בניתוח AI');
    }
    setLoading(false);
  };

  const sentiment = SENTIMENT_CONFIG[analysis?.sentiment] || SENTIMENT_CONFIG.neutral;
  const rec       = REC_CONFIG[analysis?.recommendation]  || null;

  return (
    <div className="space-y-4">
      {/* Trigger button (shown before first run) */}
      {!done && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">ניתוח AI של {symbol}</h3>
          <p className="text-gray-600 text-sm mb-6">
            Claude יסקור את הנתונים הזמינים ויספק ניתוח מחקרי בעברית
          </p>
          <button
            onClick={run}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-semibold text-base disabled:opacity-50 transition-colors flex items-center gap-2 mx-auto"
          >
            {loading
              ? <><span className="animate-spin inline-block">⏳</span> מנתח את {symbol}...</>
              : <>🔍 הפעל ניתוח AI</>}
          </button>
          <p className="text-xs text-gray-400 mt-4">
            עלות: ~$0.001 | מופעל על ידי Claude Haiku
          </p>
        </div>
      )}

      {/* Results */}
      {analysis && (
        <div className="space-y-4">
          {/* Header row: sentiment + recommendation */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className={`px-4 py-2 rounded-full text-sm font-bold border ${sentiment.color}`}>
              {sentiment.icon} סנטימנט: {sentiment.label}
            </span>
            {rec && (
              <span className={`px-4 py-2 rounded-full text-sm font-bold ${rec.color}`}>
                {rec.icon} המלצה: {analysis.recommendation}
              </span>
            )}
            <button onClick={run} disabled={loading}
              className="mr-auto text-sm text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 disabled:opacity-50">
              {loading ? '⏳ מנתח...' : '🔄 רענן ניתוח'}
            </button>
          </div>

          {/* Summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">📋 סיכום</h3>
            <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
            {analysis.recommendation_reason && (
              <div className="mt-3 bg-purple-50 border border-purple-100 rounded-lg p-3 text-sm text-purple-800">
                <strong>בסיס ההמלצה:</strong> {analysis.recommendation_reason}
              </div>
            )}
          </div>

          {/* Strengths + Risks side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.strengths?.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">✅ חוזקות</h3>
                <ul className="space-y-2">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                      <span className="text-green-500 mt-0.5 shrink-0">◆</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.risks?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2">⚠️ סיכונים</h3>
                <ul className="space-y-2">
                  {analysis.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                      <span className="text-red-500 mt-0.5 shrink-0">◆</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 text-center border-t pt-3">
            {analysis.disclaimer} • מופעל על ידי Claude AI
          </p>
        </div>
      )}
    </div>
  );
}
