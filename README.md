# מערכת ניתוח דוחות כספיים | Financial Analyzer

מערכת web-based לניתוח דוחות כספיים של חברות ציבוריות, עם ממשק בעברית ותמיכה ב-AI לסיכומים פשוטים ומובנים.

## תכונות עיקריות | Features

✅ **ניתוח אוטומטי של דוחות SEC** - משיכת נתונים ישירות מה-SEC EDGAR API  
✅ **ממשק בעברית** - תמיכה מלאה ב-RTL ושפה עברית  
✅ **סיכומי AI** - ניתוח אינטליגנטי בשפה פשוטה באמצעות Claude  
✅ **ויזואליזציות** - גרפים אינטראקטיביים של מגמות פיננסיות  
✅ **השוואת חברות** - השוואה בין מספר חברות  
✅ **מטמון חכם** - שמירת ניתוחים להפחתת עלויות API  

---

## דרישות מקדימות | Prerequisites

- **Node.js** 20.x או גרסה חדשה יותר
- **npm** 10.x או גרסה חדשה יותר
- **Claude API Key** - [קבל מכאן](https://console.anthropic.com/)

---

## התקנה מהירה | Quick Start

### 1. התקן תלויות | Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. הגדר משתני סביבה | Configure Environment

צור קובץ `.env` בתיקיית `backend/`:

```bash
cd backend
cp .env.example .env
```

ערוך את `.env` והוסף את מפתח ה-API שלך:

```env
CLAUDE_API_KEY=sk-ant-xxxxx  # חובה!
PORT=3000
NODE_ENV=development
```

### 3. אתחל מסד נתונים | Initialize Database

```bash
cd backend
npm run db:init
```

פעולה זו תיצור:
- קובץ `database.db` עם הטבלאות הדרושות
- 7 חברות לדוגמה (NVDA, AAPL, MSFT, GOOGL, TSLA, AMD, INTC)

### 4. הפעל את המערכת | Start the System

פתח **2 טרמינלים**:

**טרמינל 1 - Backend:**
```bash
cd backend
npm run dev
```

שרת ה-API יעלה על `http://localhost:3000`

**טרמינל 2 - Frontend:**
```bash
cd frontend
npm run dev
```

הממשק יעלה על `http://localhost:5173`

---

## שימוש | Usage

### חיפוש חברה

1. פתח את הדפדפן בכתובת `http://localhost:5173`
2. חפש חברה לפי סימול (לדוגמה: NVDA, AAPL, MSFT)
3. לחץ על כרטיס החברה לצפייה בפרטים

### ניתוח ראשוני

כשאתה פותח חברה לראשונה, המערכת:
1. שולפת נתונים מ-SEC (אם אין במטמון)
2. מנתחת את הדוחות באמצעות Claude AI
3. מציגה:
   - מדדי מפתח (הכנסות, רווח, מרווחים)
   - סיכום AI בעברית פשוטה
   - נקודות מפתח ותובנות
   - סיכונים אפשריים
   - גרפי מגמות
   - היסטוריית דוחות

### עדכון ניתוח

- לחץ על "עדכן ניתוח" כדי לקבל ניתוח חדש מ-AI
- הניתוח נשמר במטמון למשך 24 שעות

---

## API Endpoints

### GET /api/companies
קבל רשימת כל החברות

```bash
curl http://localhost:3000/api/companies
```

### GET /api/companies/:symbol
קבל פרטי חברה ספציפית

```bash
curl http://localhost:3000/api/companies/NVDA
```

### GET /api/companies/:symbol/analysis
קבל ניתוח AI של החברה

```bash
curl http://localhost:3000/api/companies/NVDA/analysis
```

### POST /api/companies/:symbol/refresh
רענן נתונים מ-SEC

```bash
curl -X POST http://localhost:3000/api/companies/NVDA/refresh
```

### POST /api/companies/compare
השווה בין מספר חברות

```bash
curl -X POST http://localhost:3000/api/companies/compare \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["NVDA", "AMD", "INTC"]}'
```

---

## מבנה הפרויקט | Project Structure

```
financial-analyzer/
├── backend/
│   ├── src/
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic
│   │   │   ├── database.js   # DB operations
│   │   │   ├── sec-api.js    # SEC data fetching
│   │   │   └── claude-service.js  # AI analysis
│   │   ├── scripts/
│   │   │   └── init-db.js    # DB initialization
│   │   └── server.js         # Express app
│   ├── package.json
│   └── .env                  # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
│
└── ARCHITECTURE.md           # Detailed architecture doc
```

---

## טכנולוגיות | Tech Stack

### Backend
- **Node.js + Express** - Server framework
- **Better-SQLite3** - Database (fast, file-based)
- **Claude API** - AI analysis
- **SEC EDGAR API** - Financial data (free)
- **Axios** - HTTP client

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool (fast dev server)
- **TailwindCSS** - Styling with RTL support
- **React Query** - Data fetching & caching
- **Recharts** - Charts & visualizations
- **React Router** - Navigation

---

## פתרון בעיות | Troubleshooting

### שגיאה: "Claude API key missing"
וודא שהגדרת את `CLAUDE_API_KEY` בקובץ `.env`

### שגיאה: "Company not found in SEC database"
לא כל החברות זמינות ב-SEC. נסה חברות אמריקאיות גדולות כמו:
- NVDA (Nvidia)
- AAPL (Apple)
- MSFT (Microsoft)
- GOOGL (Alphabet)

### הממשק לא טוען נתונים
1. בדוק ש-Backend רץ על פורט 3000
2. בדוק את לוגים בטרמינל של Backend
3. פתח את Developer Console בדפדפן (F12)

### Rate Limit של SEC
SEC מגביל ל-10 בקשות לשנייה. המערכת משתמשת ב-rate limiting אוטומטי.

---

## הוספת חברות חדשות | Adding New Companies

### דרך 1: דרך הממשק
1. חפש את הסימול של החברה
2. המערכת תשלוף אוטומטית מ-SEC בפעם הראשונה

### דרך 2: דרך ה-API
```bash
curl -X POST http://localhost:3000/api/companies/TSLA/refresh
```

### דרך 3: ישירות למסד הנתונים
```sql
INSERT INTO companies (symbol, name, sector, industry)
VALUES ('MSFT', 'Microsoft Corporation', 'Technology', 'Software');
```

---

## פריסה לייצור | Production Deployment

### אפשרות 1: Docker (מומלץ)

צור `Dockerfile` לכל שירות ו-`docker-compose.yml`:

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - DATABASE_PATH=/data/database.db
    volumes:
      - ./data:/data

  frontend:
    build: ./frontend
    ports:
      - "80:80"
```

### אפשרות 2: פלטפורמות Cloud

**Backend:**
- Railway
- Render
- Fly.io

**Frontend:**
- Vercel (מומלץ)
- Netlify
- Cloudflare Pages

**Database:**
- Railway PostgreSQL (במקום SQLite)
- Supabase

---

## עלויות | Costs

### API Calls
- **SEC EDGAR**: חינמי לחלוטין (10 req/sec)
- **Claude API**: 
  - Input: ~$3 per 1M tokens
  - Output: ~$15 per 1M tokens
  - ניתוח טיפוסי: ~500-1000 tokens = $0.01-0.02

### הפחתת עלויות
✅ השתמש במטמון (analysis מתעדכן רק לפי דרישה)  
✅ הגבל ניתוחים ל-1 פעם ביום  
✅ שמור תוצאות AI במסד הנתונים  

---

## תכונות עתידיות | Roadmap

- [ ] תמיכה בחברות ישראליות (TASE)
- [ ] ניהול תיקים
- [ ] התראות אימייל
- [ ] ייצוא לPDF
- [ ] השוואות מתקדמות
- [ ] ניתוח טכני של מניות
- [ ] אפליקציית מובייל

---

## תרומה | Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## רישיון | License

MIT License - ראה קובץ LICENSE לפרטים

---

## תמיכה | Support

יש בעיה? פתח issue ב-GitHub או צור קשר:
- Email: support@example.com
- GitHub Issues: [Link]

---

**נבנה עם ❤️ באמצעות Claude AI**
