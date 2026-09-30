import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, LayoutDashboard, Building2, FileText, IndianRupee, AlertTriangle, LogOut, Menu, X, Plus, User, Upload, ChevronDown, ChevronRight, Activity, TrendingUp, Receipt, CheckCircle2, XCircle, Clock, ArrowRight, ArrowLeft, Trash2, Edit3, Search } from 'lucide-react'
import Welcome from './Welcome.jsx'
import './App.css'

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api'

const formatMoney = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v || 0))

const formatPct = (v) => `${Number(v || 0).toFixed(1)}%`

const EMPTY_HOSPITAL = { name: '', location: 'Bangalore', payout_basis: 'share', payout_percentage: '80', fixed_fee: '0', tds_rate: '10', deduction_rate: '2', settlement_cycle: '30 days', finance_contact_name: '', finance_contact_email: '', finance_contact_phone: '' }

const describeRule = (h) => h.payout_basis === 'fixed'
  ? `${formatMoney(h.fixed_fee)} fixed per case`
  : `${h.payout_percentage}% revenue share`

async function api(path, opts = {}) {
  const session = JSON.parse(localStorage.getItem('doctrack_session') || '{}')
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  if (session.user?.id) headers['x-user-id'] = String(session.user.id)
  const res = await fetch(`${API}${path}`, { ...opts, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

function App() {
  const [session, setSessionRaw] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('doctrack_session') || 'null') ||
             JSON.parse(localStorage.getItem('doctorSession') || 'null') ||
             { loggedIn: false, user: null }
    } catch { return { loggedIn: false, user: null } }
  })
  const setSession = (v) => { setSessionRaw(v); localStorage.setItem('doctrack_session', JSON.stringify(v)) }

  const [page, setPage] = useState('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authView, setAuthView] = useState('login')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [signupForm, setSignupForm] = useState({})
  const [signupError, setSignupError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const [dashboard, setDashboard] = useState(null)
  const [hospitals, setHospitals] = useState([])
  const [procedures, setProcedures] = useState([])
  const [payouts, setPayouts] = useState([])
  const [reconciliation, setReconciliation] = useState(null)
  const [statements, setStatements] = useState([])

  const [showModal, setShowModal] = useState(null)
  const [modalStep, setModalStep] = useState(1)
  const [procForm, setProcForm] = useState({ hospital_id: '', date: new Date().toISOString().split('T')[0], patient_name: '', procedure_type: 'Consultation', cases: '1', gross_amount: '' })
  const [hospForm, setHospForm] = useState(EMPTY_HOSPITAL)
  const [showAuth, setShowAuth] = useState(false)
  const [payoutForm, setPayoutForm] = useState({ hospital_id: '', date: new Date().toISOString().split('T')[0], period: '', actual_net: '', transaction_ref: '', procedure_ids: [] })
  const [ledgerFilter, setLedgerFilter] = useState('All')
  const [reconTab, setReconTab] = useState('Summary')
  const [expandedRow, setExpandedRow] = useState(null)
  const [uploadStep, setUploadStep] = useState(0)
  const [uploadForm, setUploadForm] = useState({ hospital_id: '', period: '' })

  const load = useCallback(async () => {
    if (!session.loggedIn) return
    try {
      const [d, h, p, py, r, s] = await Promise.all([
        api('/dashboard'), api('/hospitals'), api('/procedures'),
        api('/payouts'), api('/reconciliation'), api('/statements')
      ])
      setDashboard(d); setHospitals(h); setProcedures(p)
      setPayouts(py); setReconciliation(r); setStatements(s)
    } catch (e) { console.error('Load failed:', e) }
  }, [session.loggedIn, session.user?.id])

  useEffect(() => { load() }, [load])

  // ── Auth Handlers ──

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const user = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: loginForm.username.trim(), password: loginForm.password.trim() }) })
      const s = { loggedIn: true, user }
      setSession(s)
      if (rememberMe) localStorage.setItem('doctorSession', JSON.stringify(s))
      setLoginError('')
    } catch (err) { setLoginError(err.message) }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    const { name, email, username, password, confirmPassword } = signupForm
    if (!name?.trim()) return setSignupError('Full name is required.')
    if (!email?.trim() || !/^\S+@\S+\.\S+$/.test(email)) return setSignupError('Valid email required.')
    if (!password || password.length < 6) return setSignupError('Password must be at least 6 characters.')
    if (password !== confirmPassword) return setSignupError('Passwords do not match.')
    try {
      await api('/auth/register', { method: 'POST', body: JSON.stringify({ username: username || email, email, name, password }) })
      setAuthView('success')
    } catch (err) { setSignupError(err.message) }
  }

  const handleLogout = () => {
    localStorage.removeItem('doctrack_session')
    localStorage.removeItem('doctorSession')
    setSessionRaw({ loggedIn: false, user: null })
    setPage('Dashboard')
    setSidebarOpen(false)
  }

  // ── CRUD Handlers ──

  const saveHospital = async (e) => {
    e.preventDefault()
    try {
      const h = await api('/hospitals', { method: 'POST', body: JSON.stringify({ ...hospForm, payout_percentage: Number(hospForm.payout_percentage), fixed_fee: Number(hospForm.fixed_fee), tds_rate: Number(hospForm.tds_rate), deduction_rate: Number(hospForm.deduction_rate) }) })
      setHospitals(prev => [h, ...prev])
      setShowModal(null)
      setHospForm(EMPTY_HOSPITAL)
      load()
    } catch (err) { console.error(err) }
  }

  const saveProcedure = async (e) => {
    e.preventDefault()
    try {
      await api('/procedures', { method: 'POST', body: JSON.stringify({ hospital_id: Number(procForm.hospital_id), date: procForm.date, patient_name: procForm.patient_name, procedure_type: procForm.procedure_type, cases: Number(procForm.cases), gross_amount: Number(procForm.gross_amount) }) })
      setShowModal(null)
      setModalStep(1)
      setProcForm({ hospital_id: '', date: new Date().toISOString().split('T')[0], patient_name: '', procedure_type: 'Consultation', cases: '1', gross_amount: '' })
      load()
    } catch (err) { console.error(err) }
  }

  const savePayout = async (e) => {
    e.preventDefault()
    try {
      await api('/payouts', { method: 'POST', body: JSON.stringify({ hospital_id: Number(payoutForm.hospital_id), date: payoutForm.date, period: payoutForm.period, actual_net: Number(payoutForm.actual_net), transaction_ref: payoutForm.transaction_ref, procedure_ids: payoutForm.procedure_ids }) })
      setShowModal(null)
      setPayoutForm({ hospital_id: '', date: new Date().toISOString().split('T')[0], period: '', actual_net: '', transaction_ref: '', procedure_ids: [] })
      load()
    } catch (err) { console.error(err) }
  }

  const deleteHospital = async (id) => {
    if (!confirm('Delete this hospital and all associated data?')) return
    await api(`/hospitals/${id}`, { method: 'DELETE' })
    load()
  }

  const deleteProcedure = async (id) => {
    if (!confirm('Delete this procedure?')) return
    await api(`/procedures/${id}`, { method: 'DELETE' })
    load()
  }

  const simulateUpload = async () => {
    if (!uploadForm.hospital_id || !uploadForm.period) return
    setUploadStep(1)
    await api('/statements', { method: 'POST', body: JSON.stringify({ hospital_id: Number(uploadForm.hospital_id), period: uploadForm.period, filename: 'statement.pdf' }) })
    setTimeout(() => setUploadStep(2), 1200)
    setTimeout(() => setUploadStep(3), 2400)
    setTimeout(() => { setUploadStep(4); load() }, 3600)
  }

  // ── Computed ──

  const selectedHospital = hospitals.find(h => h.id === Number(procForm.hospital_id))
  const waterfall = selectedHospital && procForm.gross_amount ? (() => {
    const cases = Math.max(1, Number(procForm.cases) || 1)
    const perCase = Number(procForm.gross_amount)
    const gross = perCase * cases
    const share = selectedHospital.payout_basis === 'fixed'
      ? Number(selectedHospital.fixed_fee) * cases
      : gross * (selectedHospital.payout_percentage / 100)
    const tds = share * (selectedHospital.tds_rate / 100)
    const ded = share * (selectedHospital.deduction_rate / 100)
    return { cases, perCase, gross, share, tds, ded, net: share - tds - ded }
  })() : null

  const filteredProcedures = ledgerFilter === 'All' ? procedures : procedures.filter(p => p.status === ledgerFilter)

  // ── Greeting ──
  const greeting = (() => {
    const h = new Date().getHours()
    if (h >= 5 && h < 12) return 'Good morning'
    if (h >= 12 && h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  // ═══════════════════════════════════════
  // RENDER: Dashboard
  // ═══════════════════════════════════════

  const renderDashboard = () => {
    const d = dashboard
    if (!d) return <div className="empty-state"><p>Loading...</p></div>

    if (d.procedureCount === 0 && d.hospitalCount === 0) {
      return (
        <div className="animate-in">
          <div className="page-header"><div><h1>{greeting}, {session.user?.name?.split(' ')[0]}</h1><p className="page-subtitle">Revenue overview</p></div></div>
          <div className="card"><div className="empty-state">
            <FileText size={56} className="empty-state-icon" />
            <h3>No data yet</h3>
            <p>Start by adding a hospital, then log your first procedure.</p>
            <div className="flex gap-3 justify-center">
              <button className="btn btn-outline" onClick={() => setShowModal('hospital')}><Plus size={16} /> Add Hospital</button>
              <button className="btn btn-primary" onClick={() => setShowModal('procedure')}><Plus size={16} /> Log Procedure</button>
            </div>
          </div></div>
        </div>
      )
    }

    return (
      <div className="animate-in">
        <div className="page-header">
          <div><h1>{greeting}, {session.user?.name?.split(' ')[0]}</h1><p className="page-subtitle">Revenue overview</p></div>
          <button className="btn btn-primary" onClick={() => setShowModal('procedure')}><Plus size={16} /> Log Procedure</button>
        </div>

        <div className="stats-grid">
          <div className="stat-tile blue"><span className="stat-label">Total Billed</span><span className="stat-value">{formatMoney(d.totalBilled)}</span><span className="stat-sub">{d.procedureCount} procedures</span></div>
          <div className="stat-tile green"><span className="stat-label">Expected Revenue</span><span className="stat-value green">{formatMoney(d.expectedRevenue)}</span><span className="stat-sub">After TDS & deductions</span></div>
          <div className="stat-tile amber"><span className="stat-label">Received</span><span className="stat-value">{formatMoney(d.totalReceived)}</span><span className="stat-sub">{d.hospitalCount} hospitals</span></div>
          <div className="stat-tile red"><span className="stat-label">Pending</span><span className="stat-value amber">{formatMoney(d.totalPending)}</span><span className="stat-sub">Awaiting settlement</span></div>
        </div>

        <div className="collection-bar-wrap">
          <div className="collection-bar-header"><h3>Collection Rate</h3><span className="collection-rate-value">{formatPct(d.collectionRate)}</span></div>
          <div className="collection-bar-track"><div className="collection-bar-fill" style={{ width: `${Math.min(d.collectionRate, 100)}%` }} /></div>
        </div>

        {d.alerts.length > 0 && (
          <div className="card mb-6"><div className="card-header"><h3>Reconciliation Alerts</h3></div><div className="card-body">
            <div className="alert-list">
              {d.alerts.map((a, i) => (
                <div key={i} className={`alert-item ${a.severity === 'error' ? 'red' : 'amber'}`}>
                  <AlertTriangle size={16} /><span>{a.message}</span>
                </div>
              ))}
            </div>
          </div></div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
          <div className="card"><div className="card-header"><h3>Recent Procedures</h3></div><div className="card-body compact"><div className="table-wrap"><table className="data-table"><thead><tr><th>Hospital</th><th>Date</th><th>Type</th><th>Gross</th><th>Net Expected</th><th>Status</th></tr></thead><tbody>
            {(d.recentProcedures || []).map(p => (
              <tr key={p.id}><td>{p.hospital_name}</td><td>{p.date}</td><td>{p.procedure_type}</td><td className="amount">{formatMoney(p.gross_amount)}</td><td className="amount">{formatMoney(p.net_expected)}</td><td><span className={`badge ${p.status === 'Paid' ? 'green' : p.status === 'Matched' ? 'blue' : p.status === 'Discrepancy' ? 'red' : 'amber'}`}>{p.status}</span></td></tr>
            ))}
          </tbody></table></div></div></div>

          <div className="card"><div className="card-header"><h3>Hospital Summary</h3></div><div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(d.hospitalSummary || []).map(h => (
                <div key={h.id} className="hospital-strip-item" style={{ border: 'none', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <div className="hospital-strip-name">{h.name}</div>
                  <div className="hospital-strip-stats">
                    <div className="flex justify-between"><span>Billed</span><span className="val">{formatMoney(h.total_billed)}</span></div>
                    <div className="flex justify-between"><span>Received</span><span className="val text-green">{formatMoney(h.received)}</span></div>
                    <div className="flex justify-between"><span>Pending</span><span className="val text-amber">{formatMoney(h.pending)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div></div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════
  // RENDER: Ledger
  // ═══════════════════════════════════════

  const renderLedger = () => (
    <div className="animate-in">
      <div className="page-header">
        <div><h1>Ledger</h1><p className="page-subtitle">All procedure records with payment status</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal('procedure')}><Plus size={16} /> Log Procedure</button>
      </div>

      <div className="filter-bar">
        {['All', 'Pending', 'Paid', 'Matched', 'Discrepancy'].map(f => (
          <button key={f} className={`filter-chip ${ledgerFilter === f ? 'active' : ''}`} onClick={() => setLedgerFilter(f)}>
            {f}{f !== 'All' ? ` (${procedures.filter(p => p.status === f).length})` : ` (${procedures.length})`}
          </button>
        ))}
      </div>

      <div className="card"><div className="card-body compact"><div className="table-wrap"><table className="data-table"><thead><tr>
        <th style={{width:32}}></th><th>Hospital</th><th>Date</th><th>Procedure</th><th>Cases</th><th>Gross</th><th>Net Expected</th><th>Status</th><th>Actions</th>
      </tr></thead><tbody>
        {filteredProcedures.map(p => (<>
          <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}>
            <td>{expandedRow === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
            <td className="font-semibold">{p.hospital_name}</td><td>{p.date}</td><td>{p.procedure_type}</td><td>{p.cases}</td>
            <td className="amount">{formatMoney(p.gross_amount)}</td><td className="amount">{formatMoney(p.net_expected)}</td>
            <td><span className={`badge ${p.status === 'Paid' ? 'green' : p.status === 'Matched' ? 'blue' : p.status === 'Discrepancy' ? 'red' : 'amber'}`}>{p.status}</span></td>
            <td><button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); deleteProcedure(p.id) }}><Trash2 size={14} /></button></td>
          </tr>
          {expandedRow === p.id && (
            <tr key={`${p.id}-detail`}><td colSpan={9}><div className="row-detail"><div className="row-detail-grid">
              <div className="row-detail-item"><label>Doctor Share</label><span>{formatMoney(p.doctor_share)}</span></div>
              <div className="row-detail-item"><label>TDS</label><span className="text-red">−{formatMoney(p.tds_amount)}</span></div>
              <div className="row-detail-item"><label>Deductions</label><span className="text-red">−{formatMoney(p.deduction_amount)}</span></div>
              <div className="row-detail-item"><label>Net Expected</label><span className="text-green font-bold">{formatMoney(p.net_expected)}</span></div>
              {p.patient_name && <div className="row-detail-item"><label>Patient</label><span>{p.patient_name}</span></div>}
              {p.notes && <div className="row-detail-item"><label>Notes</label><span>{p.notes}</span></div>}
            </div></div></td></tr>
          )}
        </>))}
      </tbody></table></div></div></div>
    </div>
  )

  // ═══════════════════════════════════════
  // RENDER: Hospital Profiles
  // ═══════════════════════════════════════

  const renderHospitals = () => (
    <div className="animate-in">
      <div className="page-header">
        <div><h1>Hospital Profiles</h1><p className="page-subtitle">Payout rules, contacts & outstanding balances</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal('hospital')}><Plus size={16} /> Add Hospital</button>
      </div>

      {hospitals.length === 0 ? (
        <div className="card"><div className="empty-state">
          <Building2 size={56} className="empty-state-icon" />
          <h3>No hospitals yet</h3>
          <p>Add your first hospital to start tracking revenue.</p>
          <button className="btn btn-primary" onClick={() => setShowModal('hospital')}><Plus size={16} /> Add Hospital</button>
        </div></div>
      ) : (
        <div className="hospital-grid">
          {hospitals.map(h => {
            const hSummary = dashboard?.hospitalSummary?.find(s => s.id === h.id)
            return (
              <div key={h.id} className="hospital-card">
                <div className="hospital-card-header">
                  <div><h3>{h.name}</h3><span className="location">{h.location}</span></div>
                  <button className="btn-ghost btn-sm text-red" onClick={() => deleteHospital(h.id)}><Trash2 size={14} /></button>
                </div>
                <div className="hospital-card-body">
                  <div className="payout-rules">
                    {h.payout_basis === 'fixed'
                      ? <div className="payout-rule"><div className="payout-rule-label">Fixed Fee / Case</div><div className="payout-rule-value">{formatMoney(h.fixed_fee)}</div></div>
                      : <div className="payout-rule"><div className="payout-rule-label">Revenue Share</div><div className="payout-rule-value">{h.payout_percentage}%</div></div>}
                    <div className="payout-rule"><div className="payout-rule-label">TDS Rate</div><div className="payout-rule-value">{h.tds_rate}%</div></div>
                    <div className="payout-rule"><div className="payout-rule-label">Deductions</div><div className="payout-rule-value">{h.deduction_rate}%</div></div>
                    <div className="payout-rule"><div className="payout-rule-label">Basis</div><div className="payout-rule-value">{h.payout_basis === 'fixed' ? 'Fixed' : 'Share'}</div></div>
                    <div className="payout-rule"><div className="payout-rule-label">Settlement</div><div className="payout-rule-value">{h.settlement_cycle}</div></div>
                  </div>
                  {h.finance_contact_name && (
                    <div className="finance-contact">
                      <strong>{h.finance_contact_name}</strong>
                      {h.finance_contact_email && <div>{h.finance_contact_email}</div>}
                      {h.finance_contact_phone && <div>{h.finance_contact_phone}</div>}
                    </div>
                  )}
                </div>
                <div className="hospital-card-footer">
                  <span className="outstanding-label">Outstanding</span>
                  <span className={`outstanding-value ${(hSummary?.pending || 0) > 0 ? 'positive' : ''}`}>{formatMoney(hSummary?.pending || 0)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ═══════════════════════════════════════
  // RENDER: Payout Details
  // ═══════════════════════════════════════

  const renderPayouts = () => (
    <div className="animate-in">
      <div className="page-header">
        <div><h1>Payout Details</h1><p className="page-subtitle">Waterfall view of each hospital payment</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal('payout')}><Plus size={16} /> Record Payout</button>
      </div>

      {payouts.length === 0 ? (
        <div className="card"><div className="empty-state">
          <Receipt size={56} className="empty-state-icon" />
          <h3>No payouts recorded</h3>
          <p>Record a payout when a hospital settles your dues.</p>
        </div></div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {payouts.map(py => (
            <div key={py.id} className="card">
              <div className="card-header">
                <div>
                  <h3>{py.hospital_name}</h3>
                  <span className="text-sm text-muted">{py.date}{py.period ? ` · Period: ${py.period}` : ''}{py.transaction_ref ? ` · Ref: ${py.transaction_ref}` : ''}</span>
                </div>
                <span className={`badge ${py.status === 'Paid' ? 'green' : 'amber'}`}>{py.status}</span>
              </div>
              <div className="card-body">
                <div className="waterfall">
                  <div className="waterfall-row gross"><span className="waterfall-label">Gross Amount</span><span className="waterfall-amount">{formatMoney(py.gross_amount)}</span></div>
                  <div className="waterfall-row deduction"><span className="waterfall-label">TDS</span><span className="waterfall-amount">{formatMoney(py.tds)}</span></div>
                  <div className="waterfall-row deduction"><span className="waterfall-label">Deductions</span><span className="waterfall-amount">{formatMoney(py.deductions)}</span></div>
                  <div className="waterfall-row net"><span className="waterfall-label">Expected Net</span><span className="waterfall-amount">{formatMoney(py.expected_net)}</span></div>
                  <div className="waterfall-row actual"><span className="waterfall-label">Actual Received</span><span className="waterfall-amount">{formatMoney(py.actual_net)}</span></div>
                  {py.shortfall > 0 && <div className="waterfall-row shortfall"><span className="waterfall-label"><AlertTriangle size={14} /> Shortfall</span><span className="waterfall-amount">{formatMoney(py.shortfall)}</span></div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ═══════════════════════════════════════
  // RENDER: Upload Statement
  // ═══════════════════════════════════════

  const renderUpload = () => (
    <div className="animate-in">
      <div className="page-header"><div><h1>Upload Statement</h1><p className="page-subtitle">Upload hospital statements for automated matching</p></div></div>

      <div className="card mb-6"><div className="card-body">
        <div className="form-grid mb-4">
          <div className="form-field">
            <label className="form-label">Hospital</label>
            <select className="form-select" value={uploadForm.hospital_id} onChange={e => setUploadForm({...uploadForm, hospital_id: e.target.value})}>
              <option value="">Select hospital...</option>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Period</label>
            <input className="form-input" type="month" value={uploadForm.period} onChange={e => setUploadForm({...uploadForm, period: e.target.value})} />
          </div>
        </div>

        {uploadStep === 0 ? (
          <div className="upload-zone" onClick={simulateUpload}>
            <Upload size={48} className="upload-zone-icon" />
            <p className="font-semibold mb-2">Click to upload statement</p>
            <p className="text-sm text-muted">PDF, Excel or CSV · Select hospital & period first</p>
          </div>
        ) : (
          <div className="progress-steps">
            {['Upload', 'OCR Extract', 'Match', 'Complete'].map((label, i) => (
              <div key={label} className={`progress-step ${uploadStep > i + 1 ? 'done' : uploadStep === i + 1 ? 'active' : ''}`}>
                <div className="step-dot">{uploadStep > i + 1 ? <CheckCircle2 size={16} /> : i + 1}</div>
                <span className="step-label">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div></div>

      {statements.length > 0 && (
        <div className="card"><div className="card-header"><h3>Previous Uploads</h3></div><div className="card-body compact"><div className="table-wrap"><table className="data-table"><thead><tr>
          <th>Hospital</th><th>Period</th><th>Status</th><th>Matched</th><th>Discrepancies</th><th>Unmatched</th>
        </tr></thead><tbody>
          {statements.map(s => (
            <tr key={s.id}><td>{s.hospital_name}</td><td>{s.period}</td>
              <td><span className={`badge ${s.status === 'Complete' ? 'green' : s.status === 'Processing' ? 'blue' : 'amber'}`}>{s.status}</span></td>
              <td>{s.matched_count}</td><td>{s.discrepancy_count}</td><td>{s.unmatched_count}</td></tr>
          ))}
        </tbody></table></div></div></div>
      )}
    </div>
  )

  // ═══════════════════════════════════════
  // RENDER: Reconciliation
  // ═══════════════════════════════════════

  const renderReconciliation = () => {
    const r = reconciliation
    if (!r) return <div className="empty-state"><p>Loading...</p></div>
    const total = (r.summary.matched || 0) + (r.summary.discrepancy || 0) + (r.summary.pending || 0) + (r.summary.unmatched || 0)
    const pctOf = (v) => total > 0 ? (v / total * 100) : 0

    return (
      <div className="animate-in">
        <div className="page-header"><div><h1>Reconciliation</h1><p className="page-subtitle">Match procedures against hospital payouts</p></div></div>

        <div className="tabs">
          {['Summary', 'Matched', 'Discrepancy', 'Unmatched'].map(t => (
            <button key={t} className={`tab ${reconTab === t ? 'active' : ''}`} onClick={() => setReconTab(t)}>
              {t}<span className="tab-count">{t === 'Summary' ? total : t === 'Matched' ? r.summary.matched : t === 'Discrepancy' ? r.summary.discrepancy : (r.summary.pending + r.summary.unmatched)}</span>
            </button>
          ))}
        </div>

        {reconTab === 'Summary' && (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div className="card"><div className="card-body">
              <h3 className="font-semibold mb-4">Match Rate</h3>
              <div className="match-bar-container">
                <div className="match-bar-segment matched" style={{ width: `${pctOf(r.summary.matched)}%` }} />
                <div className="match-bar-segment pending" style={{ width: `${pctOf(r.summary.pending)}%` }} />
                <div className="match-bar-segment discrepancy" style={{ width: `${pctOf(r.summary.discrepancy)}%` }} />
                <div className="match-bar-segment unmatched" style={{ width: `${pctOf(r.summary.unmatched)}%` }} />
              </div>
              <div className="match-legend">
                <div className="match-legend-item"><div className="match-legend-dot matched" /><span>Matched ({r.summary.matched})</span></div>
                <div className="match-legend-item"><div className="match-legend-dot pending" /><span>Pending ({r.summary.pending})</span></div>
                <div className="match-legend-item"><div className="match-legend-dot discrepancy" /><span>Discrepancy ({r.summary.discrepancy})</span></div>
                <div className="match-legend-item"><div className="match-legend-dot unmatched" /><span>Unmatched ({r.summary.unmatched})</span></div>
              </div>
            </div></div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="stat-tile green"><span className="stat-label">Match Rate</span><span className="stat-value green">{formatPct(r.matchRate)}</span></div>
              <div className="stat-tile red"><span className="stat-label">Total TDS</span><span className="stat-value">{formatMoney(r.totalTds)}</span></div>
              <div className="stat-tile amber"><span className="stat-label">Total Deductions</span><span className="stat-value">{formatMoney(r.totalDeductions)}</span></div>
            </div>
          </div>
        )}

        {reconTab !== 'Summary' && (() => {
          const list = reconTab === 'Matched' ? r.matched : reconTab === 'Discrepancy' ? r.discrepancies : r.unmatched
          return (
            <div className="card"><div className="card-body compact"><div className="table-wrap"><table className="data-table"><thead><tr>
              <th>Hospital</th><th>Date</th><th>Procedure</th><th>Gross</th><th>Net Expected</th><th>Status</th>
            </tr></thead><tbody>
              {list.map(p => (
                <tr key={p.id}><td>{p.hospital_name}</td><td>{p.date}</td><td>{p.procedure_type}</td>
                  <td className="amount">{formatMoney(p.gross_amount)}</td><td className="amount">{formatMoney(p.net_expected)}</td>
                  <td><span className={`badge ${p.status === 'Matched' ? 'blue' : p.status === 'Discrepancy' ? 'red' : 'amber'}`}>{p.status}</span></td></tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="text-center text-muted" style={{padding:'32px'}}>No records in this category</td></tr>}
            </tbody></table></div></div></div>
          )
        })()}
      </div>
    )
  }

  // ═══════════════════════════════════════
  // RENDER: Settings
  // ═══════════════════════════════════════

  const renderSettings = () => (
    <div className="animate-in">
      <div className="page-header"><div><h1>Settings</h1><p className="page-subtitle">Account preferences</p></div></div>
      <div className="card" style={{ maxWidth: 480 }}><div className="card-body">
        <div className="flex items-center gap-4 mb-6" style={{ paddingBottom: 24, borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gradient-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.25rem' }}>
            {session.user?.name?.charAt(0) || 'D'}
          </div>
          <div><div className="font-semibold text-lg">{session.user?.name}</div><div className="text-sm text-muted">{session.user?.email}</div></div>
        </div>
        <button className="btn btn-danger" onClick={handleLogout}><LogOut size={16} /> Logout</button>
      </div></div>
    </div>
  )

  // ═══════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════

  const renderModals = () => {
    if (!showModal) return null

    if (showModal === 'procedure') {
      return (
        <div className="modal-backdrop" onClick={() => { setShowModal(null); setModalStep(1) }}>
          <div className="modal animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Log Procedure</h2>
              <button className="btn-ghost" onClick={() => { setShowModal(null); setModalStep(1) }}><X size={20} /></button>
            </div>

            <div className="modal-body">
              <div className="step-indicator">
                <div className={`step-indicator-dot ${modalStep >= 1 ? (modalStep > 1 ? 'done' : 'active') : ''}`}>{modalStep > 1 ? <CheckCircle2 size={14} /> : '1'}</div>
                <div className={`step-indicator-line ${modalStep > 1 ? 'done' : ''}`} />
                <div className={`step-indicator-dot ${modalStep >= 2 ? 'active' : ''}`}>2</div>
              </div>

              {modalStep === 1 && (
                <div className="form-grid">
                  <div className="form-field">
                    <label className="form-label">Hospital</label>
                    <select className="form-select" value={procForm.hospital_id} onChange={e => setProcForm({...procForm, hospital_id: e.target.value})}>
                      <option value="">Select...</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Date</label>
                    <input className="form-input" type="date" value={procForm.date} onChange={e => setProcForm({...procForm, date: e.target.value})} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Procedure Type</label>
                    <input className="form-input" value={procForm.procedure_type} onChange={e => setProcForm({...procForm, procedure_type: e.target.value})} placeholder="Consultation" />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Patient Name</label>
                    <input className="form-input" value={procForm.patient_name} onChange={e => setProcForm({...procForm, patient_name: e.target.value})} placeholder="Optional" />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Cases</label>
                    <input className="form-input" type="number" min="1" value={procForm.cases} onChange={e => setProcForm({...procForm, cases: e.target.value})} />
                  </div>
                </div>
              )}

              {modalStep === 2 && (
                <>
                  <div className="form-grid mb-4">
                    <div className="form-field full">
                      <label className="form-label">Billing Amount per Case (Gross)</label>
                      <input className="form-input" type="number" min="0" value={procForm.gross_amount} onChange={e => setProcForm({...procForm, gross_amount: e.target.value})} placeholder="₹0" autoFocus />
                      {Number(procForm.cases) > 1 && <span className="form-hint">{procForm.cases} cases — totals below are multiplied accordingly</span>}
                    </div>
                  </div>

                  {selectedHospital && (
                    <div style={{ background: '#f8fafc', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
                      <div className="text-xs font-semibold text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Revenue Rule · {selectedHospital.name}</div>
                      <div className="text-sm text-secondary">{describeRule(selectedHospital)} · {selectedHospital.tds_rate}% TDS · {selectedHospital.deduction_rate}% deductions</div>
                    </div>
                  )}

                  {waterfall && (
                    <div className="waterfall">
                      <div className="waterfall-row gross"><span className="waterfall-label">Gross Billing{waterfall.cases > 1 ? ` (${waterfall.cases} × ${formatMoney(waterfall.perCase)})` : ''}</span><span className="waterfall-amount">{formatMoney(waterfall.gross)}</span></div>
                      <div className="waterfall-row"><span className="waterfall-label">Doctor Share ({selectedHospital.payout_basis === 'fixed' ? `${formatMoney(selectedHospital.fixed_fee)} × ${waterfall.cases}` : `${selectedHospital.payout_percentage}%`})</span><span className="waterfall-amount">{formatMoney(waterfall.share)}</span></div>
                      <div className="waterfall-row deduction"><span className="waterfall-label">TDS ({selectedHospital.tds_rate}%)</span><span className="waterfall-amount">{formatMoney(waterfall.tds)}</span></div>
                      <div className="waterfall-row deduction"><span className="waterfall-label">Deductions ({selectedHospital.deduction_rate}%)</span><span className="waterfall-amount">{formatMoney(waterfall.ded)}</span></div>
                      <div className="waterfall-row net"><span className="waterfall-label">Net Expected Payout</span><span className="waterfall-amount">{formatMoney(waterfall.net)}</span></div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              {modalStep === 2 && <button className="btn btn-outline" onClick={() => setModalStep(1)}>Back</button>}
              {modalStep === 1 && <button className="btn btn-primary" disabled={!procForm.hospital_id} onClick={() => setModalStep(2)}>Next <ArrowRight size={16} /></button>}
              {modalStep === 2 && <button className="btn btn-success" onClick={saveProcedure}>Save Procedure</button>}
            </div>
          </div>
        </div>
      )
    }

    if (showModal === 'hospital') {
      return (
        <div className="modal-backdrop" onClick={() => setShowModal(null)}>
          <div className="modal animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Add Hospital</h2><button className="btn-ghost" onClick={() => setShowModal(null)}><X size={20} /></button></div>
            <form onSubmit={saveHospital}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-field"><label className="form-label">Hospital Name *</label><input className="form-input" required value={hospForm.name} onChange={e => setHospForm({...hospForm, name: e.target.value})} /></div>
                  <div className="form-field"><label className="form-label">Location</label><input className="form-input" value={hospForm.location} onChange={e => setHospForm({...hospForm, location: e.target.value})} /></div>
                  <div className="form-field full">
                    <label className="form-label">Payment Rule</label>
                    <div className="basis-toggle">
                      <button type="button" className={hospForm.payout_basis === 'share' ? 'active' : ''} onClick={() => setHospForm({...hospForm, payout_basis: 'share'})}>Revenue Share<small>% of gross billing</small></button>
                      <button type="button" className={hospForm.payout_basis === 'fixed' ? 'active' : ''} onClick={() => setHospForm({...hospForm, payout_basis: 'fixed'})}>Fixed Fee<small>flat amount per case</small></button>
                    </div>
                  </div>
                  {hospForm.payout_basis === 'fixed'
                    ? <div className="form-field"><label className="form-label">Fixed Fee per Case (₹)</label><input className="form-input" type="number" min="0" value={hospForm.fixed_fee} onChange={e => setHospForm({...hospForm, fixed_fee: e.target.value})} /></div>
                    : <div className="form-field"><label className="form-label">Revenue Share %</label><input className="form-input" type="number" min="0" max="100" value={hospForm.payout_percentage} onChange={e => setHospForm({...hospForm, payout_percentage: e.target.value})} /></div>}
                  <div className="form-field"><label className="form-label">TDS Rate %</label><input className="form-input" type="number" min="0" value={hospForm.tds_rate} onChange={e => setHospForm({...hospForm, tds_rate: e.target.value})} /></div>
                  <div className="form-field"><label className="form-label">Deduction Rate %</label><input className="form-input" type="number" min="0" value={hospForm.deduction_rate} onChange={e => setHospForm({...hospForm, deduction_rate: e.target.value})} /></div>
                  <div className="form-field"><label className="form-label">Settlement Cycle</label><input className="form-input" value={hospForm.settlement_cycle} onChange={e => setHospForm({...hospForm, settlement_cycle: e.target.value})} /></div>
                  <div className="form-field"><label className="form-label">Finance Contact</label><input className="form-input" value={hospForm.finance_contact_name} onChange={e => setHospForm({...hospForm, finance_contact_name: e.target.value})} placeholder="Name" /></div>
                  <div className="form-field"><label className="form-label">Contact Email</label><input className="form-input" type="email" value={hospForm.finance_contact_email} onChange={e => setHospForm({...hospForm, finance_contact_email: e.target.value})} /></div>
                  <div className="form-field"><label className="form-label">Contact Phone</label><input className="form-input" value={hospForm.finance_contact_phone} onChange={e => setHospForm({...hospForm, finance_contact_phone: e.target.value})} /></div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(null)}>Cancel</button><button type="submit" className="btn btn-primary">Save Hospital</button></div>
            </form>
          </div>
        </div>
      )
    }

    if (showModal === 'payout') {
      const pendingProcs = procedures.filter(p => p.status === 'Pending' && Number(p.hospital_id) === Number(payoutForm.hospital_id))
      return (
        <div className="modal-backdrop" onClick={() => setShowModal(null)}>
          <div className="modal animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Record Payout</h2><button className="btn-ghost" onClick={() => setShowModal(null)}><X size={20} /></button></div>
            <form onSubmit={savePayout}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-field">
                    <label className="form-label">Hospital</label>
                    <select className="form-select" value={payoutForm.hospital_id} onChange={e => setPayoutForm({...payoutForm, hospital_id: e.target.value, procedure_ids: []})}>
                      <option value="">Select...</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                  <div className="form-field"><label className="form-label">Date</label><input className="form-input" type="date" value={payoutForm.date} onChange={e => setPayoutForm({...payoutForm, date: e.target.value})} /></div>
                  <div className="form-field"><label className="form-label">Period</label><input className="form-input" type="month" value={payoutForm.period} onChange={e => setPayoutForm({...payoutForm, period: e.target.value})} /></div>
                  <div className="form-field"><label className="form-label">Amount Received (₹)</label><input className="form-input" type="number" min="0" value={payoutForm.actual_net} onChange={e => setPayoutForm({...payoutForm, actual_net: e.target.value})} /></div>
                  <div className="form-field full"><label className="form-label">Transaction Reference</label><input className="form-input" value={payoutForm.transaction_ref} onChange={e => setPayoutForm({...payoutForm, transaction_ref: e.target.value})} placeholder="UTR / NEFT / Cheque No." /></div>
                </div>

                {payoutForm.hospital_id && pendingProcs.length > 0 && (
                  <div className="mt-4">
                    <label className="form-label mb-2" style={{display:'block'}}>Link Pending Procedures</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                      {pendingProcs.map(p => (
                        <label key={p.id} className="flex items-center gap-3" style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.875rem' }}>
                          <input type="checkbox" checked={payoutForm.procedure_ids.includes(p.id)}
                            onChange={e => {
                              setPayoutForm(prev => ({...prev, procedure_ids: e.target.checked ? [...prev.procedure_ids, p.id] : prev.procedure_ids.filter(x => x !== p.id) }))
                            }} />
                          <span>{p.date} · {p.procedure_type} · {formatMoney(p.net_expected)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(null)}>Cancel</button><button type="submit" className="btn btn-success">Save Payout</button></div>
            </form>
          </div>
        </div>
      )
    }

    return null
  }

  // ═══════════════════════════════════════
  // RENDER: Page Router
  // ═══════════════════════════════════════

  const renderPage = () => {
    switch (page) {
      case 'Dashboard': return renderDashboard()
      case 'Ledger': return renderLedger()
      case 'Hospitals': return renderHospitals()
      case 'Payouts': return renderPayouts()
      case 'Upload': return renderUpload()
      case 'Reconciliation': return renderReconciliation()
      case 'Settings': return renderSettings()
      default: return renderDashboard()
    }
  }

  // ═══════════════════════════════════════
  // AUTH SCREENS
  // ═══════════════════════════════════════

  if (!session.loggedIn && !showAuth) {
    return <Welcome onLogin={() => { setAuthView('login'); setShowAuth(true) }} onSignup={() => { setAuthView('signup'); setSignupError(''); setShowAuth(true) }} />
  }

  if (!session.loggedIn) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <button className="login-back" onClick={() => setShowAuth(false)}><ArrowLeft size={14} /> Back to home</button>
          {authView === 'login' && (<>
            <div className="login-header">
              <img src="doctrack-logo.png" alt="DocTrack" className="login-logo" style={{ objectFit: 'contain' }} />
              <h1>DocTrack</h1>
              <p>Revenue Reconciliation Platform</p>
            </div>
            <form className="login-form" onSubmit={handleLogin}>
              <div className="login-field">
                <label>Username or Email</label>
                <input className="form-input dark" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} placeholder="Enter username" />
              </div>
              <div className="login-field">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input dark" type={showPw ? 'text' : 'password'} value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} placeholder="Enter password" style={{ paddingRight: 40 }} />
                  <button type="button" className="password-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--sidebar-text)' }}>
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /> Remember me
              </label>
              {loginError && <div className="login-error">{loginError}</div>}
              <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center', padding: '12px' }}>Login</button>
            </form>
            <div className="login-switch"><button onClick={() => { setAuthView('signup'); setSignupError('') }}>Don't have an account? Create one</button></div>
          </>)}

          {authView === 'signup' && (<>
            <div className="login-header">
              <img src="doctrack-logo.png" alt="DocTrack" className="login-logo" style={{ objectFit: 'contain' }} />
              <h1>Create Account</h1>
              <p>Set up your revenue tracking</p>
            </div>
            <form className="login-form" onSubmit={handleSignup}>
              <div className="login-field"><label>Full Name</label><input className="form-input dark" value={signupForm.name || ''} onChange={e => setSignupForm({...signupForm, name: e.target.value})} placeholder="Dr. Full Name" /></div>
              <div className="login-field"><label>Email</label><input className="form-input dark" type="email" value={signupForm.email || ''} onChange={e => setSignupForm({...signupForm, email: e.target.value})} placeholder="you@example.com" /></div>
              <div className="login-field"><label>Username</label><input className="form-input dark" value={signupForm.username || ''} onChange={e => setSignupForm({...signupForm, username: e.target.value})} placeholder="Choose a username" /></div>
              <div className="login-field">
                <label>Password</label>
                <input className="form-input dark" type="password" value={signupForm.password || ''} onChange={e => setSignupForm({...signupForm, password: e.target.value})} placeholder="Min 6 characters" />
              </div>
              <div className="login-field"><label>Confirm Password</label><input className="form-input dark" type="password" value={signupForm.confirmPassword || ''} onChange={e => setSignupForm({...signupForm, confirmPassword: e.target.value})} placeholder="Confirm password" /></div>
              {signupError && <div className="login-error">{signupError}</div>}
              <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center', padding: '12px' }}>Create Account</button>
            </form>
            <div className="login-switch"><button onClick={() => { setAuthView('login'); setLoginError('') }}>Already have an account? Log in</button></div>
          </>)}

          {authView === 'success' && (
            <div className="text-center" style={{ padding: '32px 0' }}>
              <CheckCircle2 size={48} className="text-green" style={{ margin: '0 auto 16px' }} />
              <h2 style={{ color: '#f8fafc', marginBottom: 8 }}>Account Created</h2>
              <p className="text-muted mb-6">You can now log in with your credentials.</p>
              <button className="btn btn-primary w-full" style={{ justifyContent: 'center' }} onClick={() => { setAuthView('login'); setSignupForm({}) }}>Go to Login</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════
  // MAIN LAYOUT
  // ═══════════════════════════════════════

  const navItems = [
    { key: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { key: 'Ledger', icon: FileText, label: 'Ledger' },
    { key: 'Hospitals', icon: Building2, label: 'Hospitals' },
    { key: 'Payouts', icon: IndianRupee, label: 'Payouts' },
    { key: 'Upload', icon: Upload, label: 'Upload Statement' },
    { key: 'Reconciliation', icon: Activity, label: 'Reconciliation' },
  ]

  return (<>
    <div className="app-shell">
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-inner">
            <img src="doctrack-logo.png" alt="" className="sidebar-logo" style={{ objectFit: 'contain' }} />
            <div className="brand-text"><span className="brand-name">DocTrack</span><span className="brand-tagline">Revenue Reconciliation</span></div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(n => (
            <button key={n.key} className={`nav-item ${page === n.key ? 'active' : ''}`} onClick={() => { setPage(n.key); setSidebarOpen(false) }}>
              <span className="nav-icon"><n.icon size={18} /></span>{n.label}
            </button>
          ))}

          <div className="nav-spacer" />

          <button className={`nav-item ${page === 'Settings' ? 'active' : ''}`} onClick={() => { setPage('Settings'); setSidebarOpen(false) }}>
            <span className="nav-icon"><User size={18} /></span>Settings
          </button>
          <button className="nav-item logout-item" onClick={handleLogout}>
            <span className="nav-icon"><LogOut size={18} /></span>Logout
          </button>
        </nav>
      </aside>

      <main className="content-area">{renderPage()}</main>
    </div>

    {renderModals()}
  </>)
}

export default App
