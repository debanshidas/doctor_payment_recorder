import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to SQLite database at', dbPath);
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON');

        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'doctor',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS hospitals (
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
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS procedures (
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
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS payouts (
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
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS payout_procedures (
            payout_id INTEGER NOT NULL,
            procedure_id INTEGER NOT NULL,
            PRIMARY KEY(payout_id, procedure_id),
            FOREIGN KEY(payout_id) REFERENCES payouts(id) ON DELETE CASCADE,
            FOREIGN KEY(procedure_id) REFERENCES procedures(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS statements (
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
        )`);
    });
}

export default db;
