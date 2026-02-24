import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const RANGES = [
  { label: '1ש',  value: '1d',  interval: '5m'  },
  { label: '5י',  value: '5d',  interval: '15m' },
  { label: '1ח',  value: '1mo', interval: '1d'  },
  { label: '3ח',  value: '3mo', interval: '1d'  },
  { label: '6ח',  value: '6mo', interval: '1d'  },
  { label: '1ש',  value: '1y',  interval: '1wk' },
  { label: '2ש',  value: '2y',  interval: '1wk' },
  { label: '5ש',  value: '5y',  interval: '1mo' },
  { label: 'מקס', value: 'max', interval: '1mo' },
];

function formatDateLabel(dateStr, range) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (range === '1d' || range === '5d') {
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '1mo' || range === '3mo' || range === '6mo') {
    return d.toLocaleDateString('he-IL', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('he-IL', { year: '2-digit', month: 'short' });
}

function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload || !payload.length) return null;
  const sym = currency === 'ILS' ? '₪' : '$';
  const price = payload[0]?.value;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="text-gray-500 mb-1">{label}</div>
      <div className="font-bold text-gray-900 text-base">
        {sym}{typeof price === 'number' ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
      </div>
    </div>
  );
}

export default function StockPriceChart({ symbol, currency = 'USD', currentPrice }) {
  const [range, setRange] = useState('6mo');

  const selectedRange = RANGES.find(r => r.value === range) || RANGES[5];

  const { data, isLoading, error } = useQuery({
    queryKey: ['history', symbol, range],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/stock-price/${symbol}/history`, {
        params: { range: selectedRange.value, interval: selectedRange.interval }
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Backend returns: { success: true, data: { symbol, range, interval, currency, data: [...bars] } }
  const rawBars = data?.data?.data || [];

  // Build chart data from OHLCV bars
  const chartData = rawBars.map(bar => ({
    date:  formatDateLabel(bar.date || bar.datetime, range),
    close: bar.close,
    open:  bar.open,
    high:  bar.high,
    low:   bar.low,
    rawDate: bar.date || bar.datetime,
  }));

  const prices   = chartData.map(d => d.close).filter(Boolean);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const firstClose = chartData[0]?.close || 0;
  const lastClose  = chartData[chartData.length - 1]?.close || currentPrice || 0;
  const priceDiff  = lastClose - firstClose;
  const pricePct   = firstClose > 0 ? ((priceDiff / firstClose) * 100) : 0;
  const isUp       = priceDiff >= 0;
  const strokeColor = isUp ? '#10b981' : '#ef4444';
  const fillColor   = isUp ? '#d1fae5' : '#fee2e2';

  const sym = currency === 'ILS' ? '₪' : '$';

  // Y-axis domain with 2% padding
  const pad    = (maxPrice - minPrice) * 0.02 || maxPrice * 0.01;
  const yMin   = Math.max(0, minPrice - pad);
  const yMax   = maxPrice + pad;

  const formatYAxis = (v) => {
    if (v >= 1000) return `${sym}${(v / 1000).toFixed(1)}K`;
    return `${sym}${v.toFixed(v >= 100 ? 0 : 2)}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {sym}{typeof lastClose === 'number'
                ? lastClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '—'}
            </div>
            {priceDiff !== 0 && (
              <div className={`text-sm font-semibold mt-0.5 ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                {isUp ? '▲' : '▼'} {sym}{Math.abs(priceDiff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                &nbsp;({isUp ? '+' : ''}{pricePct.toFixed(2)}%)
                &nbsp;<span className="text-gray-400 font-normal text-xs">בתקופה</span>
              </div>
            )}
          </div>

          {/* Range selector */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  range === r.value
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : error || chartData.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="text-5xl mb-3">📊</div>
            <p>אין נתוני מחיר זמינים לתקופה זו</p>
            <p className="text-xs mt-1">בדוק שהסימול קיים ושהשוק פעיל</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad_${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={strokeColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={60}
                orientation="right"
              />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              {firstClose > 0 && (
                <ReferenceLine
                  y={firstClose}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              )}
              <Area
                type="monotone"
                dataKey="close"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#grad_${symbol})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                name="מחיר"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer stats */}
      {chartData.length >= 2 && (
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 text-center text-xs text-gray-500">
          <div className="py-3 px-2">
            <div className="font-semibold text-gray-800">{sym}{minPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            <div>שפל תקופה</div>
          </div>
          <div className="py-3 px-2">
            <div className="font-semibold text-gray-800">{sym}{maxPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            <div>שיא תקופה</div>
          </div>
          <div className="py-3 px-2">
            <div className={`font-semibold ${isUp ? 'text-green-600' : 'text-red-600'}`}>
              {isUp ? '+' : ''}{pricePct.toFixed(2)}%
            </div>
            <div>שינוי</div>
          </div>
        </div>
      )}
    </div>
  );
}
