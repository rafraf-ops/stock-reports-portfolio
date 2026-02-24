import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getAccounts, createAccount, updateAccount, deleteAccount,
  getTransactions, createTransaction, deleteTransaction,
  getBudgets, upsertBudget, deleteBudget,
  getMonthlySummary, getYearlySummary,
  getRecurring, createRecurring, deleteRecurring
} from '../services/finance-database.js';

const router = express.Router();

// ─── Accounts ────────────────────────────────────────────────────────────────

router.get('/accounts', requireAuth, (req, res) => {
  try {
    res.json({ success: true, data: getAccounts(req.user.id) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/accounts', requireAuth, (req, res) => {
  try {
    const { name, type, currency, balance, color } = req.body;
    if (!name || !type) return res.status(400).json({ success: false, error: 'name and type required' });
    const id = createAccount(req.user.id, { name, type, currency, balance, color });
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/accounts/:id', requireAuth, (req, res) => {
  try {
    updateAccount(req.user.id, parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/accounts/:id', requireAuth, (req, res) => {
  try {
    deleteAccount(req.user.id, parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

router.get('/transactions', requireAuth, (req, res) => {
  try {
    const { limit, offset, category, type, month, year, accountId } = req.query;
    const txs = getTransactions(req.user.id, {
      limit:     limit     ? parseInt(limit)     : 100,
      offset:    offset    ? parseInt(offset)    : 0,
      category,  type,
      month:     month     ? parseInt(month)     : undefined,
      year:      year      ? parseInt(year)      : undefined,
      accountId: accountId ? parseInt(accountId) : undefined
    });
    res.json({ success: true, data: txs });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/transactions', requireAuth, (req, res) => {
  try {
    const { account_id, type, amount, currency, category, sub_category, description, date } = req.body;
    if (!type || !amount || !category || !date)
      return res.status(400).json({ success: false, error: 'type, amount, category, date required' });
    const id = createTransaction(req.user.id, {
      account_id, type, amount: parseFloat(amount), currency, category, sub_category, description, date
    });
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/transactions/:id', requireAuth, (req, res) => {
  try {
    deleteTransaction(req.user.id, parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── Budgets ──────────────────────────────────────────────────────────────────

router.get('/budgets', requireAuth, (req, res) => {
  try {
    const { month, year } = req.query;
    res.json({ success: true, data: getBudgets(req.user.id, {
      month: month ? parseInt(month) : undefined,
      year:  year  ? parseInt(year)  : undefined
    })});
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/budgets', requireAuth, (req, res) => {
  try {
    const { category, amount, currency, period, month, year } = req.body;
    if (!category || !amount) return res.status(400).json({ success: false, error: 'category and amount required' });
    upsertBudget(req.user.id, { category, amount: parseFloat(amount), currency, period, month, year });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/budgets/:id', requireAuth, (req, res) => {
  try {
    deleteBudget(req.user.id, parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── Summary ──────────────────────────────────────────────────────────────────

router.get('/summary/monthly', requireAuth, (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year  = parseInt(req.query.year)  || now.getFullYear();
    res.json({ success: true, data: getMonthlySummary(req.user.id, month, year) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/summary/yearly', requireAuth, (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    res.json({ success: true, data: getYearlySummary(req.user.id, year) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── Recurring ────────────────────────────────────────────────────────────────

router.get('/recurring', requireAuth, (req, res) => {
  try {
    res.json({ success: true, data: getRecurring(req.user.id) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/recurring', requireAuth, (req, res) => {
  try {
    const { account_id, type, amount, currency, category, description, frequency, next_date } = req.body;
    if (!type || !amount || !category || !description || !frequency || !next_date)
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    createRecurring(req.user.id, { account_id, type, amount: parseFloat(amount), currency, category, description, frequency, next_date });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/recurring/:id', requireAuth, (req, res) => {
  try {
    deleteRecurring(req.user.id, parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

export default router;
