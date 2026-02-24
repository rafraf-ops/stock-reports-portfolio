import initSqlJs from 'sql.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../database.db');

let db;
let SQL;

async function initDB() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  
  try {
    const dbFile = fs.readFileSync(dbPath);
    db = new SQL.Database(dbFile);
  } catch {
    db = new SQL.Database();
  }
  
  return db;
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// Companies queries
export const getCompanies = async () => {
  if (!db) await initDB();
  const result = db.exec('SELECT * FROM companies ORDER BY symbol');
  if (!result.length) return [];
  return result[0].values.map(row => ({
    symbol: row[0],
    name: row[1],
    sector: row[2],
    industry: row[3],
    market_cap: row[4],
    country: row[5],
    last_updated: row[6]
  }));
};

export const getCompany = async (symbol) => {
  if (!db) await initDB();
  const result = db.exec('SELECT * FROM companies WHERE symbol = ?', [symbol.toUpperCase()]);
  if (!result.length || !result[0].values.length) return null;
  const row = result[0].values[0];
  return {
    symbol: row[0],
    name: row[1],
    sector: row[2],
    industry: row[3],
    market_cap: row[4],
    country: row[5],
    last_updated: row[6]
  };
};

// ... (rest of the functions - similar pattern)

export default { getCompanies, getCompany };