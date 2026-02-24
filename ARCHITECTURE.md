# ארכיטקטורה - מערכת ניתוח דוחות כספיים
# Financial Analysis System Architecture

## סקירה כללית / Overview

מערכת web-based לניתוח דוחות כספיים של חברות ציבוריות, עם ממשק בעברית ופשטות שמתאימה גם למשתמשים ללא רקע פינסי.

A web-based system for analyzing public company financial reports, with Hebrew interface and simplicity suitable for users without financial background.

---

## ארכיטקטורת המערכת / System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                        │
│                  (React + Vite + RTL)                    │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Dashboard   │  │   Company    │  │  Comparison  │ │
│  │   Overview   │  │   Details    │  │     View     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend API Layer                     │
│                  (Node.js + Express)                     │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Company    │  │   Analysis   │  │     AI       │ │
│  │   Data API   │  │   Engine     │  │   Service    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌──────────────────┐ ┌─────────────┐ ┌────────────────┐
│  External APIs   │ │   Database  │ │  Claude API    │
│  - SEC EDGAR     │ │  (SQLite)   │ │  (Analysis)    │
│  - Financial API │ │             │ │                │
└──────────────────┘ └─────────────┘ └────────────────┘
```

---

## רכיבי המערכת / System Components

### 1. Frontend (React + Vite)

**טכנולוגיות:**
- React 18 with TypeScript
- Vite (build tool)
- TailwindCSS (styling with RTL support)
- Recharts (data visualization)
- React Query (data fetching)
- i18next (Hebrew/English localization)

**עמודים ראשיים:**
- דף ראשי עם חיפוש חברות
- Dashboard של חברה ספציפית
- השוואה בין חברות
- Portfolio tracking (future)

### 2. Backend (Node.js)

**טכנולוגיות:**
- Express.js
- SQLite (development) → PostgreSQL (production option)
- Axios for external API calls
- Node-cron for scheduled data updates

**API Endpoints:**
```
GET  /api/companies              # רשימת חברות
GET  /api/company/:symbol        # נתוני חברה
GET  /api/company/:symbol/analysis  # ניתוח מלא
POST /api/analyze                # ניתוח חדש
GET  /api/compare/:symbols       # השוואה
```

### 3. Data Layer

**מקורות נתונים:**
- **SEC EDGAR API** (free) - US companies 10-K, 10-Q filings
- **Financial Modeling Prep API** (free tier) - financial metrics, ratios
- **Alpha Vantage** (free tier) - stock prices, fundamentals
- **TASE API** (for Israeli companies - future)

**Database Schema:**
```sql
-- Companies table
CREATE TABLE companies (
  symbol TEXT PRIMARY KEY,
  name TEXT,
  sector TEXT,
  market_cap REAL,
  last_updated DATETIME
);

-- Financial Reports table
CREATE TABLE reports (
  id INTEGER PRIMARY KEY,
  company_symbol TEXT,
  report_type TEXT,  -- 10-K, 10-Q, earnings
  filing_date DATE,
  period_end DATE,
  revenue REAL,
  net_income REAL,
  eps REAL,
  raw_data JSON,
  FOREIGN KEY (company_symbol) REFERENCES companies(symbol)
);

