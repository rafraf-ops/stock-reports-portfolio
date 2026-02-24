# מדריך התחלה מהירה | Quick Start Guide

## התקנה מהירה ב-3 שלבים

### שלב 1: הורד והתקן

```bash
# אם קיבלת את הקוד כארכיון ZIP, חלץ אותו
# אחרת, אם זה ב-Git:
git clone <repository-url>
cd financial-analyzer
```

### שלב 2: הפעל את סקריפט ההתקנה

```bash
chmod +x setup.sh
./setup.sh
```

הסקריפט יבצע:
- ✅ בדיקת Node.js
- ✅ התקנת כל התלויות
- ✅ יצירת קובץ .env
- ✅ אתחול מסד הנתונים

### שלב 3: הגדר את מפתח ה-API

ערוך את הקובץ `backend/.env`:

```bash
nano backend/.env
# או
code backend/.env
```

הוסף את המפתח שלך:
```
CLAUDE_API_KEY=sk-ant-xxxxx  # החלף עם המפתח שלך
```

קבל מפתח חינם מכאן: https://console.anthropic.com/

---

## הפעלת המערכת

פתח **2 טרמינלים**:

### טרמינל 1 - Backend
```bash
cd backend
npm run dev
```

תראה:
```
╔═══════════════════════════════════════════╗
║   Financial Analyzer API Server          ║
║   Running on http://localhost:3000       ║
╚═══════════════════════════════════════════╝
```

### טרמינל 2 - Frontend
```bash
cd frontend
npm run dev
```

תראה:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## שימוש ראשון

1. **פתח דפדפן** ב-`http://localhost:5173`

2. **חפש חברה** - נסה אחת מאלה:
   - NVDA (Nvidia)
   - AAPL (Apple)
   - MSFT (Microsoft)
   - GOOGL (Google)
   - TSLA (Tesla)

3. **לחץ על החברה** לצפייה בניתוח מפורט

4. **המתן לניתוח AI** - בפעם הראשונה ייקח 5-10 שניות

---

## בעיות נפוצות?

### "Cannot find module"
```bash
# התקן תלויות מחדש
cd backend && npm install
cd ../frontend && npm install
```

### "Claude API key missing"
ודא ש:
1. יצרת קובץ `.env` בתיקיית `backend/`
2. הוספת `CLAUDE_API_KEY=sk-ant-...`
3. שמרת את הקובץ
4. הפעלת מחדש את הBackend

### "Company not found"
לא כל החברות זמינות. נסה:
- חברות אמריקאיות גדולות
- השתמש בסימול (NVDA) ולא בשם

### Backend לא עובד
```bash
# בדוק שNode.js מעל גרסה 20
node -v

# בדוק שהפורט פנוי
lsof -i :3000
```

---

## בדיקה מהירה

אחרי שהכל רץ, בדוק ב-Terminal:

```bash
# בדוק שה-Backend עובד
curl http://localhost:3000/

# צפוי לקבל:
{"status":"ok","message":"Financial Analyzer API",...}

# בדוק שיש חברות
curl http://localhost:3000/api/companies

# צפוי לקבל רשימת חברות
```

---

## עזרה נוספת?

📖 קרא את [README.md](README.md) המלא  
📐 קרא את [ARCHITECTURE.md](ARCHITECTURE.md) לפרטים טכניים  
🐛 בעיות? פתח issue ב-GitHub

---

**מוכן לשימוש! בהצלחה! 🚀**
