import express from 'express';
import cors from 'cors';
import db from './db.js';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

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
        const result = await dbRun(`UPDATE hospitals SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
        if (result.changes === 0) return res.status(404).json({ error: 'Hospital not found.' });
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
    const { hospital_id, date, period, actual_net, expected_net, transaction_ref, notes, status } = req.body;
    if (!hospital_id || !date) return res.status(400).json({ error: 'hospital_id and date are required.' });
    const amount = Number(actual_net);
    if (!(amount > 0)) return res.status(400).json({ error: 'Amount received must be greater than zero.' });
    const total = Math.max(0, Number(expected_net) || 0);
    // Total payable (expected_net) lets a payment show outstanding/progress; the status is derived from the amounts.
    let payoutStatus = status || 'Under Review';
    if (!PAYOUT_STATUSES.includes(payoutStatus)) return res.status(400).json({ error: `Status must be one of: ${PAYOUT_STATUSES.join(', ')}.` });
    if (total > 0 && payoutStatus !== 'Under Review') payoutStatus = amount >= total ? 'Paid' : 'Partially Paid';
    try {
        const hospital = await dbGet('SELECT * FROM hospitals WHERE id = ? AND user_id = ?', [hospital_id, req.userId]);
        if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });

        const shortfall = total > 0 ? Math.max(0, total - amount) : 0;
        const result = await dbRun(
            `INSERT INTO payouts (user_id, hospital_id, date, period, actual_net, expected_net, shortfall, transaction_ref, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.userId, hospital_id, date, period || null, amount, total, shortfall, transaction_ref || null, notes || null, payoutStatus]
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
    // status, expected_net and shortfall are derived below; the rest are copied through.
    const fields = ['actual_net', 'transaction_ref', 'notes', 'date', 'period'];
    if (req.body.status !== undefined && !PAYOUT_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ error: `Status must be one of: ${PAYOUT_STATUSES.join(', ')}.` });
    }
    try {
        const existing = await dbGet('SELECT * FROM payouts WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        if (!existing) return res.status(404).json({ error: 'Payout not found.' });

        const sets = [];
        const params = [];
        for (const f of fields) {
            if (req.body[f] !== undefined) {
                sets.push(`${f} = ?`);
                params.push(req.body[f]);
            }
        }

        let total = req.body.expected_net !== undefined ? Math.max(0, Number(req.body.expected_net) || 0) : existing.expected_net;
        const received = req.body.actual_net !== undefined ? Number(req.body.actual_net) || 0 : existing.actual_net;
        let effStatus = req.body.status !== undefined ? req.body.status : existing.status;
        let clearTotal = false;
        if (req.body.status === 'Paid') {
            // Explicit "Fully Paid" always wins — clear any partial total so it is fully settled (no Paid-with-shortfall).
            total = 0;
            clearTotal = true;
        } else if (total > 0 && effStatus !== 'Under Review' && effStatus !== 'Rejected') {
            // Derive from amounts so a record can never be Paid with money outstanding.
            effStatus = received >= total ? 'Paid' : 'Partially Paid';
        }
        if (req.body.expected_net !== undefined || clearTotal) { sets.push('expected_net = ?'); params.push(total); }
        sets.push('status = ?'); params.push(effStatus);
        sets.push('shortfall = ?'); params.push(total > 0 ? Math.max(0, total - received) : 0);

        params.push(req.params.id, req.userId);
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
            toBeSettled: money.toBeSettled,
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
        // What still needs settling: everything earned that has not been confirmed received (Under Review not counted as received).
        toBeSettled: Math.max(0, e.earned - p.received),
    };
}

async function hospitalMoney(userId) {
    const hospitals = await dbAll(
        `SELECT h.id, h.name, COUNT(p.id) as procedure_count, COALESCE(SUM(p.gross_amount), 0) as total_billed
         FROM hospitals h LEFT JOIN procedures p ON p.hospital_id = h.id
         WHERE h.user_id = ? GROUP BY h.id ORDER BY h.name`, [userId]);
    for (const h of hospitals) {
        const m = await moneySummary(userId, h.id);
        h.earned = m.earned; h.received = m.received; h.under_review = m.underReview; h.pending = m.pending; h.to_be_settled = m.toBeSettled;
    }
    return hospitals;
}

