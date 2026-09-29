import express from 'express';
import cors from 'cors';
import db from './db.js';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

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

const auth = (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    req.userId = parseInt(userId, 10);
    next();
};

// ── Auth ──

app.post('/api/auth/register', async (req, res) => {
    const { username, email, name, password } = req.body;
    if (!username || !password || !name || !email) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    try {
        const hashed = hashPassword(password);
        const result = await dbRun(
            'INSERT INTO users (username, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
            [username, email, name, hashed, 'doctor']
        );
        res.json({ id: result.lastID, username, email, name, role: 'doctor' });
    } catch (err) {
        if (err.message?.includes('UNIQUE')) {
            return res.status(400).json({ error: 'An account with this email already exists.' });
        }
        res.status(500).json({ error: 'Registration failed.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required.' });
    }
    const hashed = hashPassword(password);
    const user = await dbGet(
        'SELECT id, username, email, name, role FROM users WHERE (username = ? OR email = ?) AND password_hash = ?',
        [username, username, hashed]
    );
    if (user) {
        await dbRun('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        res.json(user);
    } else {
        res.status(401).json({ error: 'Invalid username or password.' });
    }
});

// ── Hospitals ──

app.get('/api/hospitals', auth, async (req, res) => {
    const hospitals = await dbAll(
        'SELECT id, name, location FROM hospitals WHERE user_id = ? ORDER BY id DESC',
        [req.userId]
    );
    for (const h of hospitals) {
        h.services = await dbAll(
            'SELECT name, rate FROM hospital_services WHERE hospital_id = ?',
            [h.id]
        );
        h.userId = req.userId;
    }
    res.json(hospitals);
});

app.post('/api/hospitals', auth, async (req, res) => {
    const { name, location, services } = req.body;
    if (!name) return res.status(400).json({ error: 'Hospital name is required.' });
    try {
        const result = await dbRun(
            'INSERT INTO hospitals (user_id, name, location) VALUES (?, ?, ?)',
            [req.userId, name, location || 'Bangalore']
        );
        const hospitalId = result.lastID;
        const svcList = services && services.length ? services : [{ name: 'Consultation', rate: 1000 }];
        for (const svc of svcList) {
            await dbRun(
                'INSERT INTO hospital_services (hospital_id, name, rate) VALUES (?, ?, ?)',
                [hospitalId, svc.name, svc.rate]
            );
        }
        res.json({ id: hospitalId, userId: req.userId, name, location: location || 'Bangalore', services: svcList });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create hospital.' });
    }
});

app.delete('/api/hospitals/:id', auth, async (req, res) => {
    const hospital = await dbGet(
        'SELECT name FROM hospitals WHERE id = ? AND user_id = ?',
        [req.params.id, req.userId]
    );
    if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });

    await dbRun('DELETE FROM hospitals WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    await dbRun('DELETE FROM records WHERE user_id = ? AND hospital_name = ?', [req.userId, hospital.name]);
    await dbRun('DELETE FROM payments WHERE user_id = ? AND hospital_name = ?', [req.userId, hospital.name]);
    await dbRun('DELETE FROM discrepancies WHERE user_id = ? AND hospital_name = ?', [req.userId, hospital.name]);
    res.json({ success: true });
});

// ── Records ──

app.get('/api/records', auth, async (req, res) => {
    const rows = await dbAll(
        'SELECT id, hospital_name as hospital, date, service, cases, expected_amount as expectedAmount, status FROM records WHERE user_id = ? ORDER BY id DESC',
        [req.userId]
    );
    rows.forEach(r => { r.userId = req.userId; });
    res.json(rows);
});

app.post('/api/records', auth, async (req, res) => {
    const { hospital, date, service, cases, expectedAmount } = req.body;
    const result = await dbRun(
        'INSERT INTO records (user_id, hospital_name, date, service, cases, expected_amount) VALUES (?, ?, ?, ?, ?, ?)',
        [req.userId, hospital, date, service, cases || 1, expectedAmount || 0]
    );
    res.json({ id: result.lastID, userId: req.userId, hospital, date, service, cases: cases || 1, expectedAmount: expectedAmount || 0, status: 'Active' });
});

app.put('/api/records/:id', auth, async (req, res) => {
    const { status } = req.body;
    await dbRun(
        'UPDATE records SET status = ? WHERE id = ? AND user_id = ?',
        [status, req.params.id, req.userId]
    );
    res.json({ success: true });
});

app.delete('/api/records/:id', auth, async (req, res) => {
    await dbRun('DELETE FROM records WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ success: true });
});

// ── Payments ──

app.get('/api/payments', auth, async (req, res) => {
    const rows = await dbAll(
        'SELECT id, hospital_name as hospital, date, amount, status, record_id as recordId FROM payments WHERE user_id = ? ORDER BY id DESC',
        [req.userId]
    );
    rows.forEach(p => { p.userId = req.userId; });
    res.json(rows);
});

app.post('/api/payments', auth, async (req, res) => {
    const { hospital, date, amount, status, recordId } = req.body;
    const result = await dbRun(
        'INSERT INTO payments (user_id, hospital_name, date, amount, status, record_id) VALUES (?, ?, ?, ?, ?, ?)',
        [req.userId, hospital, date, amount || 0, status || 'Paid', recordId || null]
    );
    res.json({ id: result.lastID, userId: req.userId, hospital, date, amount: amount || 0, status: status || 'Paid', recordId: recordId || null });
});

app.put('/api/payments/:id', auth, async (req, res) => {
    const { status, amount } = req.body;
    const sets = [];
    const params = [];
    if (status !== undefined) { sets.push('status = ?'); params.push(status); }
    if (amount !== undefined) { sets.push('amount = ?'); params.push(amount); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    params.push(req.params.id, req.userId);
    await dbRun(`UPDATE payments SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
    res.json({ success: true });
});

// ── Discrepancies ──

app.get('/api/discrepancies', auth, async (req, res) => {
    const rows = await dbAll(
        'SELECT id, hospital_name as hospital, expected_amount as expectedAmount, received_amount as receivedAmount, difference, status FROM discrepancies WHERE user_id = ? ORDER BY id DESC',
        [req.userId]
    );
    res.json(rows);
});

app.put('/api/discrepancies/:id', auth, async (req, res) => {
    const { status } = req.body;
    await dbRun(
        'UPDATE discrepancies SET status = ? WHERE id = ? AND user_id = ?',
        [status, req.params.id, req.userId]
    );
    res.json({ success: true });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
