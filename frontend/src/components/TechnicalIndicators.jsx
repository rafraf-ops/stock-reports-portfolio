import React from 'react';

export default function TechnicalIndicators({ data }) {
  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">📊 אינדיקטורים טכניים</h2>
        <p className="text-gray-500">טוען נתונים...</p>
      </div>
    );
  }

  const getSignalColor = (signal) => {
    const colors = {
      'strong_buy': 'bg-green-600 text-white',
      'buy': 'bg-green-100 text-green-800',
      'hold': 'bg-gray-100 text-gray-800',
      'sell': 'bg-red-100 text-red-800',
      'strong_sell': 'bg-red-600 text-white'
    };
    return colors[signal] || 'bg-gray-100 text-gray-800';
  };

  const getSignalEmoji = (signal) => {
    const emojis = {
      'strong_buy': '🚀',
      'buy': '📈',
      'hold': '⏸️',
      'sell': '📉',
      'strong_sell': '⚠️'
    };
    return emojis[signal] || '—';
  };

  const getRSIStatus = (rsi) => {
    if (rsi < 30) return { text: 'Oversold (קנייה)', color: 'text-green-600', bg: 'bg-green-50' };
    if (rsi > 70) return { text: 'Overbought (מכירה)', color: 'text-red-600', bg: 'bg-red-50' };
    return { text: 'Neutral (ניטרלי)', color: 'text-gray-600', bg: 'bg-gray-50' };
  };

  const getTrendEmoji = (direction) => {
    if (direction.includes('uptrend')) return '📈';
    if (direction.includes('downtrend')) return '📉';
    return '➡️';
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">📊 ניתוח טכני</h2>
        <p className="text-purple-100">אינדיקטורים, מגמות וסיגנלים</p>
      </div>

      <div className="p-8 space-y-8">
        {/* Overall Signal */}
        <div className="text-center">
          <div className="text-6xl mb-4">{getSignalEmoji(data.signals.overall)}</div>
          <div className={`inline-block px-8 py-4 rounded-xl text-2xl font-bold ${getSignalColor(data.signals.overall)}`}>
            {data.signals.overall.toUpperCase().replace('_', ' ')}
          </div>
          <p className="text-gray-600 mt-4">ציון כולל: {data.signals.score > 0 ? '+' : ''}{data.signals.score}</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-sm text-blue-600 font-semibold mb-1">מחיר נוכחי</div>
            <div className="text-2xl font-bold text-blue-900">${data.current.price.toFixed(2)}</div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <div className="text-sm text-purple-600 font-semibold mb-1">נפח מסחר</div>
            <div className="text-2xl font-bold text-purple-900">{(data.current.volume / 1000000).toFixed(1)}M</div>
            <div className="text-xs text-purple-600 mt-1">{data.current.volumeRatio}x ממוצע</div>
          </div>

          <div className={`${getRSIStatus(data.indicators.rsi).bg} rounded-lg p-4 text-center`}>
            <div className={`text-sm font-semibold mb-1 ${getRSIStatus(data.indicators.rsi).color}`}>RSI (14)</div>
            <div className={`text-2xl font-bold ${getRSIStatus(data.indicators.rsi).color}`}>{data.indicators.rsi.toFixed(1)}</div>
            <div className={`text-xs mt-1 ${getRSIStatus(data.indicators.rsi).color}`}>{getRSIStatus(data.indicators.rsi).text}</div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 text-center">
            <div className="text-sm text-orange-600 font-semibold mb-1">תנודתיות (ATR)</div>
            <div className="text-2xl font-bold text-orange-900">{data.indicators.atr.toFixed(2)}</div>
          </div>
        </div>

        {/* Trend Analysis */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">מגמה כללית</h3>
            <span className="text-4xl">{getTrendEmoji(data.trend.direction)}</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">כיוון:</span>
              <span className="font-bold text-lg text-gray-900">{data.trend.direction.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">עוצמה:</span>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-8 h-3 rounded ${i < data.trend.strength ? 'bg-blue-600' : 'bg-gray-300'}`}
                  />
                ))}
              </div>
            </div>
            <p className="text-gray-600 text-sm mt-2">{data.trend.description}</p>
          </div>
        </div>

        {/* Moving Averages */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">ממוצעים נעים (Moving Averages)</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <span className="font-semibold text-gray-900">SMA 20</span>
                <span className="text-xs text-gray-500 mr-2">(תקופה קצרה)</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">${data.movingAverages.sma20.toFixed(2)}</div>
                <div className={`text-sm ${data.current.price > data.movingAverages.sma20 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.current.price > data.movingAverages.sma20 ? '↑ מעל' : '↓ מתחת'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <span className="font-semibold text-gray-900">SMA 50</span>
                <span className="text-xs text-gray-500 mr-2">(תקופה בינונית)</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">${data.movingAverages.sma50.toFixed(2)}</div>
                <div className={`text-sm ${data.current.price > data.movingAverages.sma50 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.current.price > data.movingAverages.sma50 ? '↑ מעל' : '↓ מתחת'}
                </div>
              </div>
            </div>

            {data.movingAverages.sma200 && (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-semibold text-gray-900">SMA 200</span>
                  <span className="text-xs text-gray-500 mr-2">(תקופה ארוכה)</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">${data.movingAverages.sma200.toFixed(2)}</div>
                  <div className={`text-sm ${data.current.price > data.movingAverages.sma200 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.current.price > data.movingAverages.sma200 ? '↑ מעל' : '↓ מתחת'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MACD */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">MACD</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-xs text-blue-600 mb-1">MACD Line</div>
              <div className="font-bold text-lg text-blue-900">{data.indicators.macd.value.toFixed(2)}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-xs text-purple-600 mb-1">Signal Line</div>
              <div className="font-bold text-lg text-purple-900">{data.indicators.macd.signal.toFixed(2)}</div>
            </div>
            <div className={`rounded-lg p-4 text-center ${data.indicators.macd.histogram > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`text-xs mb-1 ${data.indicators.macd.histogram > 0 ? 'text-green-600' : 'text-red-600'}`}>Histogram</div>
              <div className={`font-bold text-lg ${data.indicators.macd.histogram > 0 ? 'text-green-900' : 'text-red-900'}`}>
                {data.indicators.macd.histogram.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
            <span className="font-semibold">פירוש:</span> {data.indicators.macd.histogram > 0 ? 'סיגנל חיובי - MACD מעל Signal' : 'סיגנל שלילי - MACD מתחת Signal'}
          </div>
        </div>

        {/* Bollinger Bands */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Bollinger Bands</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">רצועה עליונה:</span>
              <span className="font-bold">${data.indicators.bollingerBands.upper.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">אמצע (SMA 20):</span>
              <span className="font-bold">${data.indicators.bollingerBands.middle.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">רצועה תחתונה:</span>
              <span className="font-bold">${data.indicators.bollingerBands.lower.toFixed(2)}</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden relative">
              <div 
                className="absolute h-full bg-blue-600"
                style={{
                  left: 0,
                  width: `${((data.current.price - data.indicators.bollingerBands.lower) / (data.indicators.bollingerBands.upper - data.indicators.bollingerBands.lower)) * 100}%`
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>תחתון</span>
              <span>מחיר נוכחי</span>
              <span>עליון</span>
            </div>
          </div>
        </div>

        {/* Individual Signals */}
        {data.signals.details && data.signals.details.length > 0 && (
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">סיגנלים פעילים</h3>
            <div className="space-y-3">
              {data.signals.details.map((signal, i) => (
                <div 
                  key={i}
                  className={`p-4 rounded-lg border-2 ${
                    signal.type === 'buy' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-bold ${signal.type === 'buy' ? 'text-green-900' : 'text-red-900'}`}>
                      {signal.type === 'buy' ? '📈 קנייה' : '📉 מכירה'}
                    </span>
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      signal.strength === 'strong' ? 'bg-yellow-200 text-yellow-900' :
                      signal.strength === 'medium' ? 'bg-blue-200 text-blue-900' :
                      'bg-gray-200 text-gray-900'
                    }`}>
                      {signal.strength === 'strong' ? 'חזק' : signal.strength === 'medium' ? 'בינוני' : 'חלש'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">{signal.indicator}:</span> {signal.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">⚠️ אזהרה:</span> אינדיקטורים טכניים הם כלי עזר בלבד ואינם מהווים המלצה לקנייה או למכירה. 
            תמיד עשו מחקר נוסף והתייעצו עם יועץ פיננסי לפני קבלת החלטות השקעה.
          </p>
        </div>
      </div>
    </div>
  );
}