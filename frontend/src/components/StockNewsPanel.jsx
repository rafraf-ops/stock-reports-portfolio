import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function SentimentBadge({ sentiment }) {
  if (!sentiment) return null;
  const s = sentiment.toLowerCase();
  if (s === 'bullish' || s === 'positive')
    return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">📈 חיובי</span>;
  if (s === 'bearish' || s === 'negative')
    return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">📉 שלילי</span>;
  return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">➖ ניטרלי</span>;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1)  return 'לפני פחות משעה';
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days < 7)   return `לפני ${days} ימים`;
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StockNewsPanel({ symbol }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['news', symbol],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/stock-price/${symbol}/news`, { params: { limit: 20 } });
      return res.data;
    },
    staleTime: 15 * 60 * 1000,
    retry: 1
  });

  const articles = data?.data?.articles || [];
  const rawSentiment = data?.data?.sentiment;

  // Derive a simple bullish/bearish/neutral string from sentiment data
  let overallSentiment = null;
  if (rawSentiment) {
    if (typeof rawSentiment === 'string') {
      overallSentiment = rawSentiment;
    } else if (rawSentiment.bullish != null && rawSentiment.bearish != null) {
      overallSentiment = rawSentiment.bullish > rawSentiment.bearish ? 'bullish' :
                         rawSentiment.bearish > rawSentiment.bullish ? 'bearish' : 'neutral';
    } else if (rawSentiment.score != null) {
      overallSentiment = rawSentiment.score > 0.15 ? 'bullish' :
                         rawSentiment.score < -0.15 ? 'bearish' : 'neutral';
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8 flex items-center justify-center min-h-48">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">טוען חדשות...</p>
        </div>
      </div>
    );
  }

  if (error || articles.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-10 text-center">
        <div className="text-5xl mb-3">📰</div>
        <p className="text-gray-500 mb-1">אין חדשות זמינות עבור {symbol}</p>
        <p className="text-gray-400 text-xs mb-4">
          כדי לקבל חדשות, הוסף FINNHUB_API_KEY ל-backend/.env
        </p>
        <button
          onClick={() => refetch()}
          className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          🔄 נסה שוב
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 p-5 text-white flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">📰 חדשות ורגש שוק — {symbol}</h2>
          {overallSentiment && (
            <div className="mt-1 text-sm text-slate-300">
              רגש כללי:&nbsp;
              <span className={
                overallSentiment === 'bullish' ? 'text-green-300 font-semibold' :
                overallSentiment === 'bearish' ? 'text-red-300 font-semibold' :
                'text-slate-300'
              }>
                {overallSentiment === 'bullish' ? '📈 חיובי' :
                 overallSentiment === 'bearish' ? '📉 שלילי' : '➖ ניטרלי'}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        >
          🔄 רענן
        </button>
      </div>

      {/* Articles list */}
      <div className="divide-y divide-gray-100">
        {articles.map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-5 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex gap-4">
              {/* Thumbnail */}
              {article.image && (
                <img
                  src={article.image}
                  alt=""
                  className="w-20 h-16 object-cover rounded-lg flex-shrink-0 bg-gray-100"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <SentimentBadge sentiment={article.sentiment} />
                  {article.source && (
                    <span className="text-xs text-gray-400">{article.source}</span>
                  )}
                  <span className="text-xs text-gray-400">{timeAgo(article.datetime || article.date)}</span>
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors leading-snug line-clamp-2">
                  {article.headline || article.title}
                </h3>
                {article.summary && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                    {article.summary}
                  </p>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>

      <div className="p-4 text-center border-t border-gray-100">
        <p className="text-xs text-gray-400">מקורות: Finnhub · Alpha Vantage</p>
      </div>
    </div>
  );
}
