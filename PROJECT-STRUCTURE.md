# מבנה הפרויקט | Project Structure

```
financial-analyzer/
│
├── 📄 README.md                    # תיעוד מלא של הפרויקט
├── 📄 QUICKSTART.md                # מדריך התחלה מהירה
├── 📄 ARCHITECTURE.md              # תיעוד ארכיטקטורה מפורט
├── 🔧 setup.sh                     # סקריפט התקנה אוטומטי
├── 📝 .gitignore                   # קבצים להתעלמות ב-Git
│
├── 🖥️ backend/                     # שרת Backend (Node.js + Express)
│   ├── package.json               # תלויות Backend
│   ├── .env.example               # תבנית משתני סביבה
│   │
│   └── src/
│       ├── 🚀 server.js           # נקודת כניסה - Express server
│       │
│       ├── 📡 routes/
│       │   └── companies.js       # API endpoints לחברות
│       │
│       ├── ⚙️ services/
│       │   ├── database.js        # פעולות מסד נתונים (SQLite)
│       │   ├── sec-api.js         # שליפת נתונים מ-SEC EDGAR
│       │   └── claude-service.js  # ניתוח AI באמצעות Claude
│       │
│       └── 📜 scripts/
│           └── init-db.js         # אתחול מסד נתונים
│
└── 💻 frontend/                    # ממשק משתמש (React + Vite)
    ├── package.json               # תלויות Frontend
    ├── vite.config.js             # הגדרות Vite
    ├── tailwind.config.js         # הגדרות Tailwind CSS
    ├── postcss.config.js          # הגדרות PostCSS
    ├── index.html                 # HTML ראשי (עם תמיכה RTL)
    │
    └── src/
        ├── 🎯 main.jsx            # נקודת כניסה - React app
        ├── 📱 App.jsx             # קומפוננטת App ראשית + Routing
        ├── 🎨 index.css           # Tailwind CSS + עיצוב כללי
        │
        ├── 📄 pages/
        │   ├── HomePage.jsx       # עמוד ראשי - רשימת חברות
        │   └── CompanyPage.jsx    # עמוד חברה - ניתוח מפורט
        │
        ├── 🧩 components/
        │   ├── CompanyCard.jsx    # כרטיס חברה
        │   └── FinancialChart.jsx # גרף נתונים פיננסיים
        │
        └── 🔌 services/
            └── api.js             # API client + helper functions

📊 Database (נוצר אוטומטית):
└── backend/database.db            # SQLite database

```

---

## סיכום קבצים

### Backend (9 קבצים)
- ✅ `server.js` - Express server עם API routes
- ✅ `routes/companies.js` - 6 endpoints (GET, POST)
- ✅ `services/database.js` - פעולות CRUD על SQLite
- ✅ `services/sec-api.js` - שליפת נתונים מ-SEC
- ✅ `services/claude-service.js` - ניתוח AI
- ✅ `scripts/init-db.js` - יצירת טבלאות + נתונים לדוגמה
- ✅ `package.json` - תלויות (Express, SQLite, Claude SDK, etc.)
- ✅ `.env.example` - תבנית למפתחות API

### Frontend (12 קבצים)
- ✅ `main.jsx` - React entry point
- ✅ `App.jsx` - Routing + React Query setup
- ✅ `index.css` - Tailwind + RTL styles
- ✅ `pages/HomePage.jsx` - דף חיפוש חברות
- ✅ `pages/CompanyPage.jsx` - דף ניתוח חברה
- ✅ `components/CompanyCard.jsx` - UI component
- ✅ `components/FinancialChart.jsx` - Recharts visualization
- ✅ `services/api.js` - Axios client
- ✅ `index.html` - HTML עם RTL support
- ✅ `vite.config.js` - Vite + proxy config
- ✅ `tailwind.config.js` - Tailwind RTL theme
- ✅ `package.json` - תלויות (React, Vite, TailwindCSS, etc.)

### תיעוד (4 קבצים)
- ✅ `README.md` - מדריך מלא (עברית + אנגלית)
- ✅ `QUICKSTART.md` - מדריך התחלה מהירה
- ✅ `ARCHITECTURE.md` - תיעוד ארכיטקטורה
- ✅ `setup.sh` - סקריפט התקנה אוטומטי

### סה"כ: 26 קבצים

---

## טכנולוגיות ראשיות

### Backend Stack
| טכנולוגיה | תפקיד |
|-----------|-------|
| Node.js 20+ | Runtime environment |
| Express.js | Web framework |
| Better-SQLite3 | Database (file-based, fast) |
| Claude API | AI analysis |
| SEC EDGAR API | Financial data source |
| Axios | HTTP client |

### Frontend Stack
| טכנולוגיה | תפקיד |
|-----------|-------|
| React 18 | UI framework |
| Vite | Build tool (dev server) |
| TailwindCSS | Styling (RTL support) |
| React Router | Navigation |
| React Query | Data fetching & caching |
| Recharts | Charts & visualizations |

---

## Flow נתונים

```
1. User searches "NVDA" in Frontend
   ↓
2. Frontend → GET /api/companies/NVDA
   ↓
3. Backend checks database cache
   ↓
4. If no data → SEC API → Fetch 10-Q/10-K
   ↓
5. Parse financial data → Save to DB
   ↓
6. Claude API → Generate Hebrew summary
   ↓
7. Save analysis to cache
   ↓
8. Return JSON to Frontend
   ↓
9. Display: Metrics + Charts + AI insights
```

---

## API מקורות נתונים

| API | שימוש | עלות |
|-----|-------|------|
| SEC EDGAR | דוחות כספיים (10-K, 10-Q) | חינמי |
| Claude API | ניתוח AI בעברית | ~$0.01-0.02 לניתוח |
| Financial Modeling Prep | נתונים נוספים (אופציונלי) | Free tier: 250/day |

---

## דרישות מערכת

- **Node.js**: 20.x או גרסה חדשה יותר
- **RAM**: 512MB מינימום
- **Storage**: 100MB לקוד + 50MB למסד נתונים
- **Network**: חיבור אינטרנט לAPI calls

---

זהו! כל הקבצים מוכנים לשימוש 🚀
