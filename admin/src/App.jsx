import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Users, Building2, CreditCard, FileBarChart, ScrollText, LogOut, Shield, Eye, EyeOff, CheckCircle, Clock, Settings, LifeBuoy, Menu, Bell, ChevronDown } from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api';

async function api(path, opts = {}) {
  const session = JSON.parse(localStorage.getItem('adminSession') || 'null');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (session?.id) headers['x-user-id'] = session.id;
  let res;
  try {
    res = await fetch(API + path, { ...opts, headers });
  } catch {
    // The free host sleeps when idle; the first request after that fails outright.
    throw new Error('Could not reach the server — it may be waking up. Please try again in a few seconds.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatCurrency(n) {
  return '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function StatusBadge({ status }) {
  const cls = {
    active: 'badge-active', inactive: 'badge-inactive', Paid: 'badge-paid', 'Partially Paid': 'badge-doctor',
    Rejected: 'badge-rejected', Pending: 'badge-pending', 'Under Review': 'badge-under-review',
    admin: 'badge-admin', doctor: 'badge-doctor'
  };
  return <span className={`badge ${cls[status] || 'badge-pending'}`}>{status}</span>;
}

// ── Login ──
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await api('/auth/login', {
        method: 'POST', body: JSON.stringify({ username, password })
      });
      if (user.role !== 'admin') {
        setError('Admin access only. This account does not have admin privileges.');
        setLoading(false);
        return;
      }
      localStorage.setItem('adminSession', JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1><Shield size={24} /> DocTrack Admin</h1>
        <p>Sign in to the admin dashboard</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  );
}

// ── Dashboard ──
function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/admin/dashboard').then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (!data) return <div className="empty-state">Failed to load dashboard</div>;

  return (
    <>
      <div className="page-header"><h1>Dashboard</h1><p>System overview and recent activity</p></div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon indigo"><Users size={20} /></div>
          <div className="stat-value">{data.totalDoctors}</div>
          <div className="stat-label">Total Doctors</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle size={20} /></div>
          <div className="stat-value">{data.activeUsers}</div>
          <div className="stat-label">Active Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><FileBarChart size={20} /></div>
          <div className="stat-value">{data.totalProcedures}</div>
          <div className="stat-label">Total Procedures</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><Clock size={20} /></div>
          <div className="stat-value">{data.pendingPayouts}</div>
          <div className="stat-label">Pending Payments</div>
        </div>
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-header">Recent Users</div>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {data.recentUsers.map(u => (
                <tr key={u.id}><td>{u.name}</td><td><StatusBadge status={u.role} /></td><td><StatusBadge status={u.status || 'active'} /></td><td>{formatDate(u.created_at)}</td></tr>
              ))}
              {data.recentUsers.length === 0 && <tr><td colSpan={4} className="empty-state">No users yet</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-header">Recent Payouts</div>
          <table className="data-table">
            <thead><tr><th>Doctor</th><th>Hospital</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {data.recentPayouts.map(p => (
                <tr key={p.id}><td>{p.doctor_name}</td><td>{p.hospital_name}</td><td>{formatCurrency(p.actual_net)}</td><td><StatusBadge status={p.status} /></td></tr>
              ))}
              {data.recentPayouts.length === 0 && <tr><td colSpan={4} className="empty-state">No payouts yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Users ──
function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUsers(); }, []);
  async function loadUsers() {
    setLoading(true);
    try { setUsers(await api('/admin/users')); } catch {}
    setLoading(false);
  }

  async function toggleStatus(user) {
    const newStatus = (user.status || 'active') === 'active' ? 'inactive' : 'active';
    try {
      await api(`/admin/users/${user.id}/status`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
      loadUsers();
    } catch {}
  }

  if (loading) return <div className="loading">Loading users...</div>;

  return (
    <>
      <div className="page-header"><h1>Users Management</h1><p>Manage all registered users</p></div>
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.username}</td><td>{u.email}</td>
                <td><StatusBadge status={u.role} /></td>
                <td><StatusBadge status={u.status || 'active'} /></td>
                <td>{formatDate(u.last_login)}</td>
                <td>
                  {u.role !== 'admin' && (
                    <button className="btn-sm btn-toggle" onClick={() => toggleStatus(u)}>
                      {(u.status || 'active') === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Hospitals ──
function HospitalsPage() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/admin/hospitals').then(setHospitals).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading hospitals...</div>;

  return (
    <>
      <div className="page-header"><h1>All Hospitals</h1><p>Hospitals registered across all doctors</p></div>
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Hospital</th><th>Doctor</th><th>Location</th><th>Payment Rule</th><th>TDS Rate</th><th>Settlement</th></tr></thead>
          <tbody>
            {hospitals.map(h => (
              <tr key={h.id}>
                <td>{h.name}</td><td>{h.doctor_name}</td><td>{h.location}</td>
                <td>{h.payout_basis === 'fixed' ? `${formatCurrency(h.fixed_fee)} / case` : `${h.payout_percentage}% share`}</td><td>{h.tds_rate}%</td><td>{h.settlement_cycle}</td>
              </tr>
            ))}
            {hospitals.length === 0 && <tr><td colSpan={6} className="empty-state">No hospitals registered</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Payments ──
function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { loadPayments(); }, []);
  async function loadPayments() {
    setLoading(true);
    try { setPayments(await api('/admin/payments')); } catch {}
    setLoading(false);
  }

  async function approvePayment(id) {
    try { await api(`/admin/payments/${id}/approve`, { method: 'PUT' }); loadPayments(); } catch {}
  }

  async function rejectPayment() {
    if (!rejectModal) return;
    try {
      await api(`/admin/payments/${rejectModal}/reject`, { method: 'PUT', body: JSON.stringify({ reason: rejectReason }) });
      setRejectModal(null);
      setRejectReason('');
      loadPayments();
    } catch {}
  }

  const filters = ['All', 'Under Review', 'Paid', 'Partially Paid', 'Rejected'];
  const filtered = filter === 'All' ? payments : payments.filter(p => p.status === filter);

  if (loading) return <div className="loading">Loading payments...</div>;

  return (
    <>
      <div className="page-header"><h1>Payment Verification</h1><p>Review and approve doctor payouts</p></div>
      <div className="filter-bar">
        {filters.map(f => (
          <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f} {f !== 'All' && `(${payments.filter(p => f === 'All' || p.status === f).length})`}
          </button>
        ))}
      </div>
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Doctor</th><th>Hospital</th><th>Date</th><th>Amount</th><th>Reference</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td>{p.doctor_name}</td><td>{p.hospital_name}</td><td>{formatDate(p.date)}</td>
                <td>{formatCurrency(p.actual_net)}</td><td>{p.transaction_ref || '—'}</td>
                <td><StatusBadge status={p.status} />{p.status === 'Rejected' && p.notes && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.notes}</div>}</td>
                <td>
                  {p.status === 'Under Review' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-sm btn-approve" onClick={() => approvePayment(p.id)}>Approve</button>
                      <button className="btn-sm btn-reject" onClick={() => { setRejectModal(p.id); setRejectReason(''); }}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="empty-state">No payments found</td></tr>}
          </tbody>
        </table>
      </div>

      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Reject Payment</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>Please provide a reason for rejection:</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Enter rejection reason..." />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setRejectModal(null)}>Cancel</button>
              <button className="btn-sm btn-reject" style={{ padding: '8px 16px', fontSize: 14 }} onClick={rejectPayment}>Reject Payment</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Reports ──
function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');

  useEffect(() => { loadReports(); }, [month]);
  async function loadReports() {
    setLoading(true);
    try { setData(await api('/admin/reports' + (month ? `?month=${month}` : ''))); } catch {}
    setLoading(false);
  }

  if (loading) return <div className="loading">Loading reports...</div>;
  if (!data) return <div className="empty-state">Failed to load reports</div>;

  return (
    <>
      <div className="page-header">
        <h1>Reports</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Filter by month:</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)' }} />
          {month && <button className="btn-cancel" onClick={() => setMonth('')} style={{ fontSize: 12 }}>Clear</button>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Revenue by Hospital</div>
        <table className="data-table">
          <thead><tr><th>Hospital</th><th>Doctor</th><th>Procedures</th><th>Total Billed</th><th>Expected Net</th><th>TDS</th></tr></thead>
          <tbody>
            {data.proceduresByHospital.map((r, i) => (
              <tr key={i}><td>{r.hospital_name}</td><td>{r.doctor_name}</td><td>{r.procedure_count}</td><td>{formatCurrency(r.total_billed)}</td><td>{formatCurrency(r.total_expected)}</td><td>{formatCurrency(r.total_tds)}</td></tr>
            ))}
            {data.proceduresByHospital.length === 0 && <tr><td colSpan={6} className="empty-state">No data</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header">Payment Summary</div>
          <table className="data-table">
            <thead><tr><th>Status</th><th>Count</th><th>Total Amount</th></tr></thead>
            <tbody>
              {data.paymentSummary.map((r, i) => (
                <tr key={i}><td><StatusBadge status={r.status} /></td><td>{r.count}</td><td>{formatCurrency(r.total)}</td></tr>
              ))}
              {data.paymentSummary.length === 0 && <tr><td colSpan={3} className="empty-state">No data</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-header">Monthly Trend</div>
          <table className="data-table">
            <thead><tr><th>Month</th><th>Procedures</th><th>Billed</th><th>Expected</th></tr></thead>
            <tbody>
              {data.monthlyTrend.map((r, i) => (
                <tr key={i}><td>{r.month}</td><td>{r.procedures}</td><td>{formatCurrency(r.billed)}</td><td>{formatCurrency(r.expected)}</td></tr>
              ))}
              {data.monthlyTrend.length === 0 && <tr><td colSpan={4} className="empty-state">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Audit Logs ──
function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/admin/audit-logs').then(setLogs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading audit logs...</div>;

  return (
    <>
      <div className="page-header"><h1>Audit Logs</h1><p>Track all admin actions</p></div>
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Timestamp</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td>{formatDate(l.created_at)}</td><td>{l.admin_name}</td>
                <td><code style={{ background: 'var(--table-stripe)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{l.action}</code></td>
                <td>{l.target_type} #{l.target_id}</td><td>{l.details}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} className="empty-state">No audit logs yet</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Settings ──
function SettingsPage({ session }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) { setMsg({ type: 'error', text: 'New passwords do not match.' }); return; }
    setSaving(true);
    try {
      await api('/admin/password', { method: 'PUT', body: JSON.stringify({ current_password: current, new_password: next }) });
      setMsg({ type: 'success', text: 'Password updated.' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setSaving(false);
  }

  return (
    <>
      <div className="page-header"><h1>Settings</h1><p>Signed in as {session.name} ({session.username})</p></div>
      <div className="card" style={{ maxWidth: 440 }}>
        <div className="card-header">Change Password</div>
        <form onSubmit={handleSubmit} style={{ padding: 20 }}>
          {msg && <div className={msg.type === 'error' ? 'error-msg' : 'success-msg'}>{msg.text}</div>}
          <div className="form-group">
            <label>Current Password</label>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={next} onChange={e => setNext(e.target.value)} minLength={8} required />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Update Password'}</button>
        </form>
      </div>
    </>
  );
}

// ── Query Management ──

const Q_STATUSES = ['Open', 'In Progress', 'Awaiting User Response', 'Resolved', 'Closed']
const Q_CATEGORIES = ['Technical Issue', 'Software Functionality', 'Payment Discrepancy', 'Account Issue', 'Feature Request', 'General Query']
const Q_PRIORITIES = ['Low', 'Medium', 'High']
const qCls = (s) => ({ 'Open': 'q-open', 'In Progress': 'q-inprogress', 'Awaiting User Response': 'q-awaiting', 'Resolved': 'q-resolved', 'Closed': 'q-closed' }[s] || 'q-open')
const pCls = (p) => ({ High: 'q-high', Medium: 'q-medium', Low: 'q-low' }[p] || 'q-medium')
const QB = ({ status }) => <span className={`qbadge ${qCls(status)}`}>{status}</span>
const PB = ({ priority }) => <span className={`qbadge ${pCls(priority)}`}>{priority}</span>
const parseTs = (s) => new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + 'Z')
const fmtDT = (d) => { if (!d) return '—'; const t = parseTs(d); return isNaN(t) ? d : t.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
const Q_SYS = ['Query Created', 'Admin Assigned', 'Status Changed', 'Query Resolved', 'Query Reopened', 'Query Closed']
function adminTimeline(q) {
  const items = []
  for (const h of (q.history || [])) { if (!Q_SYS.includes(h.action)) continue; items.push({ kind: 'system', title: h.action + (h.actor_name ? ` · ${h.actor_name}` : ''), text: h.detail || null, status: h.new_status || null, at: h.created_at }) }
  for (const m of (q.messages || [])) { const kind = m.is_internal ? 'internal' : m.sender_role === 'admin' ? 'admin' : 'user'; items.push({ kind, title: m.is_internal ? 'Internal Note' : m.sender_role === 'admin' ? `${m.sender_name} · Support` : m.sender_name, text: m.message, at: m.created_at }) }
  return items.sort((a, b) => parseTs(a.at) - parseTs(b.at))
}

function QueryManagementPage() {
  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState({ search: '', status: '', category: '', priority: '', from: '', to: '', sort: 'newest' })
  const [detail, setDetail] = useState(null)
  const [assignees, setAssignees] = useState([])
  const [respond, setRespond] = useState('')
  const [note, setNote] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, v) })
    try {
      const [s, r] = await Promise.all([api('/admin/queries/summary'), api('/admin/queries?' + qs.toString())])
      setSummary(s); setRows(r)
    } catch { /* ignore */ }
    setLoading(false)
  }, [f])
  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { api('/admin/queries/assignees').then(setAssignees).catch(() => {}) }, [])

  async function openDetail(id) { setDetail({ loading: true }); setRespond(''); setNote(''); try { setDetail(await api('/admin/queries/' + id)) } catch (e) { setDetail({ error: e.message }) } }
  async function refresh() { if (detail?.id) { try { setDetail(await api('/admin/queries/' + detail.id)) } catch {} } loadList() }
  const act = (fn) => async (...a) => { try { await fn(...a); await refresh() } catch (e) { alert(e.message) } }
  const changeStatus = act((s) => api(`/admin/queries/${detail.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: s }) }))
  const assign = act((v) => api(`/admin/queries/${detail.id}/assign`, { method: 'PATCH', body: JSON.stringify({ assigned_to: v ? Number(v) : null }) }))
  const sendRespond = act(async () => { if (!respond.trim()) return; await api(`/admin/queries/${detail.id}/respond`, { method: 'POST', body: JSON.stringify({ message: respond }) }); setRespond('') })
  const sendNote = act(async () => { if (!note.trim()) return; await api(`/admin/queries/${detail.id}/internal-note`, { method: 'POST', body: JSON.stringify({ message: note }) }); setNote('') })
  const clearFilters = () => setF({ search: '', status: '', category: '', priority: '', from: '', to: '', sort: 'newest' })
  const active = f.search || f.status || f.category || f.priority || f.from || f.to || f.sort !== 'newest'

  const cards = summary ? [
    { label: 'Total Queries', value: summary.total, cls: 'indigo' },
    { label: 'Open', value: summary.open, cls: 'blue' },
    { label: 'In Progress', value: summary.inProgress, cls: 'amber' },
    { label: 'Awaiting Response', value: summary.awaiting, cls: 'purple' },
    { label: 'Resolved', value: summary.resolved, cls: 'green' },
  ] : []

  return (
    <>
      <div className="page-header"><h1>Query Management</h1><p>Support requests from doctors</p></div>

      <div className="q-summary">
        {cards.map(c => (
          <div key={c.label} className={`q-summary-card ${c.cls}`}>
            <span className="q-summary-value">{c.value}</span>
            <span className="q-summary-label">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="q-toolbar">
        <input className="q-input" placeholder="Search ID, subject or user…" value={f.search} onChange={e => setF({ ...f, search: e.target.value })} />
        <select className="q-input" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}><option value="">All statuses</option>{Q_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
        <select className="q-input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}><option value="">All categories</option>{Q_CATEGORIES.map(s => <option key={s}>{s}</option>)}</select>
        <select className="q-input" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}><option value="">All priorities</option>{Q_PRIORITIES.map(s => <option key={s}>{s}</option>)}</select>
        <input className="q-input" type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} title="From date" />
        <input className="q-input" type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} title="To date" />
        <select className="q-input" value={f.sort} onChange={e => setF({ ...f, sort: e.target.value })}>
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="priority_high">Highest priority</option><option value="priority_low">Lowest priority</option>
        </select>
        {active && <button className="btn-sm btn-toggle" onClick={clearFilters}>Clear</button>}
      </div>

      <div className="card">
        {loading ? <div className="loading">Loading queries…</div> : rows.length === 0 ? (
          <div className="empty-state">{active ? 'No queries match these filters.' : 'No support queries found.'}</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Query ID</th><th>User</th><th>Subject</th><th>Category</th><th>Priority</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map(q => (
                <tr key={q.id}>
                  <td>{q.query_code}</td>
                  <td>{q.user_name}</td>
                  <td>{q.subject}</td>
                  <td>{q.category}</td>
                  <td><PB priority={q.priority} /></td>
                  <td>{fmtDT(q.created_at)}</td>
                  <td><QB status={q.status} /></td>
                  <td><button className="btn-sm btn-toggle" onClick={() => openDetail(q.id)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal q-drawer" onClick={e => e.stopPropagation()}>
            {detail.loading ? <div className="loading">Loading…</div> : detail.error ? <div className="empty-state">{detail.error}</div> : (<>
              <div className="modal-header"><h3>{detail.query_code}</h3><button className="btn-ghost" onClick={() => setDetail(null)}>✕</button></div>
              <div className="q-drawer-body">
                <div className="q-drawer-main">
                  <div className="q-detail-head">
                    <div><h2 className="q-subject">{detail.subject}</h2><div className="q-meta">{detail.category} · <PB priority={detail.priority} /> · {fmtDT(detail.created_at)}</div></div>
                    <QB status={detail.status} />
                  </div>
                  <div className="q-user-row">{detail.user_name} · {detail.user_email}</div>
                  <p className="q-description">{detail.description}</p>
                  {detail.attachment_data && <a className="q-attachment" href={detail.attachment_data} target="_blank" rel="noreferrer">📎 {detail.attachment_name || 'Attachment'}</a>}

                  <h4 className="q-sub">Conversation & History</h4>
                  <div className="q-timeline">
                    {adminTimeline(detail).map((t, i) => (
                      <div key={i} className={`q-tl ${t.kind}`}>
                        <div className="q-tl-dot" />
                        <div className="q-tl-body">
                          <div className="q-tl-head"><strong>{t.title}</strong><span>{fmtDT(t.at)}</span></div>
                          {t.text && <div className="q-tl-text">{t.text}</div>}
                          {t.status && <div style={{ marginTop: 6 }}><QB status={t.status} /></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="q-drawer-side">
                  <label className="q-side-label">Status</label>
                  <select className="q-input" value={detail.status} onChange={e => changeStatus(e.target.value)}>{Q_STATUSES.map(s => <option key={s}>{s}</option>)}</select>

                  <label className="q-side-label">Assign to</label>
                  <select className="q-input" value={detail.assigned_to || ''} onChange={e => assign(e.target.value)}>
                    <option value="">Unassigned</option>
                    {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>

                  <div className="q-side-actions">
                    {(detail.status === 'Resolved' || detail.status === 'Closed')
                      ? <button className="btn-sm btn-toggle" onClick={() => changeStatus('Open')}>Reopen Query</button>
                      : <button className="btn-sm btn-approve" onClick={() => changeStatus('Resolved')}>Mark as Resolved</button>}
                  </div>

                  <label className="q-side-label">Respond to user</label>
                  <textarea className="q-input" rows={3} value={respond} onChange={e => setRespond(e.target.value)} placeholder="Write a response…" />
                  <button className="btn-sm btn-approve q-full" disabled={!respond.trim()} onClick={sendRespond}>Send Response</button>

                  <label className="q-side-label">Internal note <span className="q-internal-tag">admins only</span></label>
                  <textarea className="q-input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Private note…" />
                  <button className="btn-sm btn-toggle q-full" disabled={!note.trim()} onClick={sendNote}>Add Internal Note</button>
                </div>
              </div>
            </>)}
          </div>
        </div>
      )}
    </>
  )
}

// ── Main App ──
export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('adminSession')); } catch { return null; }
  });
  const [page, setPage] = useState('dashboard');
  const [queryBadge, setQueryBadge] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!session) return;
    let live = true;
    api('/admin/queries/summary').then(s => { if (live) setQueryBadge((s.open || 0) + (s.inProgress || 0)); }).catch(() => {});
    return () => { live = false; };
  }, [session, page]);

  function logout() {
    localStorage.removeItem('adminSession');
    setSession(null);
    setPage('dashboard');
  }

  if (!session) return <LoginPage onLogin={setSession} />;

  const navSections = [
    { title: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
    { title: 'Management', items: [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'hospitals', label: 'Hospitals', icon: Building2 },
      { id: 'payments', label: 'Payments', icon: CreditCard },
      { id: 'reports', label: 'Reports', icon: FileBarChart },
      { id: 'audit', label: 'Audit Logs', icon: ScrollText },
    ] },
    { title: 'Support', items: [{ id: 'queries', label: 'Query Management', icon: LifeBuoy, badge: queryBadge }] },
    { title: 'System', items: [{ id: 'settings', label: 'Settings', icon: Settings }] },
  ];

  const pages = {
    dashboard: DashboardPage,
    users: UsersPage,
    hospitals: HospitalsPage,
    payments: PaymentsPage,
    reports: ReportsPage,
    audit: AuditLogsPage,
    queries: QueryManagementPage,
    settings: SettingsPage,
  };

  const PageComponent = pages[page] || DashboardPage;
  const initials = (session.name || 'A').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const go = (id) => { setPage(id); setSidebarOpen(false); };

  return (
    <div className="app-layout">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2><Shield size={20} /> DocTrack</h2>
          <span>Admin Portal</span>
        </div>
        <nav className="sidebar-nav">
          {navSections.map(sec => (
            <div key={sec.title} className="nav-section">
              <div className="nav-section-title">{sec.title}</div>
              {sec.items.map(item => (
                <div key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} role="button" tabIndex={0}
                  onClick={() => go(item.id)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && go(item.id)}>
                  <item.icon size={18} /> <span>{item.label}</span>
                  {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}><LogOut size={18} /> Sign Out</button>
        </div>
      </aside>

      <div className="app-shell">
        <header className="topbar">
          <button className="topbar-menu" aria-label="Menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="topbar-spacer" />
          <button className="topbar-bell" aria-label={`${queryBadge} queries need attention`} title="Queries needing attention" onClick={() => go('queries')}>
            <Bell size={18} />
            {queryBadge > 0 && <span className="topbar-bell-dot">{queryBadge}</span>}
          </button>
          <div className="topbar-profile" tabIndex={0} onBlur={() => setTimeout(() => setProfileOpen(false), 150)}>
            <button className="topbar-profile-btn" onClick={() => setProfileOpen(o => !o)}>
              <span className="topbar-avatar">{initials}</span>
              <span className="topbar-profile-meta"><strong>{session.name}</strong><small>Administrator</small></span>
              <ChevronDown size={16} />
            </button>
            {profileOpen && (
              <div className="topbar-menu-pop">
                <button onClick={() => { go('settings'); setProfileOpen(false); }}><Settings size={15} /> Settings</button>
                <button onClick={logout}><LogOut size={15} /> Logout</button>
              </div>
            )}
          </div>
        </header>
        <main className="main-content">
          <PageComponent key={page} session={session} />
        </main>
      </div>
    </div>
  );
}
