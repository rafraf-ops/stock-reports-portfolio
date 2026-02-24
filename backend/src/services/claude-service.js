import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

/**
 * Generate financial analysis summary in Hebrew
 */
export async function generateHebrewSummary(companyData, financialData) {
  const { name, symbol, sector } = companyData;
  const { revenue, netIncome, metrics } = financialData;
  
  const prompt = `אתה אנליסט פיננסי מומחה. נתח את הדוח הכספי הבא של ${name} (${symbol}) והצג את הממצאים בשפה פשוטה וברורה למשקיעים ישראליים.

**נתונים כספיים:**
- הכנסות רבעוניות: $${(revenue?.val / 1000000000).toFixed(2)} מיליארד
- רווח נקי: $${(netIncome?.val / 1000000000).toFixed(2)} מיליארד
- תאריך הדוח: ${revenue?.filed}
- שינוי רבעוני בהכנסות: ${metrics?.revenue_qoq}%
- מרווח רווח נקי: ${metrics?.profit_margin}%
- תעשייה: ${sector}

**בקשה:**
1. סכם את הביצועים הכספיים ב-3-4 משפטים פשוטים
2. הסבר מה זה אומר למשקיעים (האם זה טוב או רע?)
3. ציין 2-3 נקודות חשובות או מגמות
4. הזהר מפני סיכונים אפשריים

**פורמט התשובה:**
השתמש ב-JSON בפורמט הבא:
{
  "summary": "סיכום כללי...",
  "investor_impact": "משמעות למשקיעים...",
  "key_points": ["נקודה 1", "נקודה 2", "נקודה 3"],
  "risks": ["סיכון 1", "סיכון 2"]
}

שמור על שפה פשוטה וברורה, הימנע מז'רגון פיננסי מורכב.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    const responseText = message.content[0].text;
    
    // Try to parse JSON response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('Failed to parse JSON, returning raw text');
    }
    
    return {
      summary: responseText,
      investor_impact: '',
      key_points: [],
      risks: []
    };
    
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

/**
 * Compare multiple companies and provide insights
 */
export async function compareCompanies(companies) {
  const companyData = companies.map(c => 
    `${c.name} (${c.symbol}): הכנסות $${(c.revenue / 1000000000).toFixed(2)}B, רווח נקי $${(c.netIncome / 1000000000).toFixed(2)}B, מרווח רווח ${c.profitMargin}%`
  ).join('\n');
  
  const prompt = `השווה בין החברות הבאות מבחינה פיננסית:

${companyData}

ספק:
1. מי מוביל בכל קטגוריה (הכנסות, רווחיות, צמיחה)
2. איזו חברה נראית כהשקעה טובה יותר ולמה
3. מה היתרונות והחסרונות של כל אחת

השב בעברית פשוטה וברורה.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    return message.content[0].text;
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

/**
 * Explain financial term in simple Hebrew
 */
export async function explainFinancialTerm(term) {
  const prompt = `הסבר את המונח הפיננסי "${term}" בשפה פשוטה לאדם שלא בקיא בשוק ההון.

כלול:
1. הגדרה פשוטה במשפט אחד
2. דוגמה מהחיים
3. למה זה חשוב למשקיעים

השב בעברית.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    return message.content[0].text;
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

/**
 * Analyze trends from historical data
 */
export async function analyzeTrends(historicalData, companyName) {
  const trendData = historicalData.map((d, i) => 
    `Q${d.quarter} ${d.year}: הכנסות $${(d.revenue / 1000000000).toFixed(2)}B, רווח נקי $${(d.netIncome / 1000000000).toFixed(2)}B`
  ).join('\n');
  
  const prompt = `נתח את המגמות הפיננסיות של ${companyName} על פני ${historicalData.length} רבעונים אחרונים:

${trendData}

זהה:
1. האם החברה בצמיחה או בירידה?
2. האם הרווחיות משתפרת?
3. מה הסיבות האפשריות למגמות?
4. מה צפוי בעתיד לפי המגמה?

השב בעברית בצורה תמציתית.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    return message.content[0].text;
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

export default {
  generateHebrewSummary,
  compareCompanies,
  explainFinancialTerm,
  analyzeTrends
};
