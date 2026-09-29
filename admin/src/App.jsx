import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Building2, CreditCard, FileBarChart, ScrollText, LogOut, Shield, Eye, EyeOff, CheckCircle, Clock, Settings } from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api';

async function api(path, opts = {}) {
  const session = JSON.parse(localStorage.getItem('adminSession') || 'null');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (session?.id) headers['x-user-id'] = session.id;
  const res = await fetch(API + path, { ...opts, headers });
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
    active: 'badge-active', inactive: 'badge-inactive', Paid: 'badge-paid',
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
          <thead><tr><th>Hospital</th><th>Doctor</th><th>Location</th><th>Payout %</th><th>TDS Rate</th><th>Settlement</th></tr></thead>
          <tbody>
            {hospitals.map(h => (
              <tr key={h.id}>
                <td>{h.name}</td><td>{h.doctor_name}</td><td>{h.location}</td>
                <td>{h.payout_percentage}%</td><td>{h.tds_rate}%</td><td>{h.settlement_cycle}</td>
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

  const filters = ['All', 'Pending', 'Under Review', 'Paid', 'Rejected'];
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
          <thead><tr><th>Doctor</th><th>Hospital</th><th>Date</th><th>Expected</th><th>Actual</th><th>Shortfall</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td>{p.doctor_name}</td><td>{p.hospital_name}</td><td>{formatDate(p.date)}</td>
                <td>{formatCurrency(p.expected_net)}</td><td>{formatCurrency(p.actual_net)}</td>
                <td style={{ color: p.shortfall > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(p.shortfall)}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>
                  {(p.status === 'Pending' || p.status === 'Under Review') && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-sm btn-approve" onClick={() => approvePayment(p.id)}>Approve</button>
                      <button className="btn-sm btn-reject" onClick={() => { setRejectModal(p.id); setRejectReason(''); }}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="empty-state">No payments found</td></tr>}
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

// ── Main App ──
export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('adminSession')); } catch { return null; }
  });
  const [page, setPage] = useState('dashboard');

  function logout() {
    localStorage.removeItem('adminSession');
    setSession(null);
    setPage('dashboard');
  }

  if (!session) return <LoginPage onLogin={setSession} />;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'hospitals', label: 'Hospitals', icon: Building2 },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'reports', label: 'Reports', icon: FileBarChart },
    { id: 'audit', label: 'Audit Logs', icon: ScrollText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const pages = {
    dashboard: DashboardPage,
    users: UsersPage,
    hospitals: HospitalsPage,
    payments: PaymentsPage,
    reports: ReportsPage,
    audit: AuditLogsPage,
    settings: SettingsPage,
  };

  const PageComponent = pages[page] || DashboardPage;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2><Shield size={20} /> DocTrack Admin</h2>
          <span>Welcome, {session.name}</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <div key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>
              <item.icon size={18} /> {item.label}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}><LogOut size={18} /> Sign Out</button>
        </div>
      </aside>
      <main className="main-content">
        <PageComponent key={page} session={session} />
      </main>
    </div>
  );
}
