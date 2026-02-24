// Mock Claude API responses (no API key needed)
export async function generateHebrewSummary(companyData, financialData) {
  const { name, symbol } = companyData;
  const { metrics } = financialData;
  
  // Simulate AI analysis with template
  return {
    summary: `חברת ${name} (${symbol}) מציגה ביצועים חזקים ברבעון האחרון. ההכנסות עלו ב-${metrics?.revenue_qoq || 'N/A'}% לעומת הרבעון הקודם, מה שמעיד על צמיחה מתמשכת. מרווח הרווח הנקי עומד על ${metrics?.profit_margin || 'N/A'}%, המעיד על יעילות תפעולית גבוהה.`,
    
    investor_impact: `למשקיעים: החברה ממשיכה לשפר את התוצאות הפיננסיות שלה. הצמיחה ברבעון האחרון מעידה על ביקוש חזק למוצרי החברה ויכולת להגדיל את נתח השוק.`,
    
    key_points: [
      `צמיחה של ${metrics?.revenue_qoq || 'N/A'}% בהכנסות הרבעוניות`,
      `מרווח רווח נקי גבוה של ${metrics?.profit_margin || 'N/A'}%`,
      `המשך מגמת צמיחה חיובית בתעשייה`
    ],
    
    risks: [
      `תלות בשוק הטכנולוגיה התנודתי`,
      `תחרות גוברת מצד שחקנים גדולים בתעשייה`
    ]
  };
}

export async function compareCompanies(companies) {
  return `השוואה בין החברות:\n${companies.map(c => `${c.name}: הכנסות של $${(c.revenue/1e9).toFixed(2)}B`).join('\n')}`;
}

export async function explainFinancialTerm(term) {
  return `המונח "${term}" הוא מדד פיננסי חשוב למעקב אחר ביצועי חברה.`;
}

export async function analyzeTrends(historicalData, companyName) {
  return `${companyName} מציגה מגמת צמיחה עקבית על פני ${historicalData.length} רבעונים.`;
}

export default {
  generateHebrewSummary,
  compareCompanies,
  explainFinancialTerm,
  analyzeTrends
};