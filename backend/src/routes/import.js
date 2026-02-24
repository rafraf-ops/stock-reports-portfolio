import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { autoParseFile, detectSource } from '../services/import-parsers.js';
import { createTransaction, getAccounts } from '../services/finance-database.js';

const router = express.Router();

// Store file in memory (max 10 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xls', '.xlsx', '.txt', '.tsv'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported file type. Please upload CSV, XLS, XLSX or TXT.'));
  }
});

// ─── POST /api/import/preview ─────────────────────────────────────────────────
// Upload file → returns detected source + preview rows (no DB write)

router.post('/preview', requireAuth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const { buffer, originalname } = req.file;
    const forceSource = req.body.source || null;

    const result = autoParseFile(originalname, buffer, forceSource);

    if (result.source === 'generic') {
      // Return raw headers + rows for manual column mapping
      return res.json({
        success: true,
        source: 'generic',
        headers: result.headers,
        preview: result.rows.slice(0, 10),
        totalRows: result.rows.length,
        requiresMapping: true
      });
    }

    const txs = result.transactions || [];
    return res.json({
      success: true,
      source: result.source,
      preview: txs.slice(0, 10),
      totalRows: txs.length,
      requiresMapping: false,
      // Send all transactions encoded for the confirm step
      transactions: txs
    });
  } catch (err) {
    console.error('Import preview error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/import/commit ──────────────────────────────────────────────────
// Receive final (possibly mapped) transactions and write to DB

router.post('/commit', requireAuth, (req, res) => {
  try {
    const { transactions, account_id, defaultCategory } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0)
      return res.status(400).json({ success: false, error: 'No transactions provided' });

    const userId = req.user.id;
    const accId  = account_id ? parseInt(account_id) : null;

    let imported = 0;
    let skipped  = 0;

    for (const tx of transactions) {
      if (!tx.date || !tx.amount || tx.amount <= 0) { skipped++; continue; }

      // Auto-categorize based on description keywords
      const category = tx.category || autoCategory(tx.description) || defaultCategory || 'אחר';

      try {
        createTransaction(userId, {
          account_id: accId,
          type:        tx.type || 'expense',
          amount:      parseFloat(tx.amount),
          currency:    tx.currency || 'ILS',
          category,
          description: tx.description || '',
          date:        tx.date
        });
        imported++;
      } catch (e) {
        console.warn('Skip tx:', e.message, tx);
        skipped++;
      }
    }

    res.json({ success: true, imported, skipped });
  } catch (err) {
    console.error('Import commit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Auto-categorize by keywords ─────────────────────────────────────────────

const CATEGORY_RULES = [
  { keywords: ['סופרסל','שופרסל','מגה','רמי לוי','יינות ביתן','מחסני השוק','ויקטורי','פרשמרקט','freshmarket','super'], category: 'מזון' },
  { keywords: ['מסעדה','קפה','שוורמה','פיצה','סושי','burguer','burger','mcdonalds','kfc','coffee','cafe','בית קפה'], category: 'מסעדות' },
  { keywords: ['פז','דלק','סונול','צומת דלקן','ten','תן','fuel','פנגו','pango'], category: 'דלק' },
  { keywords: ['רכבת','אוטובוס','מונית','taxi','uber','gett','רב קו','מטרו','rav kav','אגד','דן','egged'], category: 'תחבורה' },
  { keywords: ['בית חולים','רפואה','רופא','קופת חולים','מכבי','מאוחדת','כללית','pharmacy','בית מרקחת','סופר פארם','superpharm','pharmacy'], category: 'בריאות' },
  { keywords: ['h&m','zara','mango','fox','כסית','ביגוד','הנעלה','נעליים','אופנה','fashion'], category: 'ביגוד' },
  { keywords: ['סינמה','קולנוע','נטפליקס','netflix','spotify','youtube','בידור','כרטיס','theater','cinema','hot','yes'], category: 'בידור' },
  { keywords: ['חשמל','חברת חשמל','iec','electricity'], category: 'חשמל' },
  { keywords: ['מים','עיריית','arnona','ארנונה','municipality'], category: 'מים' },
  { keywords: ['ביטוח','insurance','הפניקס','מגדל','הראל','כלל','מנורה'], category: 'ביטוח' },
  { keywords: ['שכירות','דמי שכירות','rent','house rent'], category: 'שכירות' },
  { keywords: ['משכנתה','mortgage','bank hapoalim','bank leumi','בנק הפועלים','בנק לאומי'], category: 'משכנתה' },
  { keywords: ['פלאפון','cellcom','partner','hot mobile','012','גולן טלקום','גלקסי','תקשורת','mobile','internet'], category: 'תקשורת' },
  { keywords: ['amazon','aliexpress','ebay','online','shop','store'], category: 'אחר' },
  { keywords: ['משכורת','salary','wage','payroll','עבודה'], category: 'משכורת' },
  { keywords: ['השקעה','תיק','portfolio','dividend','דיבידנד'], category: 'השקעות' },
];

function autoCategory(description) {
  if (!description) return null;
  const lower = String(description).toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(k => lower.includes(k.toLowerCase()))) {
      return rule.category;
    }
  }
  return null;
}

export default router;