app.get('/api/analytics', auth, async (req, res) => {
    try {
        const summary = await moneySummary(req.userId);
        const hospitalCount = await dbGet('SELECT COUNT(*) as c FROM hospitals WHERE user_id = ?', [req.userId]);
        const svcCount = await dbGet('SELECT COUNT(*) as c FROM services WHERE user_id = ?', [req.userId]);
        const t = await dbGet('SELECT COUNT(*) as entries, COALESCE(SUM(cases), 0) as rendered, COALESCE(SUM(gross_amount), 0) as revenue FROM procedures WHERE user_id = ?', [req.userId]);

        // Group by the base service name, stripping any " — <type>" suffix from the stored label.
        const servicesByType = await dbAll(
            `SELECT CASE WHEN instr(procedure_type, ' — ') > 0
                        THEN substr(procedure_type, 1, instr(procedure_type, ' — ') - 1)
                        ELSE procedure_type END as name,
                    COUNT(*) as count, COALESCE(SUM(cases), 0) as rendered,
                    COALESCE(SUM(gross_amount), 0) as revenue, COALESCE(SUM(net_expected), 0) as earned
             FROM procedures WHERE user_id = ?
             GROUP BY name ORDER BY revenue DESC`, [req.userId]);

        const revenueByHospital = await hospitalMoney(req.userId);

        const monthlyTrend = await dbAll(
            `SELECT strftime('%Y-%m', date) as month, COUNT(*) as entries,
                    COALESCE(SUM(gross_amount), 0) as revenue, COALESCE(SUM(net_expected), 0) as earned
             FROM procedures WHERE user_id = ? GROUP BY month ORDER BY month`, [req.userId]);

        const paymentStatus = await dbAll(
            `SELECT status, COUNT(*) as count, COALESCE(SUM(actual_net), 0) as amount
             FROM payouts WHERE user_id = ? GROUP BY status`, [req.userId]);

        res.json({
            totals: {
                entries: t.entries, rendered: t.rendered, revenue: t.revenue,
                configuredServices: svcCount.c, hospitals: hospitalCount.c,
                earned: summary.earned, received: summary.received, pending: summary.pending,
                underReview: summary.underReview, toBeSettled: summary.toBeSettled,
            },
            servicesByType, revenueByHospital, monthlyTrend, paymentStatus,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load analytics.' });
    }
});

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

// ── Support Queries ──

const QUERY_STATUSES = ['Open', 'In Progress', 'Awaiting User Response', 'Resolved', 'Closed'];
const QUERY_CATEGORIES = ['Technical Issue', 'Software Functionality', 'Payment Discrepancy', 'Account Issue', 'Feature Request', 'General Query'];
const QUERY_PRIORITIES = ['Low', 'Medium', 'High'];

const pad2 = (n) => String(n).padStart(2, '0');
async function nextQueryCode() {
    const d = new Date();
    const prefix = `QRY-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-`;
    const row = await dbGet('SELECT COUNT(*) as c FROM queries WHERE query_code LIKE ?', [prefix + '%']);
    return prefix + String((row.c || 0) + 1).padStart(3, '0');
}
async function addQueryHistory(qid, actorId, role, action, oldS, newS, detail) {
    await dbRun('INSERT INTO query_history (query_id, actor_id, actor_role, action, old_status, new_status, detail) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [qid, actorId, role, action, oldS || null, newS || null, detail || null]);
}
function validateAttachment(att) {
    if (!att || !att.dataUri) return { ok: true, name: null, data: null };
    if (typeof att.dataUri !== 'string') return { ok: false, error: 'Invalid attachment.' };
    const m = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/.exec(att.dataUri);
    if (!m) return { ok: false, error: 'Attachment must be a PNG, JPEG or WebP image.' };
    const bytes = Math.floor(m[2].length * 3 / 4);
    if (bytes > 2 * 1024 * 1024) return { ok: false, error: 'Attachment must be under 2 MB.' };
    const safeName = String(att.name || 'attachment').replace(/[^\w.\- ]/g, '').slice(0, 120) || 'attachment';
    return { ok: true, name: safeName, data: att.dataUri };
}

// User: create a query
app.post('/api/queries', auth, async (req, res) => {
    const { subject, category, description, priority, attachment } = req.body;
    if (!subject?.trim() || !category || !description?.trim() || !priority) return res.status(400).json({ error: 'Subject, category, description and priority are required.' });
    if (!QUERY_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category.' });
    if (!QUERY_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority.' });
    const att = validateAttachment(attachment);
    if (!att.ok) return res.status(400).json({ error: att.error });
    try {
        let lastID;
        for (let i = 0; i < 5; i++) {
            const code = await nextQueryCode();
            try {
                const r = await dbRun(
                    'INSERT INTO queries (query_code, user_id, subject, category, description, priority, status, attachment_name, attachment_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [code, req.userId, subject.trim(), category, description.trim(), priority, 'Open', att.name, att.data]);
                lastID = r.lastID;
                break;
            } catch (e) { if (!String(e.message).includes('UNIQUE')) throw e; }
        }
        if (!lastID) return res.status(500).json({ error: 'Could not generate a query ID, please retry.' });
        await addQueryHistory(lastID, req.userId, 'doctor', 'Query Created', null, 'Open', null);
        const q = await dbGet('SELECT id, query_code, subject, category, priority, status, created_at FROM queries WHERE id = ?', [lastID]);
        res.json(q);
    } catch (err) { res.status(500).json({ error: 'Failed to submit query.' }); }
});

// User: own queries
app.get('/api/queries/my', auth, async (req, res) => {
    try {
        const rows = await dbAll(
            `SELECT q.id, q.query_code, q.subject, q.category, q.priority, q.status, q.created_at, q.updated_at,
                    a.name as assigned_to_name
             FROM queries q LEFT JOIN users a ON q.assigned_to = a.id
             WHERE q.user_id = ? ORDER BY q.created_at DESC`, [req.userId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Failed to load queries.' }); }
});

app.get('/api/queries/unread', auth, async (req, res) => {
    try {
        const r = await dbGet(`SELECT COUNT(*) as c FROM queries WHERE user_id = ? AND status = 'Awaiting User Response'`, [req.userId]);
        res.json({ count: r.c || 0 });
    } catch (err) { res.json({ count: 0 }); }
});

// User: own query detail (excludes internal notes)
app.get('/api/queries/:id', auth, async (req, res) => {
    try {
        const q = await dbGet(`SELECT q.*, a.name as assigned_to_name FROM queries q LEFT JOIN users a ON q.assigned_to = a.id WHERE q.id = ? AND q.user_id = ?`, [req.params.id, req.userId]);
        if (!q) return res.status(404).json({ error: 'Query not found.' });
        const messages = await dbAll(
            `SELECT m.sender_role, m.message, m.created_at, u.name as sender_name
             FROM query_messages m JOIN users u ON m.sender_id = u.id
             WHERE m.query_id = ? AND m.is_internal = 0 ORDER BY m.created_at`, [q.id]);
        const history = await dbAll(
            `SELECT action, old_status, new_status, detail, actor_role, created_at FROM query_history
             WHERE query_id = ? AND action != 'Internal Note' ORDER BY created_at`, [q.id]);
        res.json({ ...q, messages, history });
    } catch (err) { res.status(500).json({ error: 'Failed to load query.' }); }
});

// User: reply to own query
app.post('/api/queries/:id/messages', auth, async (req, res) => {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required.' });
    try {
        const q = await dbGet('SELECT * FROM queries WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        if (!q) return res.status(404).json({ error: 'Query not found.' });
        if (q.status === 'Closed') return res.status(400).json({ error: 'This query is closed. Reopen it from support if needed.' });
        await dbRun('INSERT INTO query_messages (query_id, sender_id, sender_role, message, is_internal) VALUES (?, ?, ?, ?, 0)', [q.id, req.userId, 'doctor', message.trim()]);
        const newStatus = (q.status === 'Awaiting User Response' || q.status === 'Resolved') ? 'In Progress' : q.status;
        await dbRun('UPDATE queries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, q.id]);
        await addQueryHistory(q.id, req.userId, 'doctor', 'User Response', newStatus !== q.status ? q.status : null, newStatus !== q.status ? newStatus : null, null);
        res.json({ success: true, status: newStatus });
    } catch (err) { res.status(500).json({ error: 'Failed to send reply.' }); }
});

// Admin: summary counts
app.get('/api/admin/queries/summary', adminAuth, async (req, res) => {
    try {
        const rows = await dbAll('SELECT status, COUNT(*) as c FROM queries GROUP BY status');
        const by = Object.fromEntries(rows.map(r => [r.status, r.c]));
        res.json({ total: rows.reduce((s, r) => s + r.c, 0), open: by['Open'] || 0, inProgress: by['In Progress'] || 0, awaiting: by['Awaiting User Response'] || 0, resolved: by['Resolved'] || 0, closed: by['Closed'] || 0 });
    } catch (err) { res.status(500).json({ error: 'Failed to load summary.' }); }
});

app.get('/api/admin/queries/assignees', adminAuth, async (req, res) => {
    try {
        const rows = await dbAll(`SELECT id, name, username FROM users WHERE role = 'admin' AND status = 'active' ORDER BY name`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// Admin: all queries with search/filter/sort
app.get('/api/admin/queries', adminAuth, async (req, res) => {
    const { status, category, priority, search, from, to, sort } = req.query;
    try {
        const where = [], params = [];
        if (status && QUERY_STATUSES.includes(status)) { where.push('q.status = ?'); params.push(status); }
        if (category && QUERY_CATEGORIES.includes(category)) { where.push('q.category = ?'); params.push(category); }
        if (priority && QUERY_PRIORITIES.includes(priority)) { where.push('q.priority = ?'); params.push(priority); }
        if (from) { where.push('q.created_at >= ?'); params.push(from + ' 00:00:00'); }
        if (to) { where.push('q.created_at <= ?'); params.push(to + ' 23:59:59'); }
        if (search) { where.push('(q.query_code LIKE ? OR q.subject LIKE ? OR u.name LIKE ?)'); const s = '%' + search + '%'; params.push(s, s, s); }
        let order = 'q.created_at DESC';
        if (sort === 'oldest') order = 'q.created_at ASC';
        else if (sort === 'priority_high') order = "CASE q.priority WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 ELSE 1 END DESC, q.created_at DESC";
        else if (sort === 'priority_low') order = "CASE q.priority WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 ELSE 1 END ASC, q.created_at DESC";
        const rows = await dbAll(
            `SELECT q.id, q.query_code, q.subject, q.category, q.priority, q.status, q.created_at, q.assigned_to,
                    u.name as user_name, u.email as user_email, a.name as assigned_to_name
             FROM queries q JOIN users u ON q.user_id = u.id LEFT JOIN users a ON q.assigned_to = a.id
             ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order}`, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Failed to load queries.' }); }
});

// Admin: full detail (includes internal notes)
app.get('/api/admin/queries/:id', adminAuth, async (req, res) => {
    try {
        const q = await dbGet(
            `SELECT q.*, u.name as user_name, u.email as user_email, a.name as assigned_to_name
             FROM queries q JOIN users u ON q.user_id = u.id LEFT JOIN users a ON q.assigned_to = a.id WHERE q.id = ?`, [req.params.id]);
        if (!q) return res.status(404).json({ error: 'Query not found.' });
        const messages = await dbAll(
            `SELECT m.sender_role, m.message, m.is_internal, m.created_at, u.name as sender_name
             FROM query_messages m JOIN users u ON m.sender_id = u.id WHERE m.query_id = ? ORDER BY m.created_at`, [q.id]);
        const history = await dbAll(
            `SELECT h.action, h.old_status, h.new_status, h.detail, h.actor_role, h.created_at, u.name as actor_name
             FROM query_history h LEFT JOIN users u ON h.actor_id = u.id WHERE h.query_id = ? ORDER BY h.created_at`, [q.id]);
        res.json({ ...q, messages, history });
    } catch (err) { res.status(500).json({ error: 'Failed to load query.' }); }
});

app.patch('/api/admin/queries/:id/status', adminAuth, async (req, res) => {
    const { status } = req.body;
    if (!QUERY_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    try {
        const q = await dbGet('SELECT * FROM queries WHERE id = ?', [req.params.id]);
        if (!q) return res.status(404).json({ error: 'Query not found.' });
        const extra = status === 'Resolved' ? ', resolved_at = CURRENT_TIMESTAMP' : (status === 'Open' ? ', resolved_at = NULL' : '');
        await dbRun(`UPDATE queries SET status = ?, updated_at = CURRENT_TIMESTAMP ${extra} WHERE id = ?`, [status, q.id]);
        const reopen = status === 'Open' && (q.status === 'Resolved' || q.status === 'Closed');
        const action = status === 'Resolved' ? 'Query Resolved' : reopen ? 'Query Reopened' : status === 'Closed' ? 'Query Closed' : 'Status Changed';
        await addQueryHistory(q.id, req.userId, 'admin', action, q.status, status, null);
        res.json({ success: true, status });
    } catch (err) { res.status(500).json({ error: 'Failed to change status.' }); }
});

app.patch('/api/admin/queries/:id/assign', adminAuth, async (req, res) => {
    const { assigned_to } = req.body;
    try {
        const q = await dbGet('SELECT id FROM queries WHERE id = ?', [req.params.id]);
        if (!q) return res.status(404).json({ error: 'Query not found.' });
        let name = null;
        if (assigned_to) {
            const a = await dbGet(`SELECT name FROM users WHERE id = ? AND role = 'admin'`, [assigned_to]);
            if (!a) return res.status(400).json({ error: 'Invalid assignee.' });
            name = a.name;
        }
        await dbRun('UPDATE queries SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [assigned_to || null, req.params.id]);
        await addQueryHistory(req.params.id, req.userId, 'admin', 'Admin Assigned', null, null, name ? `Assigned to ${name}` : 'Unassigned');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to assign.' }); }
});

app.post('/api/admin/queries/:id/respond', adminAuth, async (req, res) => {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Response is required.' });
    try {
        const q = await dbGet('SELECT * FROM queries WHERE id = ?', [req.params.id]);
        if (!q) return res.status(404).json({ error: 'Query not found.' });
        await dbRun('INSERT INTO query_messages (query_id, sender_id, sender_role, message, is_internal) VALUES (?, ?, ?, ?, 0)', [q.id, req.userId, 'admin', message.trim()]);
        await dbRun("UPDATE queries SET status = 'Awaiting User Response', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [q.id]);
        await addQueryHistory(q.id, req.userId, 'admin', 'Admin Response', q.status, 'Awaiting User Response', null);
        res.json({ success: true, status: 'Awaiting User Response' });
    } catch (err) { res.status(500).json({ error: 'Failed to send response.' }); }
});

app.post('/api/admin/queries/:id/internal-note', adminAuth, async (req, res) => {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Note is required.' });
    try {
        const q = await dbGet('SELECT id FROM queries WHERE id = ?', [req.params.id]);
        if (!q) return res.status(404).json({ error: 'Query not found.' });
        await dbRun('INSERT INTO query_messages (query_id, sender_id, sender_role, message, is_internal) VALUES (?, ?, ?, ?, 1)', [q.id, req.userId, 'admin', message.trim()]);
        await addQueryHistory(q.id, req.userId, 'admin', 'Internal Note', null, null, null);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to add note.' }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
