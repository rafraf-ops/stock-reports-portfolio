import db from './init-database.js';

// ── Init finance tables (idempotent) ─────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS finance_accounts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    type       TEXT    NOT NULL CHECK(type IN ('checking','savings','credit','cash','other')),
    currency   TEXT    NOT NULL DEFAULT 'ILS',
    balance    REAL    NOT NULL DEFAULT 0,
    color      TEXT             DEFAULT '#6366f1',
    created_at TEXT             DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS finance_transactions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    account_id   INTEGER,
    type         TEXT    NOT NULL CHECK(type IN ('income','expense','transfer')),
    amount       REAL    NOT NULL,
    currency     TEXT    NOT NULL DEFAULT 'ILS',
    category     TEXT    NOT NULL,
    sub_category TEXT,
    description  TEXT,
    date         TEXT    NOT NULL,
    recurring_id INTEGER,
    created_at   TEXT             DEFAULT (datetime('now')),
    FOREIGN KEY(user_id)    REFERENCES users(id),
    FOREIGN KEY(account_id) REFERENCES finance_accounts(id)
  );

  CREATE TABLE IF NOT EXISTS finance_budgets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    category   TEXT    NOT NULL,
    amount     REAL    NOT NULL,
    currency   TEXT    NOT NULL DEFAULT 'ILS',
    period     TEXT    NOT NULL DEFAULT 'monthly' CHECK(period IN ('monthly','yearly')),
    month      INTEGER,
    year       INTEGER,
    created_at TEXT             DEFAULT (datetime('now')),
    UNIQUE(user_id, category, period, month, year),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS finance_recurring (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    account_id  INTEGER,
    type        TEXT    NOT NULL CHECK(type IN ('income','expense')),
    amount      REAL    NOT NULL,
    currency    TEXT    NOT NULL DEFAULT 'ILS',
    category    TEXT    NOT NULL,
    description TEXT    NOT NULL,
    frequency   TEXT    NOT NULL CHECK(frequency IN ('daily','weekly','monthly','yearly')),
    next_date   TEXT    NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT             DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// ─── Accounts ─────────────────────────────────────────────────────────────────

export function getAccounts(userId) {
  return db.prepare('SELECT * FROM finance_accounts WHERE user_id = ? ORDER BY name').all(userId);
}

export function createAccount(userId, { name, type, currency = 'ILS', balance = 0, color = '#6366f1' }) {
  const info = db.prepare(
    'INSERT INTO finance_accounts (user_id, name, type, currency, balance, color) VALUES (?,?,?,?,?,?)'
  ).run(userId, name, type, currency, balance, color);
  return info.lastInsertRowid;
}

export function updateAccount(userId, id, fields) {
  const allowed = ['name', 'type', 'currency', 'balance', 'color'];
  const updates = Object.keys(fields).filter(k => allowed.includes(k));
  if (!updates.length) return;
  const sql = `UPDATE finance_accounts SET ${updates.map(k => `${k}=?`).join(',')} WHERE id=? AND user_id=?`;
  db.prepare(sql).run(...updates.map(k => fields[k]), id, userId);
}

export function deleteAccount(userId, id) {
  db.prepare('DELETE FROM finance_accounts WHERE id=? AND user_id=?').run(id, userId);
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function getTransactions(userId, { limit = 100, offset = 0, category, type, month, year, accountId } = {}) {
  let where = 'WHERE t.user_id = ?';
  const params = [userId];
  if (category)  { where += ' AND t.category = ?';    params.push(category); }
  if (type)      { where += ' AND t.type = ?';        params.push(type); }
  if (accountId) { where += ' AND t.account_id = ?';  params.push(accountId); }
  if (month && year) {
    where += ` AND strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?`;
    params.push(String(month).padStart(2, '0'), String(year));
  } else if (year) {
    where += ` AND strftime('%Y', t.date) = ?`;
    params.push(String(year));
  }
  params.push(limit, offset);
  return db.prepare(
    `SELECT t.*, a.name as account_name FROM finance_transactions t
     LEFT JOIN finance_accounts a ON t.account_id = a.id
     ${where} ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?`
  ).all(...params);
}

export function createTransaction(userId, { account_id, type, amount, currency = 'ILS', category, sub_category, description, date }) {
  const info = db.prepare(
    `INSERT INTO finance_transactions (user_id, account_id, type, amount, currency, category, sub_category, description, date)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(userId, account_id || null, type, amount, currency, category, sub_category || null, description || null, date);

  // Update account balance
  if (account_id) {
    const delta = type === 'income' ? amount : -amount;
    db.prepare('UPDATE finance_accounts SET balance = balance + ? WHERE id = ? AND user_id = ?').run(delta, account_id, userId);
  }
  return info.lastInsertRowid;
}

export function deleteTransaction(userId, id) {
  const tx = db.prepare('SELECT type, amount, account_id FROM finance_transactions WHERE id=? AND user_id=?').get(id, userId);
  if (tx?.account_id) {
    const delta = tx.type === 'income' ? -tx.amount : tx.amount;
    db.prepare('UPDATE finance_accounts SET balance = balance + ? WHERE id = ?').run(delta, tx.account_id);
  }
  db.prepare('DELETE FROM finance_transactions WHERE id=? AND user_id=?').run(id, userId);
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export function getBudgets(userId, { month, year } = {}) {
  let where = 'WHERE user_id = ?';
  const params = [userId];
  if (month !== undefined) { where += ' AND (month = ? OR month IS NULL)'; params.push(month); }
  if (year  !== undefined) { where += ' AND (year = ? OR year IS NULL)';   params.push(year); }
  return db.prepare(`SELECT * FROM finance_budgets ${where} ORDER BY category`).all(...params);
}

export function upsertBudget(userId, { category, amount, currency = 'ILS', period = 'monthly', month, year }) {
  db.prepare(
    `INSERT INTO finance_budgets (user_id, category, amount, currency, period, month, year)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(user_id, category, period, month, year) DO UPDATE SET amount=excluded.amount, currency=excluded.currency`
  ).run(userId, category, amount, currency, period, month ?? null, year ?? null);
}

export function deleteBudget(userId, id) {
  db.prepare('DELETE FROM finance_budgets WHERE id=? AND user_id=?').run(id, userId);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export function getMonthlySummary(userId, month, year) {
  const m = String(month).padStart(2, '0');
  const y = String(year);

  const income = db.prepare(
    `SELECT COALESCE(SUM(amount),0) as total FROM finance_transactions
     WHERE user_id=? AND type='income' AND strftime('%m',date)=? AND strftime('%Y',date)=?`
  ).get(userId, m, y).total;

  const expenses = db.prepare(
    `SELECT COALESCE(SUM(amount),0) as total FROM finance_transactions
     WHERE user_id=? AND type='expense' AND strftime('%m',date)=? AND strftime('%Y',date)=?`
  ).get(userId, m, y).total;

  const byCategory = db.prepare(
    `SELECT category, SUM(amount) as total FROM finance_transactions
     WHERE user_id=? AND type='expense' AND strftime('%m',date)=? AND strftime('%Y',date)=?
     GROUP BY category ORDER BY total DESC`
  ).all(userId, m, y);

  const byDay = db.prepare(
    `SELECT strftime('%d', date) as day,
     SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expenses,
     SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) as income
     FROM finance_transactions
     WHERE user_id=? AND strftime('%m',date)=? AND strftime('%Y',date)=?
     GROUP BY day ORDER BY day`
  ).all(userId, m, y);

  return { income, expenses, savings: income - expenses, byCategory, byDay };
}

export function getYearlySummary(userId, year) {
  const y = String(year);
  return db.prepare(
    `SELECT CAST(strftime('%m', date) AS INTEGER) as month,
     SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) as income,
     SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expenses
     FROM finance_transactions
     WHERE user_id=? AND strftime('%Y',date)=?
     GROUP BY month ORDER BY month`
  ).all(userId, y).map(r => ({ ...r, savings: r.income - r.expenses }));
}

// ─── Recurring ────────────────────────────────────────────────────────────────

export function getRecurring(userId) {
  return db.prepare('SELECT * FROM finance_recurring WHERE user_id=? ORDER BY next_date').all(userId);
}

export function createRecurring(userId, { account_id, type, amount, currency = 'ILS', category, description, frequency, next_date }) {
  db.prepare(
    `INSERT INTO finance_recurring (user_id, account_id, type, amount, currency, category, description, frequency, next_date)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(userId, account_id || null, type, amount, currency, category, description, frequency, next_date);
}

export function deleteRecurring(userId, id) {
  db.prepare('DELETE FROM finance_recurring WHERE id=? AND user_id=?').run(id, userId);
}