-- AI Analysis Cache
CREATE TABLE analysis_cache (
  id INTEGER PRIMARY KEY,
  company_symbol TEXT,
  report_id INTEGER,
  analysis_text TEXT,
  insights JSON,
  created_at DATETIME,
  FOREIGN KEY (report_id) REFERENCES reports(id)
);
```

### 4. AI Analysis Service

**שימוש ב-Claude API:**
```javascript
// Analysis prompt template
const analysisPrompt = `
אנא נתח את הדוח הכספי הבא של חברת ${company} ופרש אותו בשפה פשוטה:

נתונים כספיים:
- הכנסות: ${revenue}
- רווח נקי: ${netIncome}
- שינוי רבעוני: ${qoqGrowth}%

ספק:
1. סיכום בשפה פשוטה (3-4 משפטים)
2. מה זה אומר למשקיעים
3. אזהרות או סיכונים
4. השוואה לרבעון הקודם
`;
```

**תכונות AI:**
- סיכומים בשפה פשוטה
- זיהוי טרנדים
- התראות על שינויים משמעותיים
- הסברים לג'רגון פיננסי

---

## תרחיש שימוש לדוגמה / Example User Flow

1. **משתמש מחפש "NVDA"**
   ```
   Frontend → Backend API → Check DB cache
   ↓ (if not cached)
   Backend → SEC EDGAR API → Fetch latest 10-Q
   Backend → Parse financial data
   Backend → Claude API → Generate Hebrew summary
   Backend → Save to DB
   Backend → Return to Frontend
   Frontend → Display dashboard
   ```

2. **תצוגת Dashboard:**
   ```
   ┌─────────────────────────────────────┐
   │  NVIDIA Corporation (NVDA)          │
   │  מחיר: $XXX | שווי שוק: $XXX מיליארד │
   ├─────────────────────────────────────┤
   │  📊 ביצועים רבעוניים               │
   │  • הכנסות: +18% (רבעון אחרון)      │
   │  • רווחיות: XX% מרווח רווח          │
   │                                     │
   │  💡 תובנות AI:                      │
   │  "נבידיה ממשיכה לגדול בזכות..."    │
   │                                     │
   │  📈 [גרף מגמות הכנסות]             │
   │  🔍 [השוואה למתחרים]               │
   └─────────────────────────────────────┘
   ```

---

## תכנית פיתוח / Development Plan

### Phase 1: MVP (2-3 weeks)
- [x] Basic project setup
- [ ] Frontend skeleton with Hebrew support
- [ ] Backend API with SEC EDGAR integration
- [ ] Database setup
- [ ] Single company analysis view
- [ ] Claude API integration for summaries

### Phase 2: Core Features (2-3 weeks)
- [ ] Multiple companies support
- [ ] Comparison view
- [ ] Historical data trends
- [ ] Enhanced visualizations
- [ ] Alert system

### Phase 3: Advanced Features (ongoing)
- [ ] Israeli companies (TASE)
- [ ] Portfolio tracking
- [ ] Email alerts
- [ ] Export to PDF
- [ ] Mobile responsive optimization

---

## טכנולוגיות לגרסה ראשונית / Tech Stack for Initial Version

### Development Environment
```json
{
  "frontend": {
    "framework": "React 18 + Vite",
    "language": "TypeScript",
    "styling": "TailwindCSS with RTL",
    "charts": "Recharts",
    "state": "React Query + Context",
    "i18n": "react-i18next"
  },
  "backend": {
    "runtime": "Node.js 20+",
    "framework": "Express.js",
    "database": "SQLite (dev) / PostgreSQL (prod)",
    "orm": "Better-SQLite3",
    "ai": "Anthropic Claude API"
  },
  "deployment": {
    "local": "npm run dev (Vite dev server)",
    "production": "Docker or Vercel/Railway"
  }
}
```

---

## הוראות הפעלה / Setup Instructions

### Prerequisites
```bash
# Install Node.js 20+ and npm
node --version  # v20.x.x
npm --version   # 10.x.x
```

### Local Development
```bash
# 1. Install dependencies
cd frontend && npm install
cd ../backend && npm install

# 2. Setup environment variables
# backend/.env
CLAUDE_API_KEY=your_key_here
SEC_API_KEY=optional
FMP_API_KEY=optional

# 3. Initialize database
cd backend && npm run db:init

# 4. Start development servers
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev

# Open http://localhost:5173
```

### Production Deployment (Future)
```bash
# Option 1: Docker
docker-compose up -d

# Option 2: Cloud Platform
# - Frontend: Vercel/Netlify
# - Backend: Railway/Render
# - Database: Railway PostgreSQL
```

---

## אבטחה ו-API Keys / Security & API Keys

**API Keys Management:**
- SEC EDGAR: No key required (rate limited to 10 req/sec)
- Financial Modeling Prep: Free tier 250 requests/day
- Claude API: Pay as you go (recommended for production)
- All keys stored in `.env` file (never committed to git)

**Rate Limiting:**
- Cache all API responses in database
- Implement request throttling
- Use background jobs for bulk updates

---

## מבנה קבצים / File Structure

```
financial-analyzer/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── CompanyCard.tsx
│   │   │   ├── FinancialChart.tsx
│   │   │   └── AnalysisSummary.tsx
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── CompanyPage.tsx
│   │   │   └── ComparePage.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── locales/
│   │   │   ├── he.json
│   │   │   └── en.json
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── companies.js
│   │   │   └── analysis.js
│   │   ├── services/
│   │   │   ├── sec-api.js
│   │   │   ├── financial-api.js
│   │   │   ├── claude-service.js
│   │   │   └── database.js
│   │   ├── utils/
│   │   │   ├── parser.js
│   │   │   └── calculator.js
│   │   └── server.js
│   ├── package.json
│   └── database.db
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Next Steps

1. ✅ Review architecture
2. ⏭️ Generate initial codebase
3. ⏭️ Test with sample company (NVDA)
4. ⏭️ Iterate and improve

Ready to create the initial version?
