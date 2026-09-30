import express from 'express';
import cors from 'cors';
import db from './db.js';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

const dbAll = (query, params = []) => db.all(query, params);
const dbRun = (query, params = []) => db.run(query, params);
const dbGet = (query, params = []) => db.get(query, params);

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

const PAYOUT_STATUSES = ['Paid', 'Partially Paid', 'Under Review'];

// amountPerCase is billed per case; the doctor's share is either a % of gross or a fixed fee per case.
function calcWaterfall(hospital, amountPerCase, cases) {
    const n = Math.max(1, Number(cases) || 1);
    const gross_amount = (Number(amountPerCase) || 0) * n;
    const doctor_share = hospital.payout_basis === 'fixed'
        ? (Number(hospital.fixed_fee) || 0) * n
        : gross_amount * (hospital.payout_percentage / 100);
    const tds_amount = doctor_share * (hospital.tds_rate / 100);
    const deduction_amount = doctor_share * (hospital.deduction_rate / 100);
    return { cases: n, gross_amount, doctor_share, tds_amount, deduction_amount, net_expected: doctor_share - tds_amount - deduction_amount };
}

const auth = (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    req.userId = parseInt(userId, 10);
    next();
};

const adminAuth = async (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    req.userId = parseInt(userId, 10);
    const user = await dbGet('SELECT role, status FROM users WHERE id = ?', [req.userId]);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    if (user.status !== 'active') return res.status(403).json({ error: 'Account deactivated' });
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

async function attachServices(hospitals, userId) {
    const services = await dbAll('SELECT * FROM services WHERE user_id = ? ORDER BY id', [userId]);
    const types = await dbAll('SELECT * FROM service_types WHERE user_id = ? ORDER BY id', [userId]);
    for (const s of services) s.types = types.filter(t => t.service_id === s.id);
    for (const h of hospitals) h.services = services.filter(s => s.hospital_id === h.id);
    return hospitals;
}

app.get('/api/hospitals', auth, async (req, res) => {
    try {
        const hospitals = await dbAll('SELECT * FROM hospitals WHERE user_id = ? ORDER BY id DESC', [req.userId]);
        res.json(await attachServices(hospitals, req.userId));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch hospitals.' });
    }
});

// ── Services (per hospital) ──

const serviceWithTypes = async (id, userId) => {
    const s = await dbGet('SELECT * FROM services WHERE id = ? AND user_id = ?', [id, userId]);
    if (s) s.types = await dbAll('SELECT * FROM service_types WHERE service_id = ? ORDER BY id', [id]);
    return s;
};

app.post('/api/hospitals/:id/services', auth, async (req, res) => {
    const { name, default_amount } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Service name is required.' });
    try {
        const hospital = await dbGet('SELECT id FROM hospitals WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });
        const r = await dbRun('INSERT INTO services (user_id, hospital_id, name, default_amount) VALUES (?, ?, ?, ?)',
            [req.userId, req.params.id, name.trim(), Number(default_amount) || 0]);
        res.json(await serviceWithTypes(r.lastID, req.userId));
    } catch (err) { res.status(500).json({ error: 'Failed to add service.' }); }
});

app.put('/api/services/:id', auth, async (req, res) => {
    const { name, default_amount } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Service name is required.' });
    try {
        const r = await dbRun('UPDATE services SET name = ?, default_amount = ? WHERE id = ? AND user_id = ?',
            [name.trim(), Number(default_amount) || 0, req.params.id, req.userId]);
        if (r.changes === 0) return res.status(404).json({ error: 'Service not found.' });
        res.json(await serviceWithTypes(req.params.id, req.userId));
    } catch (err) { res.status(500).json({ error: 'Failed to update service.' }); }
});

app.delete('/api/services/:id', auth, async (req, res) => {
    try {
        const r = await dbRun('DELETE FROM services WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        if (r.changes === 0) return res.status(404).json({ error: 'Service not found.' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to delete service.' }); }
});

app.post('/api/services/:id/types', auth, async (req, res) => {
    const { name, amount } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Type name is required.' });
    try {
        const service = await dbGet('SELECT id FROM services WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        if (!service) return res.status(404).json({ error: 'Service not found.' });
        const r = await dbRun('INSERT INTO service_types (user_id, service_id, name, amount) VALUES (?, ?, ?, ?)',
            [req.userId, req.params.id, name.trim(), Number(amount) || 0]);
        res.json(await dbGet('SELECT * FROM service_types WHERE id = ?', [r.lastID]));
    } catch (err) { res.status(500).json({ error: 'Failed to add type.' }); }
});

app.put('/api/service-types/:id', auth, async (req, res) => {
    const { name, amount } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Type name is required.' });
    try {
        const r = await dbRun('UPDATE service_types SET name = ?, amount = ? WHERE id = ? AND user_id = ?',
            [name.trim(), Number(amount) || 0, req.params.id, req.userId]);
        if (r.changes === 0) return res.status(404).json({ error: 'Type not found.' });
        res.json(await dbGet('SELECT * FROM service_types WHERE id = ?', [req.params.id]));
    } catch (err) { res.status(500).json({ error: 'Failed to update type.' }); }
});

app.delete('/api/service-types/:id', auth, async (req, res) => {
    try {
        const r = await dbRun('DELETE FROM service_types WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        if (r.changes === 0) return res.status(404).json({ error: 'Type not found.' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to delete type.' }); }
});

app.post('/api/hospitals', auth, async (req, res) => {
    const { name, location, payout_basis, payout_percentage, fixed_fee, tds_rate, deduction_rate, settlement_cycle, finance_contact_name, finance_contact_email, finance_contact_phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Hospital name is required.' });
    if (payout_basis && !['share', 'fixed'].includes(payout_basis)) return res.status(400).json({ error: 'payout_basis must be share or fixed.' });
    try {
        const result = await dbRun(
            `INSERT INTO hospitals (user_id, name, location, payout_basis, payout_percentage, fixed_fee, tds_rate, deduction_rate, settlement_cycle, finance_contact_name, finance_contact_email, finance_contact_phone)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.userId, name, location || 'Bangalore', payout_basis || 'share', payout_percentage ?? 80, fixed_fee ?? 0, tds_rate ?? 10, deduction_rate ?? 2, settlement_cycle || '30 days', finance_contact_name || null, finance_contact_email || null, finance_contact_phone || null]
        );
        const hospital = await dbGet('SELECT * FROM hospitals WHERE id = ?', [result.lastID]);
        hospital.services = [];
        res.json(hospital);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create hospital.' });
    }
});

app.put('/api/hospitals/:id', auth, async (req, res) => {
    const fields = ['name', 'location', 'payout_basis', 'payout_percentage', 'fixed_fee', 'tds_rate', 'deduction_rate', 'settlement_cycle', 'finance_contact_name', 'finance_contact_email', 'finance_contact_phone'];
    if (req.body.payout_basis && !['share', 'fixed'].includes(req.body.payout_basis)) return res.status(400).json({ error: 'payout_basis must be share or fixed.' });
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
        res.json((await attachServices([hospital], req.userId))[0]);
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
    const { hospital_id, date, patient_name, procedure_type, cases, gross_amount, service_id, service_type_id } = req.body;
    if (!hospital_id || !date) return res.status(400).json({ error: 'hospital_id and date are required.' });
    try {
        const hospital = await dbGet('SELECT * FROM hospitals WHERE id = ? AND user_id = ?', [hospital_id, req.userId]);
        if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });

        // Amount comes from the hospital's configured service/type unless the doctor overrides it.
        let label = procedure_type || 'Consultation';
        let amount = gross_amount;
        let service = null, type = null;
        if (service_id) {
            service = await dbGet('SELECT * FROM services WHERE id = ? AND hospital_id = ? AND user_id = ?', [service_id, hospital_id, req.userId]);
            if (!service) return res.status(404).json({ error: 'Service not found for this hospital.' });
            label = service.name;
            if (amount === undefined || amount === null || amount === '') amount = service.default_amount;
            if (service_type_id) {
                type = await dbGet('SELECT * FROM service_types WHERE id = ? AND service_id = ? AND user_id = ?', [service_type_id, service_id, req.userId]);
                if (!type) return res.status(404).json({ error: 'Service type not found.' });
                label = `${service.name} — ${type.name}`;
                if (gross_amount === undefined || gross_amount === null || gross_amount === '') amount = type.amount;
            }
        }

        const w = calcWaterfall(hospital, amount, cases);

        const result = await dbRun(
            `INSERT INTO procedures (user_id, hospital_id, date, patient_name, procedure_type, cases, gross_amount, doctor_share, tds_amount, deduction_amount, net_expected, service_id, service_type_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.userId, hospital_id, date, patient_name || null, label, w.cases, w.gross_amount, w.doctor_share, w.tds_amount, w.deduction_amount, w.net_expected, service?.id ?? null, type?.id ?? null]
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
    const fields = ['status', 'patient_name', 'procedure_type', 'notes', 'date'];
    const sets = [];
    const params = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) {
            sets.push(`${f} = ?`);
            params.push(req.body[f]);
        }
    }
    try {
        const { service_id, service_type_id } = req.body;
        if (service_id !== undefined) {
            const existing = await dbGet('SELECT hospital_id FROM procedures WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
            if (!existing) return res.status(404).json({ error: 'Procedure not found.' });
            if (service_id === null) {
                sets.push('service_id = ?', 'service_type_id = ?'); params.push(null, null);
            } else {
                const service = await dbGet('SELECT * FROM services WHERE id = ? AND hospital_id = ? AND user_id = ?', [service_id, existing.hospital_id, req.userId]);
                if (!service) return res.status(404).json({ error: 'Service not found for this hospital.' });
                let label = service.name;
                let typeId = null;
                if (service_type_id) {
                    const type = await dbGet('SELECT * FROM service_types WHERE id = ? AND service_id = ? AND user_id = ?', [service_type_id, service_id, req.userId]);
                    if (!type) return res.status(404).json({ error: 'Service type not found.' });
                    label = `${service.name} — ${type.name}`;
                    typeId = type.id;
                }
                sets.push('service_id = ?', 'service_type_id = ?', 'procedure_type = ?'); params.push(service.id, typeId, label);
            }
        }
        if (req.body.cases !== undefined || req.body.gross_amount !== undefined) {
            const existing = await dbGet('SELECT * FROM procedures WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
            if (!existing) return res.status(404).json({ error: 'Procedure not found.' });
            const hospital = await dbGet('SELECT * FROM hospitals WHERE id = ?', [existing.hospital_id]);
            const perCase = req.body.gross_amount ?? existing.gross_amount / (existing.cases || 1);
            const w = calcWaterfall(hospital, perCase, req.body.cases ?? existing.cases);
            for (const k of ['cases', 'gross_amount', 'doctor_share', 'tds_amount', 'deduction_amount', 'net_expected']) {
                sets.push(`${k} = ?`);
                params.push(w[k]);
            }
        }
        if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
        params.push(req.params.id, req.userId);
        const r = await dbRun(`UPDATE procedures SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
        if (r.changes === 0) return res.status(404).json({ error: 'Procedure not found.' });
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
    const { hospital_id, date, period, actual_net, transaction_ref, notes, status } = req.body;
    if (!hospital_id || !date) return res.status(400).json({ error: 'hospital_id and date are required.' });
    const amount = Number(actual_net);
    if (!(amount > 0)) return res.status(400).json({ error: 'Amount received must be greater than zero.' });
    const payoutStatus = status || 'Under Review';
    if (!PAYOUT_STATUSES.includes(payoutStatus)) return res.status(400).json({ error: `Status must be one of: ${PAYOUT_STATUSES.join(', ')}.` });
    try {
        const hospital = await dbGet('SELECT * FROM hospitals WHERE id = ? AND user_id = ?', [hospital_id, req.userId]);
        if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });

        const result = await dbRun(
            `INSERT INTO payouts (user_id, hospital_id, date, period, actual_net, transaction_ref, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.userId, hospital_id, date, period || null, amount, transaction_ref || null, notes || null, payoutStatus]
        );
        const payout = await dbGet(
            `SELECT py.*, h.name as hospital_name FROM payouts py JOIN hospitals h ON py.hospital_id = h.id WHERE py.id = ?`,
            [result.lastID]
        );
        res.json(payout);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create payout.' });
    }
});

app.put('/api/payouts/:id', auth, async (req, res) => {
    const fields = ['status', 'actual_net', 'transaction_ref', 'notes', 'date', 'period'];
    if (req.body.status !== undefined && !PAYOUT_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ error: `Status must be one of: ${PAYOUT_STATUSES.join(', ')}.` });
    }
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
        const r = await dbRun(`UPDATE payouts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
        if (r.changes === 0) return res.status(404).json({ error: 'Payout not found.' });
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

        const money = await moneySummary(req.userId);
        const hospitalCount = await dbGet('SELECT COUNT(*) as count FROM hospitals WHERE user_id = ?', [req.userId]);
        const collectionRate = money.earned > 0 ? (money.received / money.earned * 100) : 0;

        const recentProcedures = await dbAll(
            `SELECT p.*, h.name as hospital_name
             FROM procedures p
             JOIN hospitals h ON p.hospital_id = h.id
             WHERE p.user_id = ?
             ORDER BY p.date DESC, p.id DESC
             LIMIT 5`,
            [req.userId]
        );

        const hospitalSummary = await hospitalMoney(req.userId);

        const alerts = [];
        const rejected = await dbAll(
            `SELECT py.*, h.name as hospital_name FROM payouts py JOIN hospitals h ON py.hospital_id = h.id WHERE py.user_id = ? AND py.status = 'Rejected' ORDER BY py.date DESC LIMIT 5`,
            [req.userId]
        );
        for (const r of rejected) {
            alerts.push({ type: 'rejected', message: `Payment of ${r.actual_net} from ${r.hospital_name} on ${r.date} was rejected${r.notes ? `: ${r.notes}` : ''}`, severity: 'error' });
        }
        if (money.underReview > 0) {
            alerts.push({ type: 'review', message: `${money.underReviewCount} payment(s) awaiting verification`, severity: 'warning' });
        }

        res.json({
            totalBilled: totals.totalBilled,
            earned: money.earned,
            received: money.received,
            underReview: money.underReview,
            pending: money.pending,
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

// Earned comes from entries, received/under review from payment records; pending is the remainder.
async function moneySummary(userId, hospitalId = null) {
    const scope = hospitalId ? 'AND hospital_id = ?' : '';
    const params = hospitalId ? [userId, hospitalId] : [userId];
    const e = await dbGet(`SELECT COALESCE(SUM(net_expected), 0) as earned FROM procedures WHERE user_id = ? ${scope}`, params);
    const p = await dbGet(
        `SELECT COALESCE(SUM(CASE WHEN status IN ('Paid', 'Partially Paid') THEN actual_net END), 0) as received,
                COALESCE(SUM(CASE WHEN status = 'Under Review' THEN actual_net END), 0) as underReview,
                SUM(CASE WHEN status = 'Under Review' THEN 1 ELSE 0 END) as underReviewCount
         FROM payouts WHERE user_id = ? ${scope}`, params);
    return {
        earned: e.earned,
        received: p.received,
        underReview: p.underReview,
        underReviewCount: p.underReviewCount || 0,
        pending: Math.max(0, e.earned - p.received - p.underReview),
    };
}

async function hospitalMoney(userId) {
    const hospitals = await dbAll(
        `SELECT h.id, h.name, COUNT(p.id) as procedure_count, COALESCE(SUM(p.gross_amount), 0) as total_billed
         FROM hospitals h LEFT JOIN procedures p ON p.hospital_id = h.id
         WHERE h.user_id = ? GROUP BY h.id ORDER BY h.name`, [userId]);
    for (const h of hospitals) {
        const m = await moneySummary(userId, h.id);
        h.earned = m.earned; h.received = m.received; h.under_review = m.underReview; h.pending = m.pending;
    }
    return hospitals;
}

// ── Reconciliation ──

app.get('/api/reconciliation', auth, async (req, res) => {
    try {
        const summary = await moneySummary(req.userId);
        const hospitals = await hospitalMoney(req.userId);
        const totals = await dbGet(
            `SELECT COALESCE(SUM(tds_amount), 0) as totalTds, COALESCE(SUM(deduction_amount), 0) as totalDeductions FROM procedures WHERE user_id = ?`,
            [req.userId]
        );
        const payouts = await dbAll(
            `SELECT py.*, h.name as hospital_name FROM payouts py JOIN hospitals h ON py.hospital_id = h.id WHERE py.user_id = ? ORDER BY py.date DESC, py.id DESC`,
            [req.userId]
        );
        res.json({ summary, hospitals, totalTds: totals.totalTds, totalDeductions: totals.totalDeductions, payouts });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load reconciliation.' });
    }
});

// ── Admin Routes ──

app.get('/api/admin/dashboard', adminAuth, async (req, res) => {
    try {
        const userCount = await dbGet('SELECT COUNT(*) as count FROM users');
        const doctorCount = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'doctor'");
        const activeUsers = await dbGet("SELECT COUNT(*) as count FROM users WHERE status = 'active'");
        const hospitalCount = await dbGet('SELECT COUNT(*) as count FROM hospitals');
        const procedureCount = await dbGet('SELECT COUNT(*) as count FROM procedures');
        const totalRevenue = await dbGet('SELECT COALESCE(SUM(gross_amount), 0) as total FROM procedures');
        const totalPaid = await dbGet("SELECT COALESCE(SUM(actual_net), 0) as total FROM payouts WHERE status IN ('Paid', 'Partially Paid')");
        const pendingPayouts = await dbGet("SELECT COUNT(*) as count FROM payouts WHERE status IN ('Pending', 'Under Review')");
        const recentUsers = await dbAll('SELECT id, username, email, name, role, status, created_at, last_login FROM users ORDER BY created_at DESC LIMIT 5');
        const recentPayouts = await dbAll(`
            SELECT py.*, h.name as hospital_name, u.name as doctor_name
            FROM payouts py JOIN hospitals h ON py.hospital_id = h.id JOIN users u ON py.user_id = u.id
            ORDER BY py.created_at DESC LIMIT 10
        `);
        res.json({
            totalDoctors: doctorCount.count, activeUsers: activeUsers.count,
            totalHospitals: hospitalCount.count, totalProcedures: procedureCount.count,
            totalRevenue: totalRevenue.total, totalPaid: totalPaid.total,
            pendingPayouts: pendingPayouts.count, recentUsers, recentPayouts
        });
    } catch (err) { res.status(500).json({ error: 'Failed to load admin dashboard.' }); }
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
    try {
        const users = await dbAll('SELECT id, username, email, name, role, status, created_at, last_login FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (err) { res.status(500).json({ error: 'Failed to fetch users.' }); }
});

app.put('/api/admin/users/:id/status', adminAuth, async (req, res) => {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    try {
        await dbRun('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
        await dbRun('INSERT INTO audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
            [req.userId, status === 'active' ? 'activate_user' : 'deactivate_user', 'user', req.params.id, `User status changed to ${status}`]);
        const user = await dbGet('SELECT id, username, email, name, role, status, created_at, last_login FROM users WHERE id = ?', [req.params.id]);
        res.json(user);
    } catch (err) { res.status(500).json({ error: 'Failed to update user status.' }); }
});

app.get('/api/admin/hospitals', adminAuth, async (req, res) => {
    try {
        const hospitals = await dbAll(`SELECT h.*, u.name as doctor_name, u.username as doctor_username
            FROM hospitals h JOIN users u ON h.user_id = u.id ORDER BY h.created_at DESC`);
        res.json(hospitals);
    } catch (err) { res.status(500).json({ error: 'Failed to fetch hospitals.' }); }
});

app.get('/api/admin/payments', adminAuth, async (req, res) => {
    try {
        const payments = await dbAll(`SELECT py.*, h.name as hospital_name, u.name as doctor_name, u.username as doctor_username
            FROM payouts py JOIN hospitals h ON py.hospital_id = h.id JOIN users u ON py.user_id = u.id
            ORDER BY py.created_at DESC`);
        res.json(payments);
    } catch (err) { res.status(500).json({ error: 'Failed to fetch payments.' }); }
});

app.put('/api/admin/payments/:id/approve', adminAuth, async (req, res) => {
    try {
        await dbRun("UPDATE payouts SET status = 'Paid' WHERE id = ?", [req.params.id]);
        await dbRun('INSERT INTO audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
            [req.userId, 'approve_payment', 'payout', req.params.id, 'Payment approved']);
        const payout = await dbGet(`SELECT py.*, h.name as hospital_name, u.name as doctor_name
            FROM payouts py JOIN hospitals h ON py.hospital_id = h.id JOIN users u ON py.user_id = u.id WHERE py.id = ?`, [req.params.id]);
        res.json(payout);
    } catch (err) { res.status(500).json({ error: 'Failed to approve payment.' }); }
});

app.put('/api/admin/payments/:id/reject', adminAuth, async (req, res) => {
    const { reason } = req.body;
    try {
        await dbRun("UPDATE payouts SET status = 'Rejected', notes = ? WHERE id = ?", [reason || 'Rejected by admin', req.params.id]);
        await dbRun('INSERT INTO audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
            [req.userId, 'reject_payment', 'payout', req.params.id, reason || 'Payment rejected']);
        const payout = await dbGet(`SELECT py.*, h.name as hospital_name, u.name as doctor_name
            FROM payouts py JOIN hospitals h ON py.hospital_id = h.id JOIN users u ON py.user_id = u.id WHERE py.id = ?`, [req.params.id]);
        res.json(payout);
    } catch (err) { res.status(500).json({ error: 'Failed to reject payment.' }); }
});

app.get('/api/admin/reports', adminAuth, async (req, res) => {
    const { month } = req.query;
    try {
        let dateFilter = '', params = [];
        if (month) { dateFilter = "AND p.date LIKE ?"; params = [month + '%']; }
        const proceduresByHospital = await dbAll(`
            SELECT h.name as hospital_name, u.name as doctor_name, COUNT(p.id) as procedure_count,
                COALESCE(SUM(p.gross_amount), 0) as total_billed, COALESCE(SUM(p.net_expected), 0) as total_expected,
                COALESCE(SUM(p.tds_amount), 0) as total_tds
            FROM procedures p JOIN hospitals h ON p.hospital_id = h.id JOIN users u ON p.user_id = u.id
            WHERE 1=1 ${dateFilter} GROUP BY h.id, u.id ORDER BY total_billed DESC`, params);
        const paymentSummary = await dbAll(`SELECT py.status, COUNT(*) as count, COALESCE(SUM(py.actual_net), 0) as total
            FROM payouts py ${month ? "WHERE py.date LIKE ?" : ""} GROUP BY py.status`, month ? [month + '%'] : []);
        const monthlyTrend = await dbAll(`SELECT strftime('%Y-%m', p.date) as month, COUNT(p.id) as procedures,
            COALESCE(SUM(p.gross_amount), 0) as billed, COALESCE(SUM(p.net_expected), 0) as expected
            FROM procedures p GROUP BY strftime('%Y-%m', p.date) ORDER BY month DESC LIMIT 12`);
        res.json({ proceduresByHospital, paymentSummary, monthlyTrend });
    } catch (err) { res.status(500).json({ error: 'Failed to generate reports.' }); }
});

app.put('/api/admin/password', adminAuth, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Current and new password are required.' });
    if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    try {
        const user = await dbGet('SELECT id FROM users WHERE id = ? AND password_hash = ?', [req.userId, hashPassword(current_password)]);
        if (!user) return res.status(401).json({ error: 'Current password is incorrect.' });
        await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(new_password), req.userId]);
        await dbRun('INSERT INTO audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
            [req.userId, 'change_password', 'user', req.userId, 'Admin password changed']);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to change password.' }); }
});

app.get('/api/admin/audit-logs', adminAuth, async (req, res) => {
    try {
        const logs = await dbAll(`SELECT al.*, u.name as admin_name, u.username as admin_username
            FROM audit_logs al JOIN users u ON al.admin_id = u.id ORDER BY al.created_at DESC LIMIT 200`);
        res.json(logs);
    } catch (err) { res.status(500).json({ error: 'Failed to fetch audit logs.' }); }
});

app.get('/', (req, res) => res.json({
    status: 'ok',
    database: db.label.startsWith('Turso') ? 'turso' : 'local-file',
    ...(db.error && { database_error: db.error })
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
