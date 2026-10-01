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
    payout_basis TEXT DEFAULT 'share',
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
    service_id INTEGER,
    service_type_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
)`,
`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hospital_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    default_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
)`,
`CREATE TABLE IF NOT EXISTS service_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
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
`DROP TABLE IF EXISTS payout_procedures`,
`DROP TABLE IF EXISTS statements`,
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
`CREATE TABLE IF NOT EXISTS queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_code TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium',
    status TEXT NOT NULL DEFAULT 'Open',
    assigned_to INTEGER,
    attachment_name TEXT,
    attachment_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE SET NULL
)`,
`CREATE TABLE IF NOT EXISTS query_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    sender_role TEXT NOT NULL,
    message TEXT NOT NULL,
    is_internal INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(query_id) REFERENCES queries(id) ON DELETE CASCADE,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
)`,
`CREATE TABLE IF NOT EXISTS query_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_id INTEGER NOT NULL,
    actor_id INTEGER,
    actor_role TEXT,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(query_id) REFERENCES queries(id) ON DELETE CASCADE
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

// Columns added after the initial schema; ALTER fails harmlessly once they exist.
for (const stmt of [
    `ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`,
    `ALTER TABLE hospitals ADD COLUMN payout_basis TEXT DEFAULT 'share'`,
    `ALTER TABLE procedures ADD COLUMN service_id INTEGER`,
    `ALTER TABLE procedures ADD COLUMN service_type_id INTEGER`,
]) {
    try { await db.exec(stmt); } catch { /* already applied */ }
}

const adminHash = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD || 'admin123').digest('hex');
await db.run(
    `INSERT OR IGNORE INTO users (username, email, name, password_hash, role, status) VALUES ('admin', 'admin@doctrack.com', 'System Admin', ?, 'admin', 'active')`,
    [adminHash]
);
// Keep the admin password in sync with ADMIN_PASSWORD (or admin123) on every start,
// so it can always be reset from the deploy environment. Also ensure the admin stays active.
await db.run(`UPDATE users SET password_hash = ?, status = 'active' WHERE username = 'admin' AND role = 'admin'`, [adminHash]);

console.log('Connected to database:', db.label);

export default db;
