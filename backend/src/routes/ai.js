import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ── POST /api/ai/analyze-stock ────────────────────────────────────────────────
// Accepts stock data from frontend, calls Claude, returns Hebrew research report
router.post('/analyze-stock', requireAuth, async (req, res) => {
  try {
    const { symbol, name, price, changePercent, currency, isTase, sector, marketCap, news } = req.body;

    if (!symbol) return res.status(400).json({ success: false, error: 'symbol required' });

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
      return res.status(503).json({ success: false, error: 'CLAUDE_API_KEY not configured' });
    }

    const anthropic = new Anthropic({ apiKey });

    const currencyLabel = currency === 'ILS' ? '₪ (שקל)' : '$ (דולר)';
    const marketLabel   = isTase ? 'בורסת תל אביב (TASE)' : 'בורסה אמריקאית (NYSE/NASDAQ)';
    const newsText = (news && news.length > 0)
      ? news.slice(0, 5).map((n, i) => `${i + 1}. ${n.title}`).join('\n')
      : 'אין חדשות זמינות';

    const prompt = `אתה אנליסט פיננסי מומחה המספק מחקר למשקיעים ישראליים.

נתח את המניה הבאה וספק דוח מחקר קצר ומועיל:

**פרטי המניה:**
- סימול: ${symbol}
- שם: ${name || symbol}
- שוק: ${marketLabel}
- מחיר נוכחי: ${price ? `${currencyLabel} ${price}` : 'לא זמין'}
- שינוי יומי: ${changePercent != null ? `${changePercent > 0 ? '+' : ''}${parseFloat(changePercent).toFixed(2)}%` : 'לא זמין'}
- סקטור: ${sector || 'לא ידוע'}
- שווי שוק: ${marketCap ? `$${(marketCap / 1e9).toFixed(2)} מיליארד` : 'לא זמין'}

**חדשות אחרונות:**
${newsText}

**בקשה:**
ספק ניתוח קצר ומועיל בעברית. החזר תשובה ב-JSON בלבד בפורמט הזה (בלי markdown, בלי '''json):
{
  "summary": "סיכום כללי של המניה ב-2-3 משפטים",
  "strengths": ["חוזק 1", "חוזק 2", "חוזק 3"],
  "risks": ["סיכון 1", "סיכון 2", "סיכון 3"],
  "sentiment": "bullish" | "bearish" | "neutral",
  "recommendation": "קנייה" | "המתנה" | "מכירה",
  "recommendation_reason": "הסבר קצר להמלצה",
  "disclaimer": "זהו ניתוח אוטומטי בלבד ואינו מהווה המלצת השקעה"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = message.content[0].text.trim();

    // Parse JSON from response
    let result;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text, strengths: [], risks: [], sentiment: 'neutral' };
    } catch {
      result = { summary: text, strengths: [], risks: [], sentiment: 'neutral' };
    }

    res.json({ success: true, data: result });

  } catch (error) {
    console.error('AI analyze-stock error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST /api/ai/analyze-portfolio ───────────────────────────────────────────
// Analyzes entire portfolio P&L and provides AI insights
router.post('/analyze-portfolio', requireAuth, async (req, res) => {
  try {
    const { holdings, totalPnl, totalInvested, totalValue, currency } = req.body;

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
      return res.status(503).json({ success: false, error: 'CLAUDE_API_KEY not configured' });
    }

    const anthropic = new Anthropic({ apiKey });

    const holdingsSummary = (holdings || [])
      .slice(0, 10)
      .map(h => `- ${h.symbol}: ${h.profitPct > 0 ? '+' : ''}${h.profitPct?.toFixed(1)}% (השקעה: ${h.currency === 'ILS' ? '₪' : '$'}${h.totalInvested?.toFixed(0)})`)
      .join('\n');

    const prompt = `אתה יועץ פיננסי. נתח את תיק ההשקעות הבא וספק תובנות:

**סיכום תיק:**
- סה"כ מושקע: $${totalInvested?.toFixed(0) || 0}
- שווי נוכחי: $${totalValue?.toFixed(0) || 0}
- רווח/הפסד כולל: ${totalPnl >= 0 ? '+' : ''}$${totalPnl?.toFixed(0) || 0} (${totalInvested > 0 ? ((totalPnl / totalInvested) * 100).toFixed(1) : 0}%)

**אחזקות:**
${holdingsSummary || 'אין אחזקות'}

החזר JSON בלבד:
{
  "overall_assessment": "הערכה כללית של התיק ב-2 משפטים",
  "diversification": "הערכת פיזור הסיכונים",
  "top_advice": ["עצה 1", "עצה 2", "עצה 3"],
  "disclaimer": "זהו ניתוח אוטומטי בלבד"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = message.content[0].text.trim();
    let result;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { overall_assessment: text };
    } catch {
      result = { overall_assessment: text };
    }

    res.json({ success: true, data: result });

  } catch (error) {
    console.error('AI analyze-portfolio error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
