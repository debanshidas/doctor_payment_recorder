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
            return res.status(400).json({ error: 'An account with this username or email already exists.' });
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
    try {
        const hospitals = await dbAll(
            'SELECT * FROM hospitals WHERE user_id = ? ORDER BY id DESC',
            [req.userId]
        );
        res.json(hospitals);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch hospitals.' });
    }
});

app.post('/api/hospitals', auth, async (req, res) => {
    const { name, location, payout_percentage, fixed_fee, tds_rate, deduction_rate, settlement_cycle, finance_contact_name, finance_contact_email, finance_contact_phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Hospital name is required.' });
    try {
        const result = await dbRun(
            `INSERT INTO hospitals (user_id, name, location, payout_percentage, fixed_fee, tds_rate, deduction_rate, settlement_cycle, finance_contact_name, finance_contact_email, finance_contact_phone)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.userId, name, location || 'Bangalore', payout_percentage ?? 80, fixed_fee ?? 0, tds_rate ?? 10, deduction_rate ?? 2, settlement_cycle || '30 days', finance_contact_name || null, finance_contact_email || null, finance_contact_phone || null]
        );
        const hospital = await dbGet('SELECT * FROM hospitals WHERE id = ?', [result.lastID]);
        res.json(hospital);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create hospital.' });
    }
});

app.put('/api/hospitals/:id', auth, async (req, res) => {
    const fields = ['name', 'location', 'payout_percentage', 'fixed_fee', 'tds_rate', 'deduction_rate', 'settlement_cycle', 'finance_contact_name', 'finance_contact_email', 'finance_contact_phone'];
    const sets = [];
    const params = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) {
            sets.push(`${f} = ?`);
            params.push(req.body[f]);
        }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    params.push(req.params.id, req.userId);
    try {
        await dbRun(`UPDATE hospitals SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
        const hospital = await dbGet('SELECT * FROM hospitals WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        res.json(hospital);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update hospital.' });
    }
});

app.delete('/api/hospitals/:id', auth, async (req, res) => {
    try {
        const result = await dbRun('DELETE FROM hospitals WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Hospital not found.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete hospital.' });
    }
});

// ── Procedures ──

app.get('/api/procedures', auth, async (req, res) => {
    try {
        const procedures = await dbAll(
            `SELECT p.*, h.name as hospital_name
             FROM procedures p
             JOIN hospitals h ON p.hospital_id = h.id
             WHERE p.user_id = ?
             ORDER BY p.date DESC, p.id DESC`,
            [req.userId]
        );
        res.json(procedures);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch procedures.' });
    }
});

app.post('/api/procedures', auth, async (req, res) => {
    const { hospital_id, date, patient_name, procedure_type, cases, gross_amount } = req.body;
    if (!hospital_id || !date) return res.status(400).json({ error: 'hospital_id and date are required.' });
    try {
        const hospital = await dbGet('SELECT * FROM hospitals WHERE id = ? AND user_id = ?', [hospital_id, req.userId]);
        if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });

        const ga = gross_amount || 0;
        const doctor_share = ga * (hospital.payout_percentage / 100);
        const tds_amount = doctor_share * (hospital.tds_rate / 100);
        const deduction_amount = doctor_share * (hospital.deduction_rate / 100);
        const net_expected = doctor_share - tds_amount - deduction_amount - hospital.fixed_fee;

        const result = await dbRun(
            `INSERT INTO procedures (user_id, hospital_id, date, patient_name, procedure_type, cases, gross_amount, doctor_share, tds_amount, deduction_amount, net_expected)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.userId, hospital_id, date, patient_name || null, procedure_type || 'Consultation', cases || 1, ga, doctor_share, tds_amount, deduction_amount, net_expected]
        );
        const proc = await dbGet(
            `SELECT p.*, h.name as hospital_name FROM procedures p JOIN hospitals h ON p.hospital_id = h.id WHERE p.id = ?`,
            [result.lastID]
        );
        res.json(proc);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create procedure.' });
    }
});

app.put('/api/procedures/:id', auth, async (req, res) => {
    const fields = ['status', 'patient_name', 'procedure_type', 'cases', 'gross_amount', 'notes', 'date'];
    const sets = [];
    const params = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) {
            sets.push(`${f} = ?`);
            params.push(req.body[f]);
        }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    params.push(req.params.id, req.userId);
    try {
        await dbRun(`UPDATE procedures SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
        const proc = await dbGet(
            `SELECT p.*, h.name as hospital_name FROM procedures p JOIN hospitals h ON p.hospital_id = h.id WHERE p.id = ?`,
            [req.params.id]
        );
        res.json(proc);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update procedure.' });
    }
});

