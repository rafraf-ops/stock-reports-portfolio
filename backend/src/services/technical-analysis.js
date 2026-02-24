import { SMA, EMA, RSI, MACD, BollingerBands, ATR } from 'technicalindicators';

/**
 * Calculate all technical indicators for a stock
 */
export function calculateTechnicalIndicators(priceData) {
  if (!priceData || priceData.length < 50) {
    return null; // Need at least 50 data points
  }
  
  const closes = priceData.map(d => d.close);
  const highs = priceData.map(d => d.high);
  const lows = priceData.map(d => d.low);
  const volumes = priceData.map(d => d.volume);
  
  try {
    // Simple Moving Averages
    const sma20 = SMA.calculate({ period: 20, values: closes });
    const sma50 = SMA.calculate({ period: 50, values: closes });
    const sma200 = closes.length >= 200 ? SMA.calculate({ period: 200, values: closes }) : null;
    
    // Exponential Moving Averages
    const ema12 = EMA.calculate({ period: 12, values: closes });
    const ema26 = EMA.calculate({ period: 26, values: closes });
    
    // RSI (Relative Strength Index)
    const rsi = RSI.calculate({ period: 14, values: closes });
    
    // MACD
    const macd = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
    
    // Bollinger Bands
    const bb = BollingerBands.calculate({
      period: 20,
      values: closes,
      stdDev: 2
    });
    
    // ATR (Average True Range) - Volatility
    const atr = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14
    });
    
    // Get latest values
    const currentPrice = closes[closes.length - 1];
    const latestRSI = rsi[rsi.length - 1];
    const latestMACD = macd[macd.length - 1];
    const latestBB = bb[bb.length - 1];
    const latestSMA20 = sma20[sma20.length - 1];
    const latestSMA50 = sma50[sma50.length - 1];
    const latestSMA200 = sma200 ? sma200[sma200.length - 1] : null;
    const latestATR = atr[atr.length - 1];
    
    // Calculate average volume
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    
    // Trend Analysis
    const trend = analyzeTrend(currentPrice, latestSMA20, latestSMA50, latestSMA200);
    
    // Signal Analysis
    const signals = generateSignals(latestRSI, latestMACD, currentPrice, latestBB, trend);
    
    return {
      current: {
        price: currentPrice,
        volume: currentVolume,
        avgVolume: avgVolume,
        volumeRatio: (currentVolume / avgVolume).toFixed(2)
      },
      movingAverages: {
        sma20: latestSMA20,
        sma50: latestSMA50,
        sma200: latestSMA200,
        ema12: ema12[ema12.length - 1],
        ema26: ema26[ema26.length - 1]
      },
      indicators: {
        rsi: latestRSI,
        macd: {
          value: latestMACD.MACD,
          signal: latestMACD.signal,
          histogram: latestMACD.histogram
        },
        bollingerBands: {
          upper: latestBB.upper,
          middle: latestBB.middle,
          lower: latestBB.lower
        },
        atr: latestATR
      },
      trend,
      signals,
      chartData: {
        sma20: sma20.slice(-50),
        sma50: sma50.slice(-50),
        rsi: rsi.slice(-50),
        macd: macd.slice(-50),
        bollingerBands: bb.slice(-50)
      }
    };
  } catch (error) {
    console.error('Technical analysis error:', error);
    return null;
  }
}

/**
 * Analyze trend based on moving averages
 */
function analyzeTrend(price, sma20, sma50, sma200) {
  let strength = 0;
  let direction = 'neutral';
  
  // Price vs SMAs
  if (price > sma20) strength += 1;
  if (price > sma50) strength += 1;
  if (sma200 && price > sma200) strength += 1;
  
  // SMA alignment
  if (sma20 > sma50) strength += 1;
  if (sma200 && sma50 > sma200) strength += 1;
  
  if (strength >= 4) {
    direction = 'strong_uptrend';
  } else if (strength >= 3) {
    direction = 'uptrend';
  } else if (strength <= 1) {
    direction = 'downtrend';
  } else if (strength === 0) {
    direction = 'strong_downtrend';
  }
  
  return {
    direction,
    strength,
    description: getTrendDescription(direction)
  };
}

/**
 * Generate buy/sell/hold signals
 */
function generateSignals(rsi, macd, price, bb, trend) {
  const signals = [];
  let overallSignal = 'hold';
  let score = 0;
  
  // RSI Signals
  if (rsi < 30) {
    signals.push({ type: 'buy', indicator: 'RSI', reason: 'Oversold (RSI < 30)', strength: 'strong' });
    score += 2;
  } else if (rsi < 40) {
    signals.push({ type: 'buy', indicator: 'RSI', reason: 'Approaching oversold', strength: 'weak' });
    score += 1;
  } else if (rsi > 70) {
    signals.push({ type: 'sell', indicator: 'RSI', reason: 'Overbought (RSI > 70)', strength: 'strong' });
    score -= 2;
  } else if (rsi > 60) {
    signals.push({ type: 'sell', indicator: 'RSI', reason: 'Approaching overbought', strength: 'weak' });
    score -= 1;
  }
  
  // MACD Signals
  if (macd.histogram > 0 && macd.MACD > macd.signal) {
    signals.push({ type: 'buy', indicator: 'MACD', reason: 'Bullish crossover', strength: 'medium' });
    score += 1.5;
  } else if (macd.histogram < 0 && macd.MACD < macd.signal) {
    signals.push({ type: 'sell', indicator: 'MACD', reason: 'Bearish crossover', strength: 'medium' });
    score -= 1.5;
  }
  
  // Bollinger Bands Signals
  const bbPosition = ((price - bb.lower) / (bb.upper - bb.lower)) * 100;
  if (bbPosition < 10) {
    signals.push({ type: 'buy', indicator: 'BB', reason: 'Price near lower band', strength: 'medium' });
    score += 1;
  } else if (bbPosition > 90) {
    signals.push({ type: 'sell', indicator: 'BB', reason: 'Price near upper band', strength: 'medium' });
    score -= 1;
  }
  
  // Trend Signals
  if (trend.direction === 'strong_uptrend') {
    signals.push({ type: 'buy', indicator: 'Trend', reason: 'Strong uptrend', strength: 'strong' });
    score += 2;
  } else if (trend.direction === 'strong_downtrend') {
    signals.push({ type: 'sell', indicator: 'Trend', reason: 'Strong downtrend', strength: 'strong' });
    score -= 2;
  }
  
  // Overall Signal
  if (score >= 3) {
    overallSignal = 'strong_buy';
  } else if (score >= 1) {
    overallSignal = 'buy';
  } else if (score <= -3) {
    overallSignal = 'strong_sell';
  } else if (score <= -1) {
    overallSignal = 'sell';
  }
  
  return {
    overall: overallSignal,
    score,
    details: signals
  };
}

function getTrendDescription(direction) {
  const descriptions = {
    'strong_uptrend': 'מגמת עלייה חזקה - כל המדדים חיוביים',
    'uptrend': 'מגמת עלייה - רוב המדדים חיוביים',
    'neutral': 'ניטרלי - אין מגמה ברורה',
    'downtrend': 'מגמת ירידה - רוב המדדים שליליים',
    'strong_downtrend': 'מגמת ירידה חזקה - כל המדדים שליליים'
  };
  return descriptions[direction] || 'לא ידוע';
}

export default {
  calculateTechnicalIndicators
};