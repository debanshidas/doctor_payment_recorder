import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA = [
`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'doctor',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
)`,
`CREATE TABLE IF NOT EXISTS hospitals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    location TEXT DEFAULT 'Bangalore',
    payout_percentage REAL DEFAULT 80,
    fixed_fee REAL DEFAULT 0,
    tds_rate REAL DEFAULT 10,
    deduction_rate REAL DEFAULT 2,
    settlement_cycle TEXT DEFAULT '30 days',
    finance_contact_name TEXT,
    finance_contact_email TEXT,
    finance_contact_phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
)`,
`CREATE TABLE IF NOT EXISTS procedures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hospital_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    patient_name TEXT,
    procedure_type TEXT DEFAULT 'Consultation',
    cases INTEGER DEFAULT 1,
    gross_amount REAL DEFAULT 0,
    doctor_share REAL DEFAULT 0,
    tds_amount REAL DEFAULT 0,
    deduction_amount REAL DEFAULT 0,
    net_expected REAL DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
)`,
`CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hospital_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    period TEXT,
    gross_amount REAL DEFAULT 0,
    tds REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    expected_net REAL DEFAULT 0,
    actual_net REAL DEFAULT 0,
    shortfall REAL DEFAULT 0,
    transaction_ref TEXT,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
)`,
`CREATE TABLE IF NOT EXISTS payout_procedures (
    payout_id INTEGER NOT NULL,
    procedure_id INTEGER NOT NULL,
    PRIMARY KEY(payout_id, procedure_id),
    FOREIGN KEY(payout_id) REFERENCES payouts(id) ON DELETE CASCADE,
    FOREIGN KEY(procedure_id) REFERENCES procedures(id) ON DELETE CASCADE
)`,
`CREATE TABLE IF NOT EXISTS statements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hospital_id INTEGER NOT NULL,
    period TEXT NOT NULL,
    filename TEXT,
    status TEXT DEFAULT 'Processing',
    matched_count INTEGER DEFAULT 0,
    discrepancy_count INTEGER DEFAULT 0,
    unmatched_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
)`,
`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id INTEGER,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE CASCADE
)`,
];

async function createRemoteDb(url, authToken) {
    const { createClient } = await import('@libsql/client/web');
    // libsql:// selects a WebSocket transport that can stall on some hosts; plain HTTPS is reliable.
    const client = createClient({ url: url.replace(/^libsql:\/\//, 'https://'), authToken });
    const toObjects = (rs) => rs.rows.map(r => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
    return {
        label: `Turso (${url})`,
        exec: (sql) => client.execute(sql),
        all: async (sql, args) => toObjects(await client.execute({ sql, args })),
        get: async (sql, args) => toObjects(await client.execute({ sql, args }))[0],
        run: async (sql, args) => {
            const rs = await client.execute({ sql, args });
            return { lastID: Number(rs.lastInsertRowid ?? 0), changes: rs.rowsAffected };
        },
    };
}

async function createLocalDb(file) {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(file);
    db.exec('PRAGMA foreign_keys = ON');
    return {
        label: file,
        exec: async (sql) => db.exec(sql),
        all: async (sql, args) => db.prepare(sql).all(...args),
        get: async (sql, args) => db.prepare(sql).get(...args),
        run: async (sql, args) => {
            const r = db.prepare(sql).run(...args);
            return { lastID: Number(r.lastInsertRowid), changes: Number(r.changes) };
        },
    };
}

async function connect() {
    const localPath = process.env.DB_PATH || path.resolve(__dirname, 'database.sqlite');
    const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: token } = process.env;
    if (!url) return createLocalDb(localPath);
    try {
        const remote = await createRemoteDb(url, token);
        await Promise.race([
            remote.exec('SELECT 1'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('connection timed out after 15s')), 15000)),
        ]);
        return remote;
    } catch (err) {
        console.error('Turso connection failed, falling back to local file:', err.message);
        const local = await createLocalDb(localPath);
        local.error = `Turso: ${err.message}`;
        return local;
    }
}

const db = await connect();

for (const stmt of SCHEMA) await db.exec(stmt);

try {
    await db.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`);
} catch {
    // column already exists on databases created before it was added
}

const adminHash = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD || 'admin123').digest('hex');
await db.run(
    `INSERT OR IGNORE INTO users (username, email, name, password_hash, role, status) VALUES ('admin', 'admin@doctrack.com', 'System Admin', ?, 'admin', 'active')`,
    [adminHash]
);

console.log('Connected to database:', db.label);

export default db;