app.delete('/api/procedures/:id', auth, async (req, res) => {
    try {
        const result = await dbRun('DELETE FROM procedures WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Procedure not found.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete procedure.' });
    }
});

// ── Payouts ──

app.get('/api/payouts', auth, async (req, res) => {
    try {
        const payouts = await dbAll(
            `SELECT py.*, h.name as hospital_name
             FROM payouts py
             JOIN hospitals h ON py.hospital_id = h.id
             WHERE py.user_id = ?
             ORDER BY py.date DESC`,
            [req.userId]
        );
        res.json(payouts);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch payouts.' });
    }
});

app.post('/api/payouts', auth, async (req, res) => {
    const { hospital_id, date, period, actual_net, transaction_ref, procedure_ids } = req.body;
    if (!hospital_id || !date) return res.status(400).json({ error: 'hospital_id and date are required.' });
    try {
        const hospital = await dbGet('SELECT * FROM hospitals WHERE id = ? AND user_id = ?', [hospital_id, req.userId]);
        if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });

        let gross_amount = 0, tds = 0, deductions = 0, expected_net = 0;
        const linkedProcedures = [];

        if (procedure_ids && procedure_ids.length > 0) {
            const placeholders = procedure_ids.map(() => '?').join(',');
            const procs = await dbAll(
                `SELECT * FROM procedures WHERE id IN (${placeholders}) AND user_id = ?`,
                [...procedure_ids, req.userId]
            );
            for (const p of procs) {
                gross_amount += p.gross_amount;
                tds += p.tds_amount;
                deductions += p.deduction_amount;
                expected_net += p.net_expected;
                linkedProcedures.push(p);
            }
        }

        const actualNet = actual_net || 0;
        const shortfall = expected_net - actualNet;

        const result = await dbRun(
            `INSERT INTO payouts (user_id, hospital_id, date, period, gross_amount, tds, deductions, expected_net, actual_net, shortfall, transaction_ref)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.userId, hospital_id, date, period || null, gross_amount, tds, deductions, expected_net, actualNet, shortfall, transaction_ref || null]
        );

        const payoutId = result.lastID;

        if (procedure_ids && procedure_ids.length > 0) {
            for (const pid of procedure_ids) {
                await dbRun('INSERT INTO payout_procedures (payout_id, procedure_id) VALUES (?, ?)', [payoutId, pid]);
            }
            const placeholders = procedure_ids.map(() => '?').join(',');
            await dbRun(`UPDATE procedures SET status = 'Paid' WHERE id IN (${placeholders}) AND user_id = ?`, [...procedure_ids, req.userId]);
        }

        const payout = await dbGet(
            `SELECT py.*, h.name as hospital_name FROM payouts py JOIN hospitals h ON py.hospital_id = h.id WHERE py.id = ?`,
            [payoutId]
        );
        payout.procedures = linkedProcedures;
        res.json(payout);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create payout.' });
    }
});

app.put('/api/payouts/:id', auth, async (req, res) => {
    const fields = ['status', 'actual_net', 'transaction_ref', 'notes', 'date', 'period'];
    const sets = [];
    const params = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) {
            sets.push(`${f} = ?`);
            params.push(req.body[f]);
        }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    params.push(req.params.id, req.userId);
    try {
        await dbRun(`UPDATE payouts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
        const payout = await dbGet(
            `SELECT py.*, h.name as hospital_name FROM payouts py JOIN hospitals h ON py.hospital_id = h.id WHERE py.id = ?`,
            [req.params.id]
        );
        res.json(payout);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update payout.' });
    }
});

