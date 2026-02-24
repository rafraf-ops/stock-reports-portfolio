import db from "./init-database.js";

// ─── Simple rule ──────────────────────────────────────────────────────────────
// TASE stock  → price in ₪, currency='ILS', average_cost in ₪, display ₪
// US stock    → price in $, currency='USD', average_cost in $,  display $
// No cross-currency conversion EVER.
// ─────────────────────────────────────────────────────────────────────────────

export const getPortfolio = (userId) => {
  if (!userId) throw new Error("User ID required");
  return db.prepare("SELECT * FROM portfolio_holdings WHERE user_id = ?").all(userId);
};

export const addTransaction = (transaction) => {
  const userId = transaction.userId;
  if (!userId) throw new Error("User ID required");

  const currency = transaction.currency || "USD";
  const price    = parseFloat(transaction.price);
  const quantity = parseFloat(transaction.quantity);

  db.prepare(`
    INSERT INTO transactions
      (user_id, symbol, type, quantity, price, currency, date, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    transaction.symbol.toUpperCase(),
    transaction.type,
    quantity,
    price,
    currency,
    transaction.date || new Date().toISOString().split('T')[0],
    transaction.notes || "",
    new Date().toISOString()
  );

  updatePortfolio({ userId, symbol: transaction.symbol.toUpperCase(), type: transaction.type, quantity, price, currency });

  return { ...transaction, symbol: transaction.symbol.toUpperCase(), currency };
};

export const getTransactions = (userId, symbol = null) => {
  if (!userId) throw new Error("User ID required");
  if (symbol) {
    return db.prepare(`SELECT * FROM transactions WHERE user_id = ? AND symbol = ? ORDER BY date DESC`).all(userId, symbol.toUpperCase());
  }
  return db.prepare(`SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC`).all(userId);
};

export const deleteTransaction = (transactionId, userId) => {
  if (!userId) throw new Error("User ID required");
  const tx = db.prepare(`SELECT * FROM transactions WHERE id = ? AND user_id = ?`).get(transactionId, userId);
  if (!tx) return false;
  db.prepare("DELETE FROM transactions WHERE id = ?").run(transactionId);
  recalculatePortfolio(userId, tx.symbol);
  return true;
};

function updatePortfolio({ userId, symbol, type, quantity, price, currency }) {
  const holding = db.prepare(`SELECT * FROM portfolio_holdings WHERE user_id = ? AND symbol = ?`).get(userId, symbol);

  if (!holding) {
    if (type === "buy") {
      db.prepare(`
        INSERT INTO portfolio_holdings (user_id, symbol, total_shares, average_cost, total_invested, currency)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, symbol, quantity, price, quantity * price, currency);
    }
    return;
  }

  if (type === "buy") {
    const newTotal  = holding.total_invested + quantity * price;
    const newShares = holding.total_shares   + quantity;
    db.prepare(`
      UPDATE portfolio_holdings
      SET total_shares = ?, average_cost = ?, total_invested = ?, currency = ?
      WHERE user_id = ? AND symbol = ?
    `).run(newShares, newTotal / newShares, newTotal, currency, userId, symbol);

  } else if (type === "sell") {
    const newShares = holding.total_shares   - quantity;
    const newTotal  = holding.total_invested - quantity * holding.average_cost;
    if (newShares <= 0) {
      db.prepare(`DELETE FROM portfolio_holdings WHERE user_id = ? AND symbol = ?`).run(userId, symbol);
    } else {
      db.prepare(`UPDATE portfolio_holdings SET total_shares = ?, total_invested = ? WHERE user_id = ? AND symbol = ?`)
        .run(newShares, newTotal, userId, symbol);
    }
  }
}

function recalculatePortfolio(userId, symbol) {
  db.prepare(`DELETE FROM portfolio_holdings WHERE user_id = ? AND symbol = ?`).run(userId, symbol);
  const txs = db.prepare(`SELECT * FROM transactions WHERE user_id = ? AND symbol = ? ORDER BY date ASC`).all(userId, symbol.toUpperCase());
  for (const tx of txs) {
    updatePortfolio({ userId, symbol: tx.symbol, type: tx.type, quantity: tx.quantity, price: tx.price, currency: tx.currency || 'USD' });
  }
}

export const getCashBalance = (userId) => {
  if (!userId) throw new Error("User ID required");
  const r = db.prepare(`SELECT SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END) as balance FROM cash_transactions WHERE user_id = ?`).get(userId);
  return r?.balance || 0;
};

export const addCashTransaction = (transaction) => {
  const userId = transaction.userId;
  if (!userId) throw new Error("User ID required");
  const result = db.prepare(`INSERT INTO cash_transactions (user_id, type, amount, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(userId, transaction.type, transaction.amount, transaction.date || new Date().toISOString().split('T')[0], transaction.notes || "", new Date().toISOString());
  return { id: result.lastInsertRowid, ...transaction };
};

export const getCashTransactions = (userId) => {
  if (!userId) throw new Error("User ID required");
  return db.prepare(`SELECT * FROM cash_transactions WHERE user_id = ? ORDER BY date DESC`).all(userId);
};

export const deleteCashTransaction = (transactionId, userId) => {
  if (!userId) throw new Error("User ID required");
  return db.prepare(`DELETE FROM cash_transactions WHERE id = ? AND user_id = ?`).run(transactionId, userId).changes > 0;
};

export const getPortfolioSummary = (userId) => {
  if (!userId) throw new Error("User ID required");
  const holdings = getPortfolio(userId);
  const cash     = getCashBalance(userId);
  return { holdings, totalPositions: holdings.length, totalShares: holdings.reduce((s,h) => s+h.total_shares, 0), cash };
};

export const calculateGrowthMetrics = () => null;
export const upsertCompany = () => {};

export default {
  getPortfolio, addTransaction, getTransactions, deleteTransaction,
  getPortfolioSummary, getCashBalance, addCashTransaction,
  getCashTransactions, deleteCashTransaction,
  calculateGrowthMetrics, upsertCompany
};
