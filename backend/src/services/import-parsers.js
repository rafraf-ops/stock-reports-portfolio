/**
 * Israeli bank / credit card CSV & Excel import parsers.
 * Each parser returns an array of normalized transaction objects:
 * { date: 'YYYY-MM-DD', description: string, amount: number, type: 'income'|'expense', currency: 'ILS' }
 */

import { parse as csvParse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import iconv from 'iconv-lite';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseIsraeliDate(str) {
  if (!str) return null;
  const s = String(str).trim().replace(/\s+/g, '');
  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

function parseAmount(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).replace(/,/g, '').replace(/[₪$€]/g, '').trim();
  if (s === '' || s === '-') return null;
  return parseFloat(s);
}

function decodeBuffer(buf) {
  // Try UTF-8 first, fall back to Windows-1255 (Hebrew legacy encoding)
  try {
    const utf8 = buf.toString('utf8');
    // If we see replacement chars it's not UTF-8
    if (!utf8.includes('\uFFFD')) return utf8;
  } catch (_) {}
  try { return iconv.decode(buf, 'win1255'); } catch (_) {}
  return buf.toString('latin1');
}

function xlsxToRows(buf) {
  const wb = XLSX.read(buf, { type: 'buffer', codepage: 1255 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

function normalize(rows) {
  // Remove completely empty rows
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

// ─── Auto-detect source ───────────────────────────────────────────────────────

export function detectSource(filename, buf) {
  const name = filename.toLowerCase();
  const text = buf.slice(0, 2000).toString('utf8').toLowerCase() +
               iconv.decode(buf.slice(0, 2000), 'win1255').toLowerCase();

  if (name.includes('max') || name.includes('leumicard') || text.includes('מקס') || text.includes('לאומי קארד')) return 'max';
  if (name.includes('cal') || name.includes('כאל') || text.includes('כא"ל') || text.includes('ויזה כאל')) return 'cal';
  if (name.includes('isracard') || name.includes('ישראכארט') || text.includes('ישראכארט') || text.includes('isracard')) return 'isracard';
  if (name.includes('amex') || text.includes('אמריקן אקספרס')) return 'isracard';
  if (name.includes('hapoalim') || name.includes('פועלים') || text.includes('בנק הפועלים')) return 'hapoalim';
  if (name.includes('leumi') || name.includes('לאומי') || text.includes('בנק לאומי')) return 'leumi';
  if (name.includes('discount') || name.includes('דיסקונט') || text.includes('בנק דיסקונט')) return 'discount';
  if (name.includes('paypal') || text.includes('paypal')) return 'paypal';
  if (name.includes('wise') || text.includes('wise')) return 'wise';
  return 'generic';
}

// ─── MAX (מקס / לאומי קארד) ──────────────────────────────────────────────────
// XLS export: columns are תאריך, שם בית עסק, קטגוריה, סכום עסקה, מטבע
// Charges are positive, credits are negative

export function parseMax(buf) {
  const rows = normalize(xlsxToRows(buf));
  const transactions = [];

  // Find header row
  let headerIdx = rows.findIndex(r =>
    r.some(c => String(c).includes('תאריך')) &&
    r.some(c => String(c).includes('סכום') || String(c).includes('עסקה'))
  );
  if (headerIdx === -1) headerIdx = 0;

  const headers = rows[headerIdx].map(h => String(h).trim());
  const dateCol = headers.findIndex(h => h.includes('תאריך'));
  const descCol = headers.findIndex(h => h.includes('שם') || h.includes('תיאור') || h.includes('עסק'));
  const amtCol  = headers.findIndex(h => h.includes('סכום'));
  const curCol  = headers.findIndex(h => h.includes('מטבע'));

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const date = parseIsraeliDate(row[dateCol >= 0 ? dateCol : 0]);
    const desc = String(row[descCol >= 0 ? descCol : 1] || '').trim();
    const rawAmt = parseAmount(row[amtCol >= 0 ? amtCol : 3]);
    const currency = curCol >= 0 ? (String(row[curCol]).trim() || 'ILS') : 'ILS';

    if (!date || rawAmt === null) continue;
    const amount = Math.abs(rawAmt);
    const type = rawAmt < 0 ? 'income' : 'expense'; // credits are negative in Max
    transactions.push({ date, description: desc, amount, type, currency: currency === 'ILS' || currency === '₪' ? 'ILS' : currency });
  }
  return transactions;
}

// ─── CAL (כאל ויזה) ──────────────────────────────────────────────────────────
// XLS export: תאריך עסקה, שם בית עסק, סכום עסקה, סכום חיוב

export function parseCal(buf) {
  const rows = normalize(xlsxToRows(buf));
  const transactions = [];

  let headerIdx = rows.findIndex(r =>
    r.some(c => String(c).includes('תאריך')) &&
    r.some(c => String(c).includes('סכום'))
  );
  if (headerIdx === -1) headerIdx = 0;

  const headers = rows[headerIdx].map(h => String(h).trim());
  const dateCol = headers.findIndex(h => h.includes('תאריך'));
  const descCol = headers.findIndex(h => h.includes('שם') || h.includes('עסק') || h.includes('תיאור'));
  const amtCol  = headers.findIndex(h => h.includes('חיוב') || h.includes('סכום'));

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const date = parseIsraeliDate(row[dateCol >= 0 ? dateCol : 0]);
    const desc = String(row[descCol >= 0 ? descCol : 1] || '').trim();
    const rawAmt = parseAmount(row[amtCol >= 0 ? amtCol : 2]);

    if (!date || rawAmt === null) continue;
    const amount = Math.abs(rawAmt);
    const type = rawAmt < 0 ? 'income' : 'expense';
    transactions.push({ date, description: desc, amount, type, currency: 'ILS' });
  }
  return transactions;
}

// ─── ISRACARD / AMEX ─────────────────────────────────────────────────────────
// TXT/XLS: תאריך עסקה, שם בית עסק, סכום עסקה
// Also handles the "international transactions" section with USD amounts

export function parseIsracard(buf) {
  // Try Excel first
  try {
    const rows = normalize(xlsxToRows(buf));
    return parseIsracardRows(rows);
  } catch (_) {}

  // Fall back to text format
  const text = decodeBuffer(buf);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows = lines.map(l => l.split('\t').map(c => c.trim()));
  return parseIsracardRows(rows);
}

function parseIsracardRows(rows) {
  const transactions = [];
  let currency = 'ILS';

  let headerIdx = rows.findIndex(r =>
    r.some(c => String(c).includes('תאריך')) &&
    r.some(c => String(c).includes('סכום') || String(c).includes('עסקה'))
  );
  if (headerIdx === -1) headerIdx = 0;

  const headers = rows[headerIdx].map(h => String(h).trim());
  const dateCol = headers.findIndex(h => h.includes('תאריך'));
  const descCol = headers.findIndex(h => h.includes('שם') || h.includes('עסק') || h.includes('תיאור'));
  const amtCol  = headers.findIndex(h => h.includes('סכום'));

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const rowText = row.join(' ');

    // Detect section header for international transactions
    if (rowText.includes('חו"ל') || rowText.includes('דולר') || rowText.includes('USD')) {
      currency = 'USD';
    } else if (rowText.includes('שקל') || rowText.includes('מקומי') || rowText.includes('ILS')) {
      currency = 'ILS';
    }

    const date = parseIsraeliDate(row[dateCol >= 0 ? dateCol : 0]);
    const desc = String(row[descCol >= 0 ? descCol : 1] || '').trim();
    const rawAmt = parseAmount(row[amtCol >= 0 ? amtCol : 2]);

    if (!date || rawAmt === null) continue;
    const amount = Math.abs(rawAmt);
    const type = rawAmt < 0 ? 'income' : 'expense';
    transactions.push({ date, description: desc, amount, type, currency });
  }
  return transactions;
}

// ─── BANK HAPOALIM (פועלים) ───────────────────────────────────────────────────
// XLS/CSV: תאריך, תיאור, אסמכתא, הוצאה, הכנסה, יתרה
// Separate debit (הוצאה) and credit (הכנסה) columns

export function parseHapoalim(buf) {
  const rows = normalize(xlsxToRows(buf));
  const transactions = [];

  let headerIdx = rows.findIndex(r =>
    r.some(c => String(c).includes('תאריך')) &&
    (r.some(c => String(c).includes('הוצאה')) || r.some(c => String(c).includes('חובה')))
  );
  if (headerIdx === -1) headerIdx = 0;

  const headers = rows[headerIdx].map(h => String(h).trim());
  const dateCol    = headers.findIndex(h => h.includes('תאריך') || h.includes('ערך'));
  const descCol    = headers.findIndex(h => h.includes('תיאור') || h.includes('פעולה'));
  const debitCol   = headers.findIndex(h => h.includes('הוצאה') || h.includes('חובה') || h.includes('זכות') && h.includes('שלילי'));
  const creditCol  = headers.findIndex(h => h.includes('הכנסה') || h.includes('זכות') || h.includes('הפקדה'));

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const date = parseIsraeliDate(row[dateCol >= 0 ? dateCol : 0]);
    const desc = String(row[descCol >= 0 ? descCol : 1] || '').trim();
    const debit  = parseAmount(debitCol  >= 0 ? row[debitCol]  : null);
    const credit = parseAmount(creditCol >= 0 ? row[creditCol] : null);

    if (!date) continue;
    if (debit  && debit  > 0) transactions.push({ date, description: desc, amount: debit,  type: 'expense', currency: 'ILS' });
    if (credit && credit > 0) transactions.push({ date, description: desc, amount: credit, type: 'income',  currency: 'ILS' });
  }
  return transactions;
}

// ─── LEUMI / DISCOUNT (generic Israeli bank) ─────────────────────────────────
// Similar to Hapoalim — separate debit/credit columns

export function parseGenericIsraeliBank(buf) {
  return parseHapoalim(buf); // same structure
}

// ─── PAYPAL ───────────────────────────────────────────────────────────────────
// CSV: Date, Name, Type, Status, Currency, Gross, Fee, Net, ...

export function parsePaypal(buf) {
  const text = decodeBuffer(buf);
  const rows = csvParse(text, { skip_empty_lines: true, trim: true });
  if (!rows.length) return [];

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dateCol   = headers.findIndex(h => h === 'date');
  const nameCol   = headers.findIndex(h => h === 'name');
  const typeCol   = headers.findIndex(h => h === 'type');
  const statusCol = headers.findIndex(h => h === 'status');
  const currCol   = headers.findIndex(h => h === 'currency');
  const netCol    = headers.findIndex(h => h === 'net');
  const grossCol  = headers.findIndex(h => h === 'gross');

  const transactions = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (statusCol >= 0 && String(row[statusCol]).toLowerCase() !== 'completed') continue;

    // Parse MM/DD/YYYY PayPal date
    const rawDate = String(row[dateCol] || '').trim();
    let date = null;
    const m = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) date = `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    if (!date) continue;

    const desc = String(row[nameCol >= 0 ? nameCol : 1] || row[typeCol >= 0 ? typeCol : 2] || '').trim();
    const rawAmt = parseAmount(row[netCol >= 0 ? netCol : grossCol >= 0 ? grossCol : 5]);
    const currency = String(row[currCol >= 0 ? currCol : 4] || 'USD').trim().toUpperCase();

    if (rawAmt === null) continue;
    const amount = Math.abs(rawAmt);
    const type = rawAmt < 0 ? 'expense' : 'income';
    transactions.push({ date, description: desc, amount, type, currency });
  }
  return transactions;
}

// ─── WISE ────────────────────────────────────────────────────────────────────
// CSV: TransferWise ID, Date, Amount, Currency, Description, Payment Reference, Running Balance, Exchange From, Exchange To, Exchange Rate, Payer Name, Payee Name, Payee Account Number, Merchant, Card Last Four Digits, Card Holder Full Name, Attachment, Note, Total fees (USD)

export function parseWise(buf) {
  const text = decodeBuffer(buf);
  const rows = csvParse(text, { skip_empty_lines: true, trim: true });
  if (!rows.length) return [];

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dateCol = headers.findIndex(h => h === 'date' || h === 'created on');
  const amtCol  = headers.findIndex(h => h === 'amount');
  const currCol = headers.findIndex(h => h === 'currency');
  const descCol = headers.findIndex(h => h.includes('description') || h.includes('merchant') || h.includes('payee'));

  const transactions = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Wise date: YYYY-MM-DD HH:MM:SS
    const rawDate = String(row[dateCol >= 0 ? dateCol : 1] || '').trim();
    const date = rawDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const rawAmt = parseAmount(row[amtCol >= 0 ? amtCol : 2]);
    const currency = String(row[currCol >= 0 ? currCol : 3] || 'USD').trim().toUpperCase();
    const desc = String(row[descCol >= 0 ? descCol : headers.findIndex(h => h.includes('payee'))] || '').trim();

    if (rawAmt === null) continue;
    const amount = Math.abs(rawAmt);
    const type = rawAmt < 0 ? 'expense' : 'income';
    transactions.push({ date, description: desc, amount, type, currency });
  }
  return transactions;
}

// ─── GENERIC CSV (column mapping mode) ───────────────────────────────────────
// Returns raw rows + headers for the frontend to map

export function parseGenericCsv(buf) {
  const text = decodeBuffer(buf);

  // Try comma, then semicolon, then tab
  for (const delimiter of [',', ';', '\t']) {
    try {
      const rows = csvParse(text, { delimiter, skip_empty_lines: true, trim: true });
      if (rows.length >= 2 && rows[0].length >= 2) {
        return { headers: rows[0], rows: rows.slice(1) };
      }
    } catch (_) {}
  }
  return { headers: [], rows: [] };
}

// ─── Auto-detect + parse ──────────────────────────────────────────────────────

export function autoParseFile(filename, buf, source) {
  const src = source || detectSource(filename, buf);
  switch (src) {
    case 'max':       return { source: 'max',       transactions: parseMax(buf) };
    case 'cal':       return { source: 'cal',       transactions: parseCal(buf) };
    case 'isracard':  return { source: 'isracard',  transactions: parseIsracard(buf) };
    case 'hapoalim':  return { source: 'hapoalim',  transactions: parseHapoalim(buf) };
    case 'leumi':
    case 'discount':  return { source: src,         transactions: parseGenericIsraeliBank(buf) };
    case 'paypal':    return { source: 'paypal',    transactions: parsePaypal(buf) };
    case 'wise':      return { source: 'wise',      transactions: parseWise(buf) };
    default: {
      const { headers, rows } = parseGenericCsv(buf);
      return { source: 'generic', headers, rows, transactions: null };
    }
  }
}