app.delete('/api/payouts/:id', auth, async (req, res) => {
    try {
        const result = await dbRun('DELETE FROM payouts WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Payout not found.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete payout.' });
    }
});

// ── Dashboard ──

app.get('/api/dashboard', auth, async (req, res) => {
    try {
        const totals = await dbGet(
            `SELECT
                COALESCE(SUM(gross_amount), 0) as totalBilled,
                COALESCE(SUM(net_expected), 0) as expectedRevenue,
                COALESCE(SUM(tds_amount), 0) as totalTds,
                COUNT(*) as procedureCount
             FROM procedures WHERE user_id = ?`,
            [req.userId]
        );

        const receivedRow = await dbGet(
            `SELECT COALESCE(SUM(actual_net), 0) as totalReceived
             FROM payouts WHERE user_id = ? AND status = 'Paid'`,
            [req.userId]
        );

        const hospitalCount = await dbGet(
            'SELECT COUNT(*) as count FROM hospitals WHERE user_id = ?',
            [req.userId]
        );

        const totalReceived = receivedRow.totalReceived;
        const totalPending = totals.expectedRevenue - totalReceived;
        const collectionRate = totals.expectedRevenue > 0 ? (totalReceived / totals.expectedRevenue * 100) : 0;

        const recentProcedures = await dbAll(
            `SELECT p.*, h.name as hospital_name
             FROM procedures p
             JOIN hospitals h ON p.hospital_id = h.id
             WHERE p.user_id = ?
             ORDER BY p.date DESC, p.id DESC
             LIMIT 5`,
            [req.userId]
        );

        const hospitalSummary = await dbAll(
            `SELECT
                h.id,
                h.name,
                COUNT(p.id) as procedure_count,
                COALESCE(SUM(p.gross_amount), 0) as total_billed,
                COALESCE(SUM(p.net_expected), 0) as expected
             FROM hospitals h
             LEFT JOIN procedures p ON p.hospital_id = h.id
             WHERE h.user_id = ?
             GROUP BY h.id`,
            [req.userId]
        );

        for (const hs of hospitalSummary) {
            const recv = await dbGet(
                `SELECT COALESCE(SUM(actual_net), 0) as received
                 FROM payouts WHERE hospital_id = ? AND user_id = ? AND status = 'Paid'`,
                [hs.id, req.userId]
            );
            hs.received = recv.received;
            hs.pending = hs.expected - hs.received;
        }

        const alerts = [];

        const discrepancyCount = await dbGet(
            `SELECT COUNT(*) as count FROM procedures WHERE user_id = ? AND status = 'Discrepancy'`,
            [req.userId]
        );
        if (discrepancyCount.count > 0) {
            alerts.push({ type: 'discrepancy', message: `${discrepancyCount.count} procedure(s) have discrepancies`, severity: 'warning' });
        }

        const shortfallPayouts = await dbAll(
            `SELECT py.*, h.name as hospital_name FROM payouts py JOIN hospitals h ON py.hospital_id = h.id WHERE py.user_id = ? AND py.shortfall > 0`,
            [req.userId]
        );
        for (const sp of shortfallPayouts) {
            alerts.push({ type: 'shortfall', message: `Payout shortfall of ${sp.shortfall.toFixed(2)} from ${sp.hospital_name} on ${sp.date}`, severity: 'error' });
        }

        res.json({
            totalBilled: totals.totalBilled,
            expectedRevenue: totals.expectedRevenue,
            totalReceived,
            totalPending,
            collectionRate,
            totalTds: totals.totalTds,
            procedureCount: totals.procedureCount,
            hospitalCount: hospitalCount.count,
            recentProcedures,
            hospitalSummary,
            alerts
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load dashboard.' });
    }
});

// ── Reconciliation ──

app.get('/api/reconciliation', auth, async (req, res) => {
    try {
        const summary = await dbGet(
            `SELECT
                COALESCE(SUM(CASE WHEN status = 'Matched' THEN 1 ELSE 0 END), 0) as matched,
                COALESCE(SUM(CASE WHEN status = 'Discrepancy' THEN 1 ELSE 0 END), 0) as discrepancy,
                COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) as pending,
                COALESCE(SUM(CASE WHEN status NOT IN ('Matched','Discrepancy','Pending') THEN 1 ELSE 0 END), 0) as unmatched,
                COUNT(*) as total,
                COALESCE(SUM(tds_amount), 0) as totalTds,
                COALESCE(SUM(deduction_amount), 0) as totalDeductions
             FROM procedures WHERE user_id = ?`,
            [req.userId]
        );

        const matchRate = summary.total > 0 ? (summary.matched / summary.total * 100) : 0;

        const matched = await dbAll(
            `SELECT p.*, h.name as hospital_name FROM procedures p JOIN hospitals h ON p.hospital_id = h.id WHERE p.user_id = ? AND p.status = 'Matched' ORDER BY p.date DESC`,
            [req.userId]
        );

        const discrepancies = await dbAll(
            `SELECT p.*, h.name as hospital_name FROM procedures p JOIN hospitals h ON p.hospital_id = h.id WHERE p.user_id = ? AND p.status = 'Discrepancy' ORDER BY p.date DESC`,
            [req.userId]
        );

        const unmatched = await dbAll(
            `SELECT p.*, h.name as hospital_name
             FROM procedures p
             JOIN hospitals h ON p.hospital_id = h.id
             LEFT JOIN payout_procedures pp ON p.id = pp.procedure_id
             WHERE p.user_id = ? AND (p.status = 'Pending' OR pp.payout_id IS NULL)
             ORDER BY p.date DESC`,
            [req.userId]
        );

        res.json({
            summary: { matched: summary.matched, discrepancy: summary.discrepancy, pending: summary.pending, unmatched: summary.unmatched },
            matchRate,
            totalTds: summary.totalTds,
            totalDeductions: summary.totalDeductions,
            matched,
            discrepancies,
            unmatched
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load reconciliation.' });
    }
});

// ── Statements ──

app.get('/api/statements', auth, async (req, res) => {
    try {
        const statements = await dbAll(
            `SELECT s.*, h.name as hospital_name
             FROM statements s
             JOIN hospitals h ON s.hospital_id = h.id
             WHERE s.user_id = ?
             ORDER BY s.created_at DESC`,
            [req.userId]
        );
        res.json(statements);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch statements.' });
    }
});

app.post('/api/statements', auth, async (req, res) => {
    const { hospital_id, period, filename } = req.body;
    if (!hospital_id || !period) return res.status(400).json({ error: 'hospital_id and period are required.' });
    try {
        const result = await dbRun(
            'INSERT INTO statements (user_id, hospital_id, period, filename, status) VALUES (?, ?, ?, ?, ?)',
            [req.userId, hospital_id, period, filename || null, 'Processing']
        );
        const statement = await dbGet(
            `SELECT s.*, h.name as hospital_name FROM statements s JOIN hospitals h ON s.hospital_id = h.id WHERE s.id = ?`,
            [result.lastID]
        );
        res.json(statement);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create statement.' });
    }
});

app.put('/api/statements/:id', auth, async (req, res) => {
    const fields = ['status', 'matched_count', 'discrepancy_count', 'unmatched_count', 'filename'];
    const sets = [];
    const params = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) {
            sets.push(`${f} = ?`);
            params.push(req.body[f]);
        }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    params.push(req.params.id, req.userId);
    try {
        await dbRun(`UPDATE statements SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
        const statement = await dbGet(
            `SELECT s.*, h.name as hospital_name FROM statements s JOIN hospitals h ON s.hospital_id = h.id WHERE s.id = ?`,
            [req.params.id]
        );
        res.json(statement);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update statement.' });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
