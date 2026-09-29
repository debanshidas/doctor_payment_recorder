import express from 'express';
import cors from 'cors';
import db from './db.js';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// Helper to wrap db.all in a Promise
const dbAll = (query, params = []) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const dbRun = (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const dbGet = (query, params = []) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Authentication Middleware Mock (Expecting user_id in headers for simplicity)
const auth = (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    req.userId = parseInt(userId, 10);
    next();
};

// Auth
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashed = hashPassword(password);
        const result = await dbRun('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hashed]);
        res.json({ id: result.lastID, username, role: 'doctor' });
    } catch (err) {
        res.status(400).json({ error: 'Username may already exist' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const hashed = hashPassword(password);
    const user = await dbGet('SELECT id, username FROM users WHERE username = ? AND password_hash = ?', [username, hashed]);
    if (user) res.json({ ...user, role: 'doctor' });
    else res.status(401).json({ error: 'Invalid credentials' });
});

// Dashboard Analytics (Server-side calculations)
app.get('/api/dashboard', auth, async (req, res) => {
    const stats = await dbGet(`
        SELECT 
            COALESCE(SUM(amount), 0) as totalRevenue,
            COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN amount ELSE 0 END), 0) as totalReceived,
            COALESCE(SUM(CASE WHEN payment_status != 'Paid' THEN amount ELSE 0 END), 0) as totalPending,
            COUNT(*) as totalVisits,
            COALESCE(SUM(cases), 0) as totalCases
        FROM transactions WHERE user_id = ?
    `, [req.userId]);
    
    const hStats = await dbGet(`SELECT COUNT(*) as totalHospitals FROM hospitals WHERE user_id = ?`, [req.userId]);

    res.json({ ...stats, totalHospitals: hStats.totalHospitals });
});

// Hospitals with Server-side Aggregation
app.get('/api/hospitals', auth, async (req, res) => {
    const hospitals = await dbAll(`
        SELECT 
            h.id, h.hospital_name, h.location,
            COUNT(t.id) as visits,
            COALESCE(SUM(t.cases), 0) as cases,
            COALESCE(SUM(t.amount), 0) as expected,
            COALESCE(SUM(CASE WHEN t.payment_status = 'Paid' THEN t.amount ELSE 0 END), 0) as received,
            COALESCE(SUM(CASE WHEN t.payment_status != 'Paid' THEN t.amount ELSE 0 END), 0) as outstanding,
            MAX(t.visit_date) as last_visit
        FROM hospitals h
        LEFT JOIN transactions t ON h.id = t.hospital_id
        WHERE h.user_id = ?
        GROUP BY h.id
        ORDER BY h.id DESC
    `, [req.userId]);
    res.json(hospitals);
});

app.post('/api/hospitals', auth, async (req, res) => {
    const { name, location } = req.body;
    const result = await dbRun('INSERT INTO hospitals (user_id, hospital_name, location) VALUES (?, ?, ?)', [req.userId, name, location]);
    res.json({ id: result.lastID, hospital_name: name, location });
});

// Transactions
app.get('/api/transactions', auth, async (req, res) => {
    const tx = await dbAll(`
        SELECT t.*, h.hospital_name 
        FROM transactions t 
        JOIN hospitals h ON t.hospital_id = h.id 
        WHERE t.user_id = ? 
        ORDER BY t.visit_date DESC, t.id DESC
    `, [req.userId]);
    res.json(tx);
});

app.post('/api/transactions', auth, async (req, res) => {
    const { hospital_id, visit_date, purpose, cases, amount, payment_status } = req.body;
    const lastTx = await dbGet('SELECT id FROM transactions ORDER BY id DESC LIMIT 1');
    const nextId = lastTx ? lastTx.id + 1 : 1;
    const txRef = `DT-2026-${String(nextId).padStart(4, '0')}`;
    
    const result = await dbRun(`
        INSERT INTO transactions (user_id, hospital_id, transaction_reference, visit_date, purpose, cases, amount, payment_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.userId, hospital_id, txRef, visit_date, purpose, cases, amount, payment_status]);
    
    res.json({ id: result.lastID, transaction_reference: txRef });
});

app.put('/api/transactions/:id/pay', auth, async (req, res) => {
    const date = new Date().toISOString().split('T')[0];
    await dbRun('UPDATE transactions SET payment_status = ?, payment_date = ? WHERE id = ? AND user_id = ?', ['Paid', date, req.params.id, req.userId]);
    res.json({ success: true });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
