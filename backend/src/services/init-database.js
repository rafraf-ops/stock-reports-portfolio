import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const dbPath = join(__dirname, '../../database.db');
const db     = new Database(dbPath);

db.pragma('foreign_keys = ON');

console.log('📊 Creating database tables...');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    google_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sector TEXT,
    market_cap REAL,
    last_updated TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    revenue REAL,
    net_income REAL,
    gross_profit REAL,
    operating_income REAL,
    total_assets REAL,
    total_liabilities REAL,
    shareholders_equity REAL,
    cash_flow_operating REAL,
    eps REAL,
    filing_date TEXT,
    fiscal_year INTEGER,
    fiscal_quarter TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    total_shares REAL NOT NULL,
    average_cost REAL NOT NULL,
    total_invested REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, symbol)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS cash_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS symbol_cache (
    symbol      TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    exchange    TEXT NOT NULL DEFAULT 'TLV',
    keywords    TEXT NOT NULL DEFAULT '',
    is_tase     INTEGER NOT NULL DEFAULT 0,
    currency    TEXT NOT NULL DEFAULT 'USD',
    source      TEXT NOT NULL DEFAULT 'static',
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('✅ Database tables created');

// ── Migrations (idempotent) ───────────────────────────────────────────────────
try { db.exec(`ALTER TABLE transactions       ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'`); } catch (_) {}
try { db.exec(`ALTER TABLE portfolio_holdings ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'`); } catch (_) {}

// Legacy columns – keep so old rows don't break, but we no longer write them
try { db.exec(`ALTER TABLE transactions ADD COLUMN price_usd REAL`);        } catch (_) {}
try { db.exec(`ALTER TABLE transactions ADD COLUMN exchange_rate REAL`);    } catch (_) {}

// ── Rebuild any holding whose currency column is blank/wrong ─────────────────
// This ensures existing USD holdings get 'USD' stamped correctly.
try {
  db.exec(`UPDATE portfolio_holdings SET currency = 'USD' WHERE currency IS NULL OR currency = ''`);
  db.exec(`UPDATE portfolio_holdings SET currency = 'ILS' WHERE symbol IN (
    SELECT DISTINCT symbol FROM transactions WHERE currency = 'ILS'
  ) AND (currency IS NULL OR currency = '' OR currency = 'USD')`);

  // Rebuild ILS holdings so average_cost is in ₪ (price as entered), not converted
  const ilsHoldings = db.prepare(`SELECT DISTINCT user_id, symbol FROM transactions WHERE currency = 'ILS'`).all();
  for (const { user_id, symbol } of ilsHoldings) {
    db.prepare(`DELETE FROM portfolio_holdings WHERE user_id = ? AND symbol = ?`).run(user_id, symbol);
    const txs = db.prepare(`SELECT * FROM transactions WHERE user_id = ? AND symbol = ? ORDER BY date ASC`).all(user_id, symbol);
    let shares = 0, invested = 0;
    for (const tx of txs) {
      const p = tx.price; // always in ₪ for ILS transactions
      if (tx.type === 'buy') {
        invested += tx.quantity * p;
        shares   += tx.quantity;
      } else if (tx.type === 'sell') {
        const avg = shares > 0 ? invested / shares : p;
        invested -= tx.quantity * avg;
        shares   -= tx.quantity;
      }
    }
    if (shares > 0) {
      db.prepare(`
        INSERT INTO portfolio_holdings (user_id, symbol, total_shares, average_cost, total_invested, currency)
        VALUES (?, ?, ?, ?, ?, 'ILS')
        ON CONFLICT(user_id, symbol) DO UPDATE SET
          total_shares   = excluded.total_shares,
          average_cost   = excluded.average_cost,
          total_invested = excluded.total_invested,
          currency       = 'ILS'
      `).run(user_id, symbol, shares, invested / shares, invested);
    }
  }
  if (ilsHoldings.length > 0) console.log(`✅ Rebuilt ${ilsHoldings.length} ILS holding(s) in ₪`);
} catch (e) {
  console.warn('Migration warning:', e.message);
}

// ── Seed symbol_cache with full TASE list (INSERT OR REPLACE = always up-to-date) ──
const SEED_TASE = [
  // ── Stocks / Equities ──────────────────────────────────────────────────────
  ['ACKR.TA',   'Ackerstein Group',         'TLV', 'אקרשטיין,ackerstein,building materials'],
  ['AFRE.TA',   'Africa Israel Residences', 'TLV', 'אפריקה ישראל,africa israel,residential'],
  ['ALHE.TA',   'Alony Hetz',               'TLV', 'אלוני חץ,alony hetz,real estate'],
  ['ALRPR.TA',  'Alrov Properties',         'TLV', 'אלרוב נכסים,alrov,properties'],
  ['ALTF.TA',   'Altshuler Shaham Finance', 'TLV', 'אלטשולר שחם,altshuler,finance,investments'],
  ['AMOT.TA',   'Amot Investments',         'TLV', 'אמות,amot,real estate,investments'],
  ['AMRK.TA',   'Amir Marketing',           'TLV', 'אמיר שיווק,amir marketing,consumer goods'],
  ['ARDAN.TA',  'Aran Research',            'TLV', 'ארן,aran,defense,aerospace'],
  ['ARPT.TA',   'Airport City',             'TLV', 'עיר התעופה,airport city,real estate'],
  ['AUDC.TA',   'AudioCodes',               'TLV', 'אודיוקודס,audiocodes,technology,voip,telecom'],
  ['AYAL.TA',   'Ayalon Insurance',         'TLV', 'איילון,ayalon,insurance,ביטוח'],
  ['AZRG.TA',   'Azrieli Group',            'TLV', 'עזריאלי,azrieli,real estate,mall'],
  ['BEZQ.TA',   'Bezeq Israel Telecom',     'TLV', 'בזק,bezeq,telecom,תקשורת'],
  ['BIG.TA',    'Big Shopping Centers',     'TLV', 'ביג,big,shopping center,mall,retail'],
  ['BIGA.TA',   'Big Shopping Centers',     'TLV', 'ביג,big,big shopping,mall'],
  ['BWAY.TA',   'Brainsway',                'TLV', 'ברייןסוויי,brainsway,medical,health'],
  ['CAMT.TA',   'Camtek',                   'TLV', 'קמטק,camtek,semiconductor,technology'],
  ['CANF.TA',   'Can-Fite BioPharma',       'TLV', 'קן פייט,can-fite,biopharma,pharma'],
  ['CEL.TA',    'Cellcom Israel',           'TLV', 'סלקום,cellcom,mobile,telecom'],
  ['CEVA.TA',   'CEVA Inc',                'TLV', 'סבה,ceva,semiconductor,technology'],
  ['CGEN.TA',   'Compugen',                'TLV', 'קומפיוגן,compugen,biotech,technology'],
  ['CHKP.TA',   'Check Point Software',    'TLV', 'צק פוינט,check point,checkpoint,cybersecurity,software'],
  ['CLIS.TA',   'Clal Insurance',          'TLV', 'כלל,clal,insurance,ביטוח'],
  ['DAON.TA',   'Dor Alon Energy',         'TLV', 'דור אלון,dor alon,energy,fuel'],
  ['DELG.TA',   'Delta Galil',             'TLV', 'דלתא גליל,delta galil,textiles,apparel'],
  ['DIPL.TA',   'Diplomat Holdings',       'TLV', 'דיפלומט,diplomat,consumer goods,FMCG'],
  ['DISI.TA',   'Discount Investment Corp','TLV', 'דסקש,discount investment,holding'],
  ['DLEKG.TA',  'Delek Group',             'TLV', 'דלק,delek,energy,oil,gas'],
  ['DRAL.TA',   'Dor Alon Energy',         'TLV', 'דור אלון,dor alon,energy,fuel,gas station'],
  ['DSCT.TA',   'Israel Discount Bank',    'TLV', 'דיסקונט,discount,bank,בנק'],
  ['ELAL.TA',   'El Al Israel Airlines',   'TLV', 'אל על,el al,airline,aviation'],
  ['ELCO.TA',   'Elco Holdings',           'TLV', 'אלקו,elco,holdings,technology'],
  ['ELRN.TA',   'Elron Ventures',          'TLV', 'אלרון,elron,ventures,technology'],
  ['EMIT.TA',   'EMIT Technologies',       'TLV', 'אמיט,emit,technology,defense'],
  ['EMITF.TA',  'Elbit Imaging',           'TLV', 'אלביט הדמיה,elbit imaging,real estate,medical'],
  ['EMTC-M.TA', 'Elbit Medical Technologies','TLV','אלביט מדיקל,elbit medical,medical,health'],
  ['ESLT.TA',   'Elbit Systems',           'TLV', 'אלביט,elbit,defense,systems,aerospace'],
  ['FIBI.TA',   'First International Bank','TLV', 'בינלאומי,first international,bank,fibi'],
  ['FORTY.TA',  'Formula Systems',         'TLV', 'פורמולה,formula systems,technology,IT'],
  ['FOX.TA',    'Fox-Wizel',               'TLV', 'פוקס,fox,fashion,retail,clothing'],
  ['GILT.TA',   'Gilat Satellite Networks','TLV', 'גילת,gilat,satellite,telecom,broadband'],
  ['GLTL.TA',   'Gilat Telecom',           'TLV', 'גילת טלקום,gilat telecom,telecom'],
  ['GZT.TA',    'Gazit Globe',             'TLV', 'גזית גלוב,gazit,real estate,shopping'],
  ['GVYM.TA',   'Gav-Yam Lands',           'TLV', 'גב ים,gav yam,gavyam,real estate,industrial'],
  ['HAMAT.TA',  'Hamat Group',             'TLV', 'המת,hamat,plumbing,sanitary'],
  ['HARL.TA',   'Harel Insurance',         'TLV', 'הראל,harel,insurance,ביטוח'],
  ['HOT.TA',    'HOT Mobile',              'TLV', 'הוט,hot,cable,telecom,mobile'],
  ['ICL.TA',    'ICL Group',               'TLV', 'כיל,icl,chemicals,minerals,potash,כימיקלים'],
  ['IILG.TA',   'Israel Opportunity Fund', 'TLV', 'ישראל,israel opportunity,fund'],
  ['ILCO.TA',   'The Israel Corp',         'TLV', 'תאגיד ישראל,israel corp,holding,chemicals'],
  ['ISTA.TA',   'Issta Lines',             'TLV', 'ישטא,issta,travel,tourism'],
  ['KMDA.TA',   'Kamada',                  'TLV', 'קמדה,kamada,pharma,biologics'],
  ['LAHAV.TA',  'Lahav LR Real Estate',    'TLV', 'להב,lahav,real estate,להב אל'],
  ['LUMI.TA',   'Bank Leumi',              'TLV', 'לאומי,leumi,bank,בנק'],
  ['MGDL.TA',   'Migdal Insurance',        'TLV', 'מגדל,migdal,insurance,ביטוח'],
  ['MLSR.TA',   'Melisron',               'TLV', 'מליסרון,melisron,real estate,mall,shopping'],
  ['MLTH.TA',   'Malam-Team Holdings',     'TLV', 'מלם תים,malam team,technology,IT'],
  ['MLTM.TA',   'Malam Team',             'TLV', 'מלם תים,malam team,technology,IT services'],
  ['MMHD.TA',   'Menora Mivtachim',        'TLV', 'מנורה מבטחים,menora,mivtachim,insurance,ביטוח'],
  ['MNIN.TA',   'Mendelson Infrastructure','TLV', 'מנדלסון,mendelson,infrastructure,engineering'],
  ['MRIN.TA',   'More Investments',        'TLV', 'מור,more,investment,fund'],
  ['MSBI.TA',   'HaMashbir 365',           'TLV', 'המשביר,hamashbir,retail,consumer'],
  ['MTAV.TA',   'Meitav Investment House', 'TLV', 'מיטב,meitav,investment,finance,בית השקעות'],
  ['MVNE.TA',   'Mivne Real Estate',       'TLV', 'מבנה,mivne,real estate,industrial'],
  ['MZTF.TA',   'Mizrahi Tefahot Bank',    'TLV', 'מזרחי טפחות,mizrahi,tefahot,bank,בנק'],
  ['NFTA.TA',   'Naphtha Israel',          'TLV', 'נפטא,naphtha,petroleum,oil'],
  ['NICE.TA',   'NICE Systems',            'TLV', 'נייס,nice,nice systems,CX,analytics,software'],
  ['NVMI.TA',   'Nova Ltd',               'TLV', 'נובה,nova,semiconductor,metrology,technology'],
  ['ORA.TA',    'Ormat Technologies',      'TLV', 'אורמת,ormat,energy,geothermal,renewable'],
  ['ORL.TA',    'Oil Refineries',          'TLV', 'בזן,oil refineries,bazan,petrochemicals'],
  ['ORMP.TA',   'Oramed Pharma',           'TLV', 'אורמד,oramed,pharma,diabetes,insulin'],
  ['PAZ.TA',    'Paz Retail and Energy',   'TLV', 'פז,paz,oil,energy,fuel,gas station'],
  ['PERI.TA',   'Perion Network',          'TLV', 'פריון,perion,digital advertising,ad tech'],
  ['PHOE.TA',   'Phoenix Financial',       'TLV', 'פניקס,phoenix,insurance,finance,ביטוח'],
  ['PLSN.TA',   'Plasson Industries',      'TLV', 'פלסון,plasson,plastics,manufacturing'],
  ['POLI.TA',   'Bank Hapoalim',           'TLV', 'פועלים,הפועלים,hapoalim,bank,בנק,poalim'],
  ['PTNR.TA',   'Partner Communications',  'TLV', 'פרטנר,partner,mobile,telecom'],
  ['RDCM.TA',   'Radcom',                 'TLV', 'רדקום,radcom,network,monitoring,technology'],
  ['RLCO.TA',   'Rami Levy',              'TLV', 'רמי לוי,rami levy,supermarket,retail'],
  ['RLRE.TA',   'Rami Levy Shikma Real Estate','TLV','רמי לוי שקמה,rami levy real estate'],
  ['SAE.TA',    'Shufersal',              'TLV', 'שופרסל,shufersal,supermarket,retail,grocery'],
  ['SILC.TA',   'Silicom',               'TLV', 'סיליקום,silicom,networking,technology,server'],
  ['SMID.TA',   'Sievert Technologies',   'TLV', 'זיוורט,sievert,technology'],
  ['SPCE.TA',   'Supergas',              'TLV', 'סופרגז,supergas,gas,energy,LPG'],
  ['SRAC.TA',   'S.R. Accord Holdings',  'TLV', 'אקורד,אס אר,אס.אר,accord,sr accord,s.r. accord,srac'],
  ['STRS.TA',   'Strauss Group',          'TLV', 'שטראוס,strauss,food,consumer goods,dairy'],
  ['TASE.TA',   'Tel Aviv Stock Exchange','TLV', 'בורסה,tase,stock exchange,tlv'],
  ['TEVA.TA',   'Teva Pharmaceutical',    'TLV', 'טבע,תבע,teva,pharma,generic drugs'],
  ['TSEM.TA',   'Tower Semiconductor',    'TLV', 'טאואר,tower,tower semi,semiconductor,fab,foundry'],
  ['WLMT.TA',   'Bank of Jerusalem',      'TLV', 'ירושלים,jerusalem,bank,בנק,jerusalem bank'],
  ['ZIM.TA',    'ZIM Integrated Shipping','TLV', 'זים,zim,shipping,container,maritime'],
  ['ENLT.TA',   'Enlight Renewable Energy','TLV','אנלייט,enlight,energy,renewable,solar,wind,energy'],
  ['ALLT.TA',   'Allot Communications',    'TLV','אלוט,allot,network,cybersecurity,technology,telecom'],
  ['MGIC.TA',   'Magic Software Enterprises','TLV','מג\'יק,magic software,IT,technology,software'],
  ['KRNT.TA',   'Kornit Digital',          'TLV','קורניט,kornit,digital,printing,textile,technology'],
  ['ITRN.TA',   'Ituran Location and Control','TLV','איתוראן,ituran,telematics,tracking,fleet'],
  ['RDWR.TA',   'Radware',                 'TLV','רדוור,radware,cybersecurity,network,technology,DDoS'],
  ['CNVT.TA',   'Conduit / Sistema',       'TLV','קונדויט,conduit,technology,holdings'],
  ['SPEN.TA',   'Shapir Engineering',      'TLV','שפיר,shapir,engineering,construction,infrastructure'],
  ['DIMRI.TA',  'Y.H. Dimri Construction', 'TLV','דימרי,dimri,construction,real estate,residential'],
  ['SKBN.TA',   'Strauss Group',           'TLV','שטראוס,strauss,strauss group,food,FMCG,dairy'],
  ['ONE.TA',    'Bank Mizrahi-Tefahot',    'TLV','מזרחי,mizrahi,bank,one,בנק'],
  ['ISCN.TA',   'Israel Corp (Orl)',        'TLV','תאגיד,israel corporation,iscn,holding,chemicals,ICL'],
  ['MENA.TA',   'Menora Mivtachim Holdings','TLV','מנורה,מבטחים,menora,mivtachim,insurance,finance,ביטוח'],
  // ── Indices ────────────────────────────────────────────────────────────────
  ['TA35.TA',   'מדד תא-35',              'TLV', 'תא 35,ta35,ta-35,index,מדד,index tracker'],
  // ── ETFs / קרנות סל — Tachlit (תכלית / Meitav) ───────────────────────────
  ['TCH-F1.TA',   'תכלית סל תא-35',             'TLV', 'תכלית,תא 35,ta35,ta-35,tachlit,קרן סל,etf'],
  ['TCH-F2.TA',   'תכלית סל תא-125',            'TLV', 'תכלית,תא 125,ta125,ta-125,tachlit,קרן סל,etf'],
  ['TCH-F3.TA',   'תכלית סל בנק 5',             'TLV', 'תכלית,בנקים,bank 5,ta bank,tachlit,קרן סל,etf'],
  ['TCH-F4.TA',   'תכלית סל נאסדק 100',         'TLV', 'תכלית,נאסדק,nasdaq,nasdaq 100,tachlit,קרן סל,etf'],
  ['TCH-F9.TA',   'תכלית סל תא-90',             'TLV', 'תכלית,תא 90,ta90,ta-90,tachlit,קרן סל,etf'],
  ['TCH-F76.TA',  'תכלית סל SP 500',            'TLV', 'תכלית,sp500,s&p 500,snp 500,tachlit,קרן סל,etf'],
  ['TCH-F95.TA',  'תכלית סל אגח ממשלתי',        'TLV', 'תכלית,אגח,אגרות חוב,bonds,government bonds,tachlit,קרן סל,etf'],
  ['TCH-F118.TA', 'תכלית סל תא-פיננסים',        'TLV', 'תכלית,פיננסים,ta finance,tachlit,קרן סל,etf'],
  ['TCH-F172.TA', 'תכלית סל תא-ביטוח',          'TLV', 'תכלית,ביטוח,ta insurance,tachlit,tchf172,1197698,קרן סל,etf'],
  // ── ETFs / קרנות סל — Harel (הראל) ──────────────────────────────────────
  ['HRL-F3.TA',   'הראל קרן סל תא-35',          'TLV', 'הראל,harel,ta 35,קרן סל,etf'],
  ['HRL-F14.TA',  'הראל קרן סל',                'TLV', 'הראל,harel,קרן סל,etf'],
  ['HRL-F28.TA',  'הראל קרן סל',                'TLV', 'הראל,harel,קרן סל,etf'],
  ['HRL-F76.TA',  'הראל קרן סל SP',             'TLV', 'הראל,harel,sp500,s&p,קרן סל,etf'],
  ['HRL-FK42.TA', 'הראל קרן סל כשר',            'TLV', 'הראל,harel,כשר,kosher,קרן סל,etf'],
  ['HRL-F205.TA', 'הראל קרן סל',                'TLV', 'הראל,harel,קרן סל,etf'],
  // ── ETFs / קרנות סל — Migdal (מגדל) ─────────────────────────────────────
  ['MTF-F76.TA',  'מגדל קרן סל',                'TLV', 'מגדל,migdal,קרן סל,etf'],
  ['MTF-F93.TA',  'מגדל קרן סל',                'TLV', 'מגדל,migdal,קרן סל,etf'],
  ['MTF-F103.TA', 'מגדל קרן סל',                'TLV', 'מגדל,migdal,קרן סל,etf'],
  ['MTF-F109.TA', 'מגדל קרן סל',                'TLV', 'מגדל,migdal,קרן סל,etf'],
  ['MTF-F115.TA', 'מגדל קרן סל',                'TLV', 'מגדל,migdal,קרן סל,etf'],
  ['MTF-F120.TA', 'מגדל קרן סל',                'TLV', 'מגדל,migdal,קרן סל,etf'],
  ['MTF-F124.TA', 'מגדל קרן סל',                'TLV', 'מגדל,migdal,קרן סל,etf'],
  // ── ETFs / קרנות סל — KSM ────────────────────────────────────────────────
  ['KSM-F37.TA',  'KSM קרן סל',                 'TLV', 'ksm,קרן סל,etf'],
  ['KSM-F88.TA',  'KSM קרן סל אגח',             'TLV', 'ksm,bond,אגח,קרן סל,etf'],
  ['KSM-F106.TA', 'KSM קרן סל',                 'TLV', 'ksm,קרן סל,etf'],
  ['KSM-F109.TA', 'KSM קרן סל',                 'TLV', 'ksm,קרן סל,etf'],
  ['KSM-F119.TA', 'KSM קרן סל',                 'TLV', 'ksm,קרן סל,etf'],
  ['KSM-F135.TA', 'KSM קרן סל',                 'TLV', 'ksm,קרן סל,etf'],
  ['KSM-F150.TA', 'KSM קרן סל',                 'TLV', 'ksm,קרן סל,etf'],
  // ── ETFs / קרנות סל — IBI / Psagot (פסגות) ──────────────────────────────
  ['IBI-F16.TA',  'פסגות קרן סל',               'TLV', 'פסגות,psagot,ibi,קרן סל,etf'],
  ['IBI-F35.TA',  'פסגות קרן סל',               'TLV', 'פסגות,psagot,ibi,קרן סל,etf'],
  ['IBI-F106.TA', 'פסגות קרן סל',               'TLV', 'פסגות,psagot,ibi,קרן סל,etf'],
  ['IBI-F112.TA', 'פסגות קרן סל',               'TLV', 'פסגות,psagot,ibi,קרן סל,etf'],
  ['IBI-F126.TA', 'פסגות קרן סל',               'TLV', 'פסגות,psagot,ibi,קרן סל,etf'],
  ['IBI-F177.TA', 'פסגות קרן סל',               'TLV', 'פסגות,psagot,ibi,קרן סל,etf'],
  ['IBI-F178.TA', 'פסגות קרן סל',               'TLV', 'פסגות,psagot,ibi,קרן סל,etf'],
  ['IBI-F179.TA', 'פסגות קרן סל',               'TLV', 'פסגות,psagot,ibi,קרן סל,etf'],
  ['IBI-F185.TA', 'פסגות קרן סל',               'TLV', 'פסגות,psagot,ibi,קרן סל,etf'],
  ['IBI-FK4.TA',  'פסגות קרן סל כשר',           'TLV', 'פסגות,psagot,ibi,כשר,kosher,קרן סל,etf'],
  // ── ETFs / קרנות סל — Yelin Lapidot (ילין לפידות) ───────────────────────
  ['YELN-F1.TA',  'ילין לפידות קרן סל',         'TLV', 'ילין לפידות,yelin,lapidot,קרן סל,etf'],
  ['YELN-F2.TA',  'ילין לפידות קרן סל',         'TLV', 'ילין לפידות,yelin,lapidot,קרן סל,etf'],
  ['YELN-F3.TA',  'ילין לפידות קרן סל',         'TLV', 'ילין לפידות,yelin,lapidot,קרן סל,etf'],
  ['YELN-F4.TA',  'ילין לפידות קרן סל',         'TLV', 'ילין לפידות,yelin,lapidot,קרן סל,etf'],
  ['YELN-F5.TA',  'ילין לפידות קרן סל',         'TLV', 'ילין לפידות,yelin,lapidot,קרן סל,etf'],
];

try {
  const insertSymbol = db.prepare(`
    INSERT INTO symbol_cache (symbol, name, exchange, keywords, is_tase, currency, source)
    VALUES (?, ?, ?, ?, 1, 'ILS', 'static')
    ON CONFLICT(symbol) DO UPDATE SET
      name     = excluded.name,
      keywords = excluded.keywords,
      source   = 'static'
  `);
  const seedMany = db.transaction((rows) => {
    for (const [symbol, name, exchange, keywords] of rows) {
      insertSymbol.run(symbol, name, exchange, keywords);
    }
  });
  seedMany(SEED_TASE);
  console.log(`✅ symbol_cache seeded with ${SEED_TASE.length} TASE stocks/ETFs`);
} catch (e) {
  console.warn('symbol_cache seed warning:', e.message);
}

console.log('✅ Database initialized at:', dbPath);

export default db;
