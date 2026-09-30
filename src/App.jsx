import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, LayoutDashboard, Building2, FileText, IndianRupee, AlertTriangle, LogOut, Menu, X, Plus, User, ChevronDown, ChevronRight, Receipt, CheckCircle2, ArrowLeft, ArrowRight, Trash2, Pencil, Mail, AtSign, Lock } from 'lucide-react'
import Welcome from './Welcome.jsx'
import ShinyButton from './ShinyButton.jsx'
import InteractiveHoverButton from './InteractiveHoverButton.jsx'
import MeshGradient from './MeshGradient.jsx'
import { SettlementBars, MetricBars, Donut, LineChart, ChartEmpty, STATUS_COLOR } from './Charts.jsx'
import './App.css'

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api'

const formatMoney = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v || 0))

const formatPct = (v) => `${Number(v || 0).toFixed(1)}%`
const today = () => new Date().toISOString().split('T')[0]
const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  return isNaN(d) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
const monthLabel = (ym) => {
  const d = new Date(`${ym}-01T00:00:00`)
  return isNaN(d) ? ym : d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}
const GrossCell = ({ p }) => (
  <td className="amount">
    {formatMoney(p.gross_amount)}
    {p.cases > 1 && <span className="amount-note">{formatMoney(p.gross_amount / p.cases)} × {p.cases}</span>}
  </td>
)

const EMPTY_HOSPITAL = { name: '', location: 'Bangalore', payout_basis: 'share', payout_percentage: '80', fixed_fee: '0', tds_rate: '10', deduction_rate: '2', settlement_cycle: '30 days', finance_contact_name: '', finance_contact_email: '', finance_contact_phone: '' }
const EMPTY_PAYOUT = () => ({ hospital_id: '', date: today(), actual_net: '', transaction_ref: '', notes: '', status: 'Paid' })
const PAYOUT_STATUS_OPTIONS = [
  { value: 'Paid', label: 'Fully Paid', hint: 'Dues settled in full', color: 'green' },
  { value: 'Partially Paid', label: 'Partially Paid', hint: 'Part of the dues received', color: 'blue' },
  { value: 'Under Review', label: 'Under Review', hint: 'Needs admin verification', color: 'amber' },
]
const statusLabel = (value) => PAYOUT_STATUS_OPTIONS.find(o => o.value === value)?.label || value

const StatusLegend = () => (
  <div className="status-legend" aria-hidden="true">
    {[...PAYOUT_STATUS_OPTIONS, { value: 'Rejected', label: 'Rejected', color: 'red' }].map(o => (
      <span key={o.value}><i className={`status-dot ${o.color}`} />{o.label}</span>
    ))}
  </div>
)
const SERVICE_SUGGESTIONS = ['Consultation', 'Follow-up', 'Surgery', 'Procedure', 'Ward Round', 'Emergency Call']
const MANUAL = 'manual'

const describeRule = (h) => h.payout_basis === 'fixed'
  ? `${formatMoney(h.fixed_fee)} fixed per case`
  : `${h.payout_percentage}% revenue share`

const payoutBadge = (status) => status === 'Paid' ? 'green' : status === 'Partially Paid' ? 'blue' : status === 'Rejected' ? 'red' : 'amber'

// Rejected payments are final (set by admin); every other status stays editable by the doctor.
const PayoutStatus = ({ p, onChange }) => p.status === 'Rejected'
  ? <><span className="badge red">Rejected</span>{p.notes && <div className="text-xs text-muted" style={{ marginTop: 4 }}>{p.notes}</div>}</>
  : (
    <select className={`status-select ${payoutBadge(p.status)}`} aria-label="Payment status" value={p.status} onChange={e => { const next = e.target.value; e.target.value = p.status; onChange(p, next) }}>
      {PAYOUT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )

// Mirrors the server's calcWaterfall so the entry form can preview the net figure.
const previewNet = (h, amount, cases) => {
  if (!h) return null
  const n = Math.max(1, Number(cases) || 1)
  const gross = (Number(amount) || 0) * n
  const share = h.payout_basis === 'fixed' ? Number(h.fixed_fee) * n : gross * (h.payout_percentage / 100)
  const net = share - share * (h.tds_rate / 100) - share * (h.deduction_rate / 100)
  return { gross, share, net }
}

// Floating-label glass input for the auth screens.
function Field({ id, label, icon: Icon, type = 'text', value, onChange, autoComplete, trailing }) {
  return (
    <div className="ff">
      <input id={id} type={type} className="ff-input" placeholder=" " value={value} onChange={onChange} autoComplete={autoComplete} style={trailing ? { paddingRight: 34 } : undefined} />
      <label htmlFor={id} className="ff-label"><Icon size={15} /> {label}</label>
      {trailing}
    </div>
  )
}

// Bento-style stat grid for the dashboard hero.
const DashBento = ({ d }) => {
  const receivedPct = d.earned > 0 ? Math.min(100, (d.received / d.earned) * 100) : 0
  return (
    <div className="bento">
      <div className="bento-primary">
        <div>
          <span className="bento-kicker">Earned</span>
          <div className="bento-num">{formatMoney(d.earned)}</div>
        </div>
        <p className="bento-caption">Net expected across {d.procedureCount} {d.procedureCount === 1 ? 'entry' : 'entries'} · {formatPct(d.collectionRate)} collected</p>
      </div>
      <div className="bento-a">
        <div>
          <p className="bento-label">Received</p>
          <p className="bento-stat text-green">{formatMoney(d.received)}</p>
        </div>
        <div className="bento-ring" style={{ '--pct': `${receivedPct}%` }}>
          <span>{Math.round(receivedPct)}%</span>
        </div>
      </div>
      <div className="bento-b">
        <p className="bento-stat amber">{formatMoney(d.underReview)}</p>
        <p className="bento-label">Under Review</p>
      </div>
      <div className="bento-c">
        <div className="bento-c-icon"><IndianRupee size={20} /></div>
        <div>
          <p className="bento-stat">{formatMoney(d.pending)}</p>
          <p className="bento-label">Pending settlement</p>
        </div>
      </div>
    </div>
  )
}

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
  const [showAuth, setShowAuth] = useState(false)
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
  const [analytics, setAnalytics] = useState(null)

  const [showModal, setShowModal] = useState(null)
  const [toast, setToast] = useState('')

  // Entry form — remembers the last hospital/service for the session only.
  const [lastPick, setLastPick] = useState({ hospital_id: '', service_id: '' })
  const [entryForm, setEntryForm] = useState({ hospital_id: '', service_id: '', service_type_id: '', amount: '', cases: '1', date: today(), manual_service: '' })
  const [entryError, setEntryError] = useState('')
  const [editingEntry, setEditingEntry] = useState(null)
  const [editingPayout, setEditingPayout] = useState(null)
  const [saving, setSaving] = useState(false)

  const [hospForm, setHospForm] = useState(EMPTY_HOSPITAL)
  const [hospError, setHospError] = useState('')
  const [editingHospital, setEditingHospital] = useState(null)
  const [serviceModal, setServiceModal] = useState(null)
  const [serviceError, setServiceError] = useState('')
  const [payoutForm, setPayoutForm] = useState(EMPTY_PAYOUT)
  const [payoutError, setPayoutError] = useState('')
  const [statusChange, setStatusChange] = useState(null)

  const [ledgerHospital, setLedgerHospital] = useState('All')
  const [ledgerService, setLedgerService] = useState('All')
  const [ledgerDate, setLedgerDate] = useState('all')
  const [ledgerRange, setLedgerRange] = useState({ from: '', to: '' })
  const [expandedRow, setExpandedRow] = useState(null)

  const load = useCallback(async () => {
    if (!session.loggedIn) return
    try {
      const [d, h, p, py, an] = await Promise.all([
        api('/dashboard'), api('/hospitals'), api('/procedures'), api('/payouts'), api('/analytics')
      ])
      setDashboard(d); setHospitals(h); setProcedures(p); setPayouts(py); setAnalytics(an)
    } catch (e) { console.error('Load failed:', e) }
  }, [session.loggedIn])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // ── Auth ──

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
    setShowAuth(false)
  }

  // ── Entry form helpers ──

  const hospitalById = (id) => hospitals.find(h => h.id === Number(id))
  const entryHospital = hospitalById(entryForm.hospital_id)
  const entryService = entryHospital?.services.find(s => s.id === Number(entryForm.service_id))

  const pickService = (hospital, preferredId) => {
    if (!hospital) return ''
    if (hospital.services.some(s => s.id === Number(preferredId))) return String(preferredId)
    if (hospital.services.length === 1) return String(hospital.services[0].id)
    if (hospital.services.length === 0) return MANUAL
    return ''
  }

  const applyService = (form, serviceId) => {
    const h = hospitalById(form.hospital_id)
    const s = h?.services.find(x => x.id === Number(serviceId))
    if (!s) return { ...form, service_id: serviceId, service_type_id: '', amount: serviceId === MANUAL ? form.amount : '' }
    const t = s.types.length === 1 ? s.types[0] : null
    return { ...form, service_id: String(s.id), service_type_id: t ? String(t.id) : '', amount: String(t ? t.amount : s.default_amount), manual_service: '' }
  }

  const openEntry = () => {
    let form = { hospital_id: lastPick.hospital_id, service_id: '', service_type_id: '', amount: '', cases: '1', date: today(), manual_service: '' }
    if (!hospitalById(form.hospital_id)) form.hospital_id = hospitals.length === 1 ? String(hospitals[0].id) : ''
    form = applyService(form, pickService(hospitalById(form.hospital_id), lastPick.service_id))
    setEntryForm(form)
    setEditingEntry(null)
    setEntryError('')
    setShowModal('entry')
  }

  const openEditEntry = (p) => {
    const h = hospitalById(p.hospital_id)
    const service = h?.services.find(s => s.id === p.service_id)
    setEntryForm({
      hospital_id: String(p.hospital_id),
      service_id: service ? String(service.id) : MANUAL,
      service_type_id: p.service_type_id ? String(p.service_type_id) : '',
      amount: String(p.gross_amount / (p.cases || 1)),
      cases: String(p.cases || 1),
      date: p.date,
      manual_service: service ? '' : p.procedure_type,
    })
    setEditingEntry(p.id)
    setEntryError('')
    setShowModal('entry')
  }

  const openEditPayout = (py) => {
    setPayoutForm({ hospital_id: String(py.hospital_id), date: py.date, actual_net: String(py.actual_net), transaction_ref: py.transaction_ref || '', notes: py.notes || '', status: py.status })
    setEditingPayout(py.id)
    setPayoutError('')
    setShowModal('payout')
  }

  const selectHospital = (id) => {
    const h = hospitalById(id)
    setEntryForm(applyService({ ...entryForm, hospital_id: id }, pickService(h, lastPick.service_id)))
  }

  const selectType = (typeId) => {
    const t = entryService?.types.find(x => x.id === Number(typeId))
    setEntryForm({ ...entryForm, service_type_id: typeId, amount: t ? String(t.amount) : entryForm.amount })
  }

  const saveEntry = async (addAnother) => {
    const f = entryForm
    if (!f.hospital_id) return setEntryError('Select a hospital.')
    if (!f.service_id) return setEntryError('Select a service.')
    if (f.service_id === MANUAL && !f.manual_service.trim()) return setEntryError('Enter the service name.')
    if (entryService?.types.length > 0 && !f.service_type_id) return setEntryError(`Select the ${entryService.name.toLowerCase()} type.`)
    if (!(Number(f.amount) > 0)) return setEntryError('Amount must be greater than zero.')
    setSaving(true)
    try {
      if (editingEntry) {
        await api(`/procedures/${editingEntry}`, { method: 'PUT', body: JSON.stringify({
          date: f.date, cases: Number(f.cases) || 1, gross_amount: Number(f.amount),
          service_id: f.service_id === MANUAL ? null : Number(f.service_id),
          service_type_id: f.service_type_id ? Number(f.service_type_id) : null,
          ...(f.service_id === MANUAL && { procedure_type: f.manual_service.trim() }),
        }) })
        setToast('Entry updated')
        setEntryError('')
        setEditingEntry(null)
        setShowModal(null)
        load()
        setSaving(false)
        return
      }
      await api('/procedures', { method: 'POST', body: JSON.stringify({
        hospital_id: Number(f.hospital_id), date: f.date, cases: Number(f.cases) || 1, gross_amount: Number(f.amount),
        service_id: f.service_id === MANUAL ? undefined : Number(f.service_id),
        service_type_id: f.service_type_id ? Number(f.service_type_id) : undefined,
        procedure_type: f.service_id === MANUAL ? f.manual_service.trim() : undefined,
      }) })
      setLastPick({ hospital_id: f.hospital_id, service_id: f.service_id })
      setToast('Entry saved')
      setEntryError('')
      load()
      if (addAnother) {
        setEntryForm(applyService({ ...f, cases: '1', service_type_id: '', amount: '' }, f.service_id))
      } else {
        setShowModal(null)
      }
    } catch (err) { setEntryError(err.message) }
    setSaving(false)
  }

  // ── Hospitals & services ──

  const openAddHospital = () => { setHospForm(EMPTY_HOSPITAL); setEditingHospital(null); setHospError(''); setShowModal('hospital') }

  const openEditHospital = (h) => {
    setHospForm({
      name: h.name, location: h.location, payout_basis: h.payout_basis, payout_percentage: String(h.payout_percentage),
      fixed_fee: String(h.fixed_fee), tds_rate: String(h.tds_rate), deduction_rate: String(h.deduction_rate),
      settlement_cycle: h.settlement_cycle, finance_contact_name: h.finance_contact_name || '',
      finance_contact_email: h.finance_contact_email || '', finance_contact_phone: h.finance_contact_phone || '',
    })
    setEditingHospital(h.id)
    setHospError('')
    setShowModal('hospital')
  }

  const saveHospital = async (e) => {
    e.preventDefault()
    const body = JSON.stringify({ ...hospForm, payout_percentage: Number(hospForm.payout_percentage), fixed_fee: Number(hospForm.fixed_fee), tds_rate: Number(hospForm.tds_rate), deduction_rate: Number(hospForm.deduction_rate) })
    try {
      if (editingHospital) {
        await api(`/hospitals/${editingHospital}`, { method: 'PUT', body })
        setShowModal(null)
        setEditingHospital(null)
        setHospForm(EMPTY_HOSPITAL)
        setHospError('')
        setToast('Hospital updated')
        load()
        return
      }
      const h = await api('/hospitals', { method: 'POST', body })
      setShowModal(null)
      setHospForm(EMPTY_HOSPITAL)
      setHospError('')
      setToast('Hospital added — now add its services')
      openServiceModal(h, null)
      load()
    } catch (err) { setHospError(err.message) }
  }

  const deleteHospital = async (id) => {
    if (!confirm('Delete this hospital and all associated data?')) return
    await api(`/hospitals/${id}`, { method: 'DELETE' })
    load()
  }

  const openServiceModal = (hospital, service) => {
    setServiceModal({
      hospital_id: hospital.id, hospital_name: hospital.name, service_id: service?.id || null,
      form: {
        name: service?.name || '', default_amount: service ? String(service.default_amount) : '',
        types: (service?.types || []).map(t => ({ id: t.id, name: t.name, amount: String(t.amount), key: `t${t.id}` })),
        showTypes: (service?.types || []).length > 0,
      },
    })
    setServiceError('')
    setShowModal('service')
  }

  const setServiceForm = (patch) => setServiceModal(m => ({ ...m, form: { ...m.form, ...patch } }))
  const updateType = (key, patch) => setServiceForm({ types: serviceModal.form.types.map(t => t.key === key ? { ...t, ...patch } : t) })
  const addTypeRow = () => setServiceForm({ types: [...serviceModal.form.types, { name: '', amount: '', key: `n${Date.now()}` }] })
  const removeTypeRow = (key) => setServiceForm({ types: serviceModal.form.types.filter(t => t.key !== key) })

  const saveService = async (e) => {
    e.preventDefault()
    const { hospital_id, service_id, form } = serviceModal
    if (!form.name.trim()) return setServiceError('Service name is required.')
    const types = form.showTypes ? form.types.filter(t => t.name.trim()) : []
    try {
      const svc = service_id
        ? await api(`/services/${service_id}`, { method: 'PUT', body: JSON.stringify({ name: form.name, default_amount: Number(form.default_amount) || 0 }) })
        : await api(`/hospitals/${hospital_id}/services`, { method: 'POST', body: JSON.stringify({ name: form.name, default_amount: Number(form.default_amount) || 0 }) })
      const existing = svc.types || []
      for (const t of existing) {
        const keep = types.find(x => x.id === t.id)
        if (!keep) await api(`/service-types/${t.id}`, { method: 'DELETE' })
        else if (keep.name.trim() !== t.name || Number(keep.amount) !== t.amount) await api(`/service-types/${t.id}`, { method: 'PUT', body: JSON.stringify({ name: keep.name, amount: Number(keep.amount) || 0 }) })
      }
      for (const t of types.filter(x => !x.id)) {
        await api(`/services/${svc.id}/types`, { method: 'POST', body: JSON.stringify({ name: t.name, amount: Number(t.amount) || 0 }) })
      }
      setShowModal(null)
      setServiceModal(null)
      setToast(service_id ? 'Service updated' : 'Service added')
      load()
    } catch (err) { setServiceError(err.message) }
  }

  const deleteService = async (id) => {
    if (!confirm('Remove this service?')) return
    await api(`/services/${id}`, { method: 'DELETE' })
    load()
  }

  // ── Payouts ──

  const savePayout = async (e) => {
    e.preventDefault()
    if (!payoutForm.hospital_id) return setPayoutError('Select a hospital.')
    if (!(Number(payoutForm.actual_net) > 0)) return setPayoutError('Enter the amount received.')
    try {
      if (editingPayout) {
        await api(`/payouts/${editingPayout}`, { method: 'PUT', body: JSON.stringify({ date: payoutForm.date, actual_net: Number(payoutForm.actual_net), transaction_ref: payoutForm.transaction_ref, notes: payoutForm.notes, status: payoutForm.status }) })
        setToast('Payment updated')
      } else {
        await api('/payouts', { method: 'POST', body: JSON.stringify({ ...payoutForm, hospital_id: Number(payoutForm.hospital_id), actual_net: Number(payoutForm.actual_net) }) })
        setToast(payoutForm.status === 'Under Review' ? 'Payment recorded — under review' : 'Payment recorded')
      }
      setShowModal(null)
      setEditingPayout(null)
      setPayoutForm(EMPTY_PAYOUT())
      setPayoutError('')
      load()
    } catch (err) { setPayoutError(err.message) }
  }

  const requestStatusChange = (p, status) => { if (status !== p.status) setStatusChange({ p, status }) }

  const confirmStatusChange = async () => {
    const { p, status } = statusChange
    try {
      await api(`/payouts/${p.id}`, { method: 'PUT', body: JSON.stringify({ status }) })
      setStatusChange(null)
      setToast(`${p.hospital_name} payment of ${formatMoney(p.actual_net)} marked as ${statusLabel(status)}`)
      load()
    } catch (err) { setToast(err.message) }
  }

  const deleteProcedure = async (id) => {
    if (!confirm('Delete this entry?')) return
    await api(`/procedures/${id}`, { method: 'DELETE' })
    load()
  }

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
            <p>Add a hospital with its services, then log your first entry.</p>
            <button className="btn btn-primary" onClick={openAddHospital}><Plus size={16} /> Add Hospital</button>
          </div></div>
        </div>
      )
    }

    return (
      <div className="animate-in">
        <div className="page-header">
          <div>
            <h1>{greeting}, {session.user?.name?.split(' ')[0]}</h1>
            <p className="page-subtitle">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {d.procedureCount} {d.procedureCount === 1 ? 'entry' : 'entries'} across {d.hospitalCount} hospital{d.hospitalCount === 1 ? '' : 's'}</p>
          </div>
          <button className="btn btn-primary" onClick={openEntry}><Plus size={16} /> Add Entry</button>
        </div>

        <DashBento d={d} />

        {d.alerts.length > 0 && (
          <div className="card mb-6"><div className="card-header"><h3>Alerts</h3></div><div className="card-body">
            <div className="alert-list">
              {d.alerts.map((a, i) => (
                <div key={i} className={`alert-item ${a.severity === 'error' ? 'red' : 'amber'}`}><AlertTriangle size={16} /><span>{a.message}</span></div>
              ))}
            </div>
          </div></div>
        )}

        {analytics && (<>
          <div className="card mb-6">
            <div className="card-header"><h3>Payments by Hospital</h3><span className="text-xs text-muted">Earned, split into received · under review · pending</span></div>
            <div className="card-body"><SettlementBars rows={analytics.revenueByHospital.filter(h => h.earned > 0)} /></div>
          </div>

          <div className="analytics-head"><h2>Analytics</h2><span className="text-sm text-muted">{analytics.totals.rendered} services rendered · {analytics.totals.entries} {analytics.totals.entries === 1 ? 'visit' : 'visits'} · {analytics.totals.hospitals} {analytics.totals.hospitals === 1 ? 'hospital' : 'hospitals'}</span></div>
          <div className="analytics-grid">
            <div className="card"><div className="card-header"><h3>Payment status</h3></div><div className="card-body">
              <Donut centerLabel="payments" data={analytics.paymentStatus.map(s => ({ label: s.status, value: s.count, color: STATUS_COLOR[s.status] || '#94a3b8' }))} />
            </div></div>
            <div className="card"><div className="card-header"><h3>Services by revenue</h3></div><div className="card-body">
              <MetricBars data={analytics.servicesByType} valueKey="revenue" labelKey="name" />
            </div></div>
            <div className="card analytics-wide"><div className="card-header"><h3>Monthly revenue</h3></div><div className="card-body">
              {analytics.monthlyTrend.length > 0
                ? <LineChart valueKey="revenue" points={analytics.monthlyTrend.map(m => ({ label: monthLabel(m.month), revenue: m.revenue }))} />
                : <ChartEmpty />}
            </div></div>
          </div>
        </>)}

        <div className="dash-grid">
          <div className="card">
            <div className="card-header"><h3>Recent Entries</h3><button className="card-link" onClick={() => { setLedgerHospital('All'); setPage('Ledger') }}>View all <ArrowRight size={14} /></button></div>
            <div className="card-body compact"><div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Hospital</th><th>Service</th><th>Gross</th><th>Net</th></tr></thead><tbody>
              {(d.recentProcedures || []).map(p => (
                <tr key={p.id}><td className="nowrap">{formatDate(p.date)}</td><td className="font-semibold">{p.hospital_name}</td><td>{p.procedure_type}</td><GrossCell p={p} /><td className="amount text-green font-semibold">{formatMoney(p.net_expected)}</td></tr>
              ))}
              {(d.recentProcedures || []).length === 0 && <tr><td colSpan={5} className="text-center text-muted" style={{ padding: '24px' }}>No entries yet</td></tr>}
            </tbody></table></div></div>
          </div>

          <div className="card">
            <div className="card-header"><h3>By Hospital</h3><button className="card-link" onClick={() => setPage('Hospitals')}>Details <ArrowRight size={14} /></button></div>
            <div className="card-body compact"><div className="table-wrap"><table className="data-table"><thead><tr><th>Hospital</th><th>Earned</th><th>Received</th><th>Pending</th></tr></thead><tbody>
              {(d.hospitalSummary || []).map(h => (
                <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => { setLedgerHospital(String(h.id)); setPage('Ledger') }}>
                  <td className="font-semibold">{h.name}</td><td className="amount">{formatMoney(h.earned)}</td><td className="amount text-green">{formatMoney(h.received)}</td><td className="amount">{formatMoney(h.pending)}</td>
                </tr>
              ))}
              {(d.hospitalSummary || []).length === 0 && <tr><td colSpan={4} className="text-center text-muted" style={{ padding: '24px' }}>No hospitals yet</td></tr>}
            </tbody></table></div></div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════
  // RENDER: Ledger
  // ═══════════════════════════════════════

  const baseService = (p) => (p.procedure_type || '').split(' — ')[0]

  const renderLedger = () => {
    const serviceOptions = [...new Set(procedures.map(baseService))].filter(Boolean).sort()
    const inRange = (dateStr) => {
      if (ledgerDate === 'all') return true
      const d = new Date(`${dateStr}T00:00:00`)
      const now = new Date(); now.setHours(0, 0, 0, 0)
      if (ledgerDate === 'today') return dateStr === today()
      if (ledgerDate === 'week') { const s = new Date(now); s.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return d >= s && d <= now }
      if (ledgerDate === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      if (ledgerDate === 'custom') { const f = ledgerRange.from, t = ledgerRange.to; return (!f || dateStr >= f) && (!t || dateStr <= t) }
      return true
    }
    const list = procedures.filter(p =>
      (ledgerHospital === 'All' || p.hospital_id === Number(ledgerHospital)) &&
      (ledgerService === 'All' || baseService(p) === ledgerService) &&
      inRange(p.date)
    )
    const dateLabel = { all: 'All dates', today: 'Today', week: 'This week', month: 'This month', custom: 'Custom range' }
    const active = ledgerHospital !== 'All' || ledgerService !== 'All' || ledgerDate !== 'all'
    const clearFilters = () => { setLedgerHospital('All'); setLedgerService('All'); setLedgerDate('all'); setLedgerRange({ from: '', to: '' }) }

    return (
      <div className="animate-in">
        <div className="page-header">
          <div><h1>Ledger</h1><p className="page-subtitle">Every entry with its expected payout</p></div>
          <button className="btn btn-primary" onClick={openEntry}><Plus size={16} /> Add Entry</button>
        </div>

        <div className="filter-bar">
          <button className={`filter-chip ${ledgerHospital === 'All' ? 'active' : ''}`} onClick={() => setLedgerHospital('All')}>All hospitals ({procedures.length})</button>
          {hospitals.map(h => (
            <button key={h.id} className={`filter-chip ${ledgerHospital === String(h.id) ? 'active' : ''}`} onClick={() => setLedgerHospital(String(h.id))}>
              {h.name} ({procedures.filter(p => p.hospital_id === h.id).length})
            </button>
          ))}
        </div>

        <div className="ledger-filters">
          <div className="lf-field">
            <label htmlFor="lf-service">Service</label>
            <select id="lf-service" className="form-select" value={ledgerService} onChange={e => setLedgerService(e.target.value)}>
              <option value="All">All services</option>
              {serviceOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="lf-field">
            <label htmlFor="lf-date">Date</label>
            <select id="lf-date" className="form-select" value={ledgerDate} onChange={e => setLedgerDate(e.target.value)}>
              <option value="all">All dates</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
          {ledgerDate === 'custom' && (
            <>
              <div className="lf-field"><label htmlFor="lf-from">From</label><input id="lf-from" type="date" className="form-input" value={ledgerRange.from} onChange={e => setLedgerRange({ ...ledgerRange, from: e.target.value })} /></div>
              <div className="lf-field"><label htmlFor="lf-to">To</label><input id="lf-to" type="date" className="form-input" value={ledgerRange.to} onChange={e => setLedgerRange({ ...ledgerRange, to: e.target.value })} /></div>
            </>
          )}
          {active && <button className="btn btn-outline btn-sm lf-clear" onClick={clearFilters}><X size={14} /> Clear filters</button>}
        </div>

        {active && (
          <div className="lf-applied">
            Showing <strong>{list.length}</strong> of {procedures.length} entries
            {ledgerHospital !== 'All' && <span className="lf-tag">{hospitals.find(h => h.id === Number(ledgerHospital))?.name}</span>}
            {ledgerService !== 'All' && <span className="lf-tag">{ledgerService}</span>}
            {ledgerDate !== 'all' && <span className="lf-tag">{dateLabel[ledgerDate]}{ledgerDate === 'custom' && (ledgerRange.from || ledgerRange.to) ? `: ${ledgerRange.from || '…'} → ${ledgerRange.to || '…'}` : ''}</span>}
          </div>
        )}

        <div className="card"><div className="card-body compact"><div className="table-wrap"><table className="data-table"><thead><tr>
          <th style={{ width: 32 }}></th><th>Date</th><th>Hospital</th><th>Service</th><th>Cases</th><th>Gross</th><th>Net Expected</th><th></th>
        </tr></thead><tbody>
          {list.map(p => (<>
            <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}>
              <td>{expandedRow === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
              <td className="nowrap">{formatDate(p.date)}</td><td className="font-semibold">{p.hospital_name}</td><td>{p.procedure_type}</td><td>{p.cases}</td>
              <GrossCell p={p} /><td className="amount text-green font-semibold">{formatMoney(p.net_expected)}</td>
              <td className="nowrap">
                <button className="btn-ghost btn-sm" aria-label="Edit entry" title="Edit" onClick={(e) => { e.stopPropagation(); openEditEntry(p) }}><Pencil size={14} /></button>
                <button className="btn-ghost btn-sm" aria-label="Delete entry" title="Delete" onClick={(e) => { e.stopPropagation(); deleteProcedure(p.id) }}><Trash2 size={14} /></button>
              </td>
            </tr>
            {expandedRow === p.id && (
              <tr key={`${p.id}-detail`}><td colSpan={8}><div className="row-detail"><div className="row-detail-grid">
                <div className="row-detail-item"><label>Per case</label><span>{formatMoney(p.gross_amount / (p.cases || 1))}</span></div>
                <div className="row-detail-item"><label>Doctor Share</label><span>{formatMoney(p.doctor_share)}</span></div>
                <div className="row-detail-item"><label>TDS</label><span className="text-red">−{formatMoney(p.tds_amount)}</span></div>
                <div className="row-detail-item"><label>Deductions</label><span className="text-red">−{formatMoney(p.deduction_amount)}</span></div>
                <div className="row-detail-item"><label>Net Expected</label><span className="text-green font-bold">{formatMoney(p.net_expected)}</span></div>
              </div></div></td></tr>
            )}
          </>))}
          {list.length === 0 && <tr><td colSpan={8} className="text-center text-muted" style={{ padding: '32px' }}>{procedures.length === 0 ? 'No entries yet' : 'No entries match these filters'}</td></tr>}
        </tbody></table></div></div></div>
      </div>
    )
  }

  // ═══════════════════════════════════════
  // RENDER: Hospitals
  // ═══════════════════════════════════════

  const renderHospitals = () => (
    <div className="animate-in">
      <div className="page-header">
        <div><h1>Hospitals</h1><p className="page-subtitle">Payout rules, services & pricing</p></div>
        <button className="btn btn-primary" onClick={openAddHospital}><Plus size={16} /> Add Hospital</button>
      </div>

      {hospitals.length === 0 ? (
        <div className="card"><div className="empty-state">
          <Building2 size={56} className="empty-state-icon" />
          <h3>No hospitals yet</h3>
          <p>Add your first hospital to start tracking revenue.</p>
          <button className="btn btn-primary" onClick={openAddHospital}><Plus size={16} /> Add Hospital</button>
        </div></div>
      ) : (
        <div className="hospital-grid">
          {hospitals.map(h => {
            const m = dashboard?.hospitalSummary?.find(s => s.id === h.id)
            return (
              <article key={h.id} className="hospital-card">
                <div className="hospital-cover">
                  <span className="hospital-initials" aria-hidden="true">{h.name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}</span>
                  <div className="hospital-actions">
                    <button className="btn-ghost btn-sm hospital-action" aria-label="Edit hospital" title="Edit" onClick={() => openEditHospital(h)}><Pencil size={14} /></button>
                    <button className="btn-ghost btn-sm hospital-action" aria-label="Delete hospital" title="Delete" onClick={() => deleteHospital(h.id)}><Trash2 size={14} /></button>
                  </div>
                  <div className="hospital-cover-meta">
                    <strong>{describeRule(h)}</strong>
                    <span>{h.tds_rate}% TDS · {h.deduction_rate}% deductions · settles in {h.settlement_cycle}</span>
                  </div>
                </div>
                <h3>{h.name}</h3>
                <p>{h.location} · {h.services.length} service{h.services.length === 1 ? '' : 's'} · <span className={(m?.pending || 0) > 0 ? 'text-amber font-semibold' : ''}>{formatMoney(m?.pending || 0)} pending</span></p>

                <div className="service-chips">
                  {h.services.map(s => (
                    <button key={s.id} type="button" className="service-chip" onClick={() => openServiceModal(h, s)} title="Edit service">
                      <span className="service-chip-name">{s.name}</span>
                      <span className="service-chip-amt">{s.types.length > 0 ? `${s.types.length} type${s.types.length > 1 ? 's' : ''}` : formatMoney(s.default_amount)}</span>
                      <Pencil size={12} className="service-chip-edit" />
                    </button>
                  ))}
                  <button type="button" className="service-chip add" onClick={() => openServiceModal(h, null)}><Plus size={14} /> Add Service</button>
                </div>

                {h.finance_contact_name && (
                  <div className="finance-contact">
                    <strong>{h.finance_contact_name}</strong>
                    {h.finance_contact_email && <div>{h.finance_contact_email}</div>}
                    {h.finance_contact_phone && <div>{h.finance_contact_phone}</div>}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )

  // ═══════════════════════════════════════
  // RENDER: Payouts
  // ═══════════════════════════════════════

  const renderPayouts = () => (
    <div className="animate-in">
      <div className="page-header">
        <div><h1>Payments</h1><p className="page-subtitle">Money received from hospitals</p></div>
        <button className="btn btn-primary" onClick={() => { setPayoutForm(EMPTY_PAYOUT()); setEditingPayout(null); setPayoutError(''); setShowModal('payout') }}><Plus size={16} /> Record Payment</button>
      </div>

      {(() => {
        const settle = (dashboard?.hospitalSummary || []).filter(h => h.earned > 0)
        if (settle.length === 0) return null
        return (
          <div className="card mb-6"><div className="card-header"><h3>Amount to be Settled</h3><span className="text-xs text-muted">Earned − Received (Under Review not counted as received)</span></div>
            <div className="card-body compact"><div className="table-wrap"><table className="data-table"><thead><tr>
              <th>Hospital</th><th>Earned</th><th>Received</th><th>Under Review</th><th>To be Settled</th>
            </tr></thead><tbody>
              {settle.map(h => (
                <tr key={h.id}><td className="font-semibold">{h.name}</td>
                  <td className="amount">{formatMoney(h.earned)}</td>
                  <td className="amount text-green">{formatMoney(h.received)}</td>
                  <td className="amount text-amber">{formatMoney(h.under_review)}</td>
                  <td className="amount"><span className={`settle-amount ${h.to_be_settled > 0 ? 'due' : 'clear'}`}>{formatMoney(h.to_be_settled)}</span></td></tr>
              ))}
            </tbody></table></div></div>
          </div>
        )
      })()}

      {payouts.length === 0 ? (
        <div className="card"><div className="empty-state">
          <Receipt size={56} className="empty-state-icon" />
          <h3>No payments recorded</h3>
          <p>Record a payment when a hospital settles your dues — fully, partially, or pending verification.</p>
        </div></div>
      ) : (
        <div className="card"><div className="card-header"><h3>All payments</h3><StatusLegend /></div><div className="card-body compact"><div className="table-wrap"><table className="data-table"><thead><tr>
          <th>Date</th><th>Hospital</th><th>Reference</th><th>Amount</th><th>Status</th><th></th>
        </tr></thead><tbody>
          {payouts.map(py => (
            <tr key={py.id} className={`status-row ${payoutBadge(py.status)}`}>
              <td className="nowrap">{formatDate(py.date)}</td><td className="font-semibold">{py.hospital_name}</td><td>{py.transaction_ref || '—'}</td>
              <td className="amount">{formatMoney(py.actual_net)}</td>
              <td><PayoutStatus p={py} onChange={requestStatusChange} /></td>
              <td><button className="btn-ghost btn-sm" aria-label="Edit payment" title="Edit" disabled={py.status === 'Rejected'} onClick={() => openEditPayout(py)}><Pencil size={14} /></button></td>
            </tr>
          ))}
        </tbody></table></div></div></div>
      )}
    </div>
  )

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

  const closeModal = () => { setShowModal(null); setServiceModal(null); setEditingEntry(null); setEditingPayout(null); setEditingHospital(null) }

  const renderModals = () => {
    if (statusChange) {
      const { p, status } = statusChange
      return (
        <div className="modal-backdrop" onClick={() => setStatusChange(null)}>
          <div className="modal modal-compact animate-slide-up" role="alertdialog" aria-labelledby="status-title" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 id="status-title">Change payment status?</h2><button className="btn-ghost" aria-label="Close" onClick={() => setStatusChange(null)}><X size={20} /></button></div>
            <div className="modal-body">
              <p className="text-sm text-secondary" style={{ margin: '0 0 16px' }}>
                {p.hospital_name} · {formatDate(p.date)} · <strong>{formatMoney(p.actual_net)}</strong>{p.transaction_ref ? ` · ${p.transaction_ref}` : ''}
              </p>
              <div className={`status-change ${payoutBadge(status)}`}>
                <span className={`badge ${payoutBadge(p.status)}`}>{statusLabel(p.status)}</span>
                <ArrowRight size={16} className="text-muted" />
                <span className={`badge ${payoutBadge(status)}`}>{statusLabel(status)}</span>
              </div>
              <p className="text-xs text-muted" style={{ margin: '16px 0 0' }}>
                {status === 'Under Review' ? 'This amount will move out of Received until it is verified.' : 'This amount will count as Received.'}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setStatusChange(null)}>Cancel</button>
              <button type="button" className={`btn ${status === 'Under Review' ? 'btn-primary' : 'btn-success'}`} onClick={confirmStatusChange}>Confirm</button>
            </div>
          </div>
        </div>
      )
    }

    if (!showModal) return null

    if (showModal === 'entry') {
      const preview = previewNet(entryHospital, entryForm.amount, entryForm.cases)
      const types = entryService?.types || []
      return (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal modal-compact animate-slide-up" role="dialog" aria-labelledby="entry-title" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 id="entry-title">{editingEntry ? 'Edit Entry' : 'Add Entry'}</h2><button className="btn-ghost" aria-label="Close" onClick={closeModal}><X size={20} /></button></div>
            <form onSubmit={e => { e.preventDefault(); saveEntry(false) }}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-field full">
                    <label className="form-label" htmlFor="entry-hospital">Hospital</label>
                    <select id="entry-hospital" className="form-select" value={entryForm.hospital_id} onChange={e => selectHospital(e.target.value)} autoFocus={!entryForm.hospital_id} disabled={!!editingEntry}>
                      <option value="">Select hospital…</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>

                  {entryHospital && (
                    <div className="form-field full">
                      <label className="form-label" htmlFor="entry-service">Service</label>
                      <select id="entry-service" className="form-select" value={entryForm.service_id} onChange={e => setEntryForm(applyService(entryForm, e.target.value))}>
                        <option value="">Select service…</option>
                        {entryHospital.services.map(s => <option key={s.id} value={s.id}>{s.name}{s.types.length === 0 ? ` — ${formatMoney(s.default_amount)}` : ''}</option>)}
                        <option value={MANUAL}>Other (enter manually)</option>
                      </select>
                      {entryHospital.services.length === 0 && (
                        <span className="form-hint">No services configured for {entryHospital.name}. <button type="button" className="link-btn" onClick={() => openServiceModal(entryHospital, null)}>Add one</button> or enter manually.</span>
                      )}
                    </div>
                  )}

                  {entryForm.service_id === MANUAL && (
                    <div className="form-field full">
                      <label className="form-label" htmlFor="entry-manual">Service name</label>
                      <input id="entry-manual" className="form-input" list="service-suggestions" value={entryForm.manual_service} onChange={e => setEntryForm({ ...entryForm, manual_service: e.target.value })} placeholder="e.g. Consultation" />
                      <datalist id="service-suggestions">{SERVICE_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                    </div>
                  )}

                  {types.length > 0 && (
                    <div className="form-field full">
                      <label className="form-label" htmlFor="entry-type">{entryService.name} Type</label>
                      <select id="entry-type" className="form-select" value={entryForm.service_type_id} onChange={e => selectType(e.target.value)}>
                        <option value="">Select type…</option>
                        {types.map(t => <option key={t.id} value={t.id}>{t.name} — {formatMoney(t.amount)}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="form-field">
                    <label className="form-label" htmlFor="entry-amount">Amount per case (₹)</label>
                    <input id="entry-amount" className="form-input" type="number" min="0" inputMode="numeric" value={entryForm.amount} onChange={e => setEntryForm({ ...entryForm, amount: e.target.value })} placeholder="0" />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="entry-cases">Cases</label>
                    <input id="entry-cases" className="form-input" type="number" min="1" inputMode="numeric" value={entryForm.cases} onChange={e => setEntryForm({ ...entryForm, cases: e.target.value })} />
                  </div>
                  <div className="form-field full">
                    <label className="form-label" htmlFor="entry-date">Date</label>
                    <input id="entry-date" className="form-input" type="date" value={entryForm.date} onChange={e => setEntryForm({ ...entryForm, date: e.target.value })} />
                  </div>
                </div>

                {preview && Number(entryForm.amount) > 0 && (
                  <div className="entry-summary">
                    <span>{Number(entryForm.cases) > 1 ? `${entryForm.cases} × ${formatMoney(entryForm.amount)} = ${formatMoney(preview.gross)} gross` : `${formatMoney(preview.gross)} gross`} · {describeRule(entryHospital)}</span>
                    <strong>Net expected {formatMoney(preview.net)}</strong>
                  </div>
                )}
                {entryError && <div className="form-error" role="alert">{entryError}</div>}
              </div>
              <div className="modal-footer">
                {editingEntry
                  ? <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
                  : <button type="button" className="btn btn-outline" onClick={() => saveEntry(true)} disabled={saving}>Save & Add Another</button>}
                <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Saving…' : editingEntry ? 'Save Changes' : 'Save Entry'}</button>
              </div>
            </form>
          </div>
        </div>
      )
    }

    if (showModal === 'service' && serviceModal) {
      const f = serviceModal.form
      return (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal modal-compact animate-slide-up" role="dialog" aria-labelledby="service-title" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 id="service-title">{serviceModal.service_id ? 'Edit Service' : 'Add Service'} <span className="text-sm text-muted font-normal">· {serviceModal.hospital_name}</span></h2><button className="btn-ghost" aria-label="Close" onClick={closeModal}><X size={20} /></button></div>
            <form onSubmit={saveService}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-field full">
                    <label className="form-label" htmlFor="svc-name">Service name</label>
                    <input id="svc-name" className="form-input" list="svc-suggestions" value={f.name} autoFocus
                      onChange={e => setServiceForm({ name: e.target.value, showTypes: f.showTypes || /surg/i.test(e.target.value) })} placeholder="Consultation" />
                    <datalist id="svc-suggestions">{SERVICE_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                  </div>
                  {!f.showTypes && (
                    <div className="form-field full">
                      <label className="form-label" htmlFor="svc-amount">Default amount (₹)</label>
                      <input id="svc-amount" className="form-input" type="number" min="0" inputMode="numeric" value={f.default_amount} onChange={e => setServiceForm({ default_amount: e.target.value })} placeholder="1000" />
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm" style={{ margin: '12px 0' }}>
                  <input type="checkbox" checked={f.showTypes} onChange={e => setServiceForm({ showTypes: e.target.checked, types: e.target.checked && f.types.length === 0 ? [{ name: '', amount: '', key: `n${Date.now()}` }] : f.types })} />
                  This service has types with their own prices (e.g. surgery types)
                </label>

                {f.showTypes && (
                  <div className="type-list">
                    {f.types.map(t => (
                      <div key={t.key} className="type-row">
                        <input className="form-input" aria-label="Type name" value={t.name} onChange={e => updateType(t.key, { name: e.target.value })} placeholder="Cataract Surgery" />
                        <input className="form-input" aria-label="Type amount" type="number" min="0" inputMode="numeric" value={t.amount} onChange={e => updateType(t.key, { amount: e.target.value })} placeholder="₹" />
                        <button type="button" className="btn-ghost btn-sm text-red" aria-label="Remove type" onClick={() => removeTypeRow(t.key)}><X size={14} /></button>
                      </div>
                    ))}
                    <button type="button" className="link-btn" onClick={addTypeRow}><Plus size={14} /> Add type</button>
                  </div>
                )}
                {serviceError && <div className="form-error" role="alert">{serviceError}</div>}
              </div>
              <div className="modal-footer">
                {serviceModal.service_id && <button type="button" className="btn btn-outline text-red" onClick={() => { closeModal(); deleteService(serviceModal.service_id) }}>Remove</button>}
                <button type="submit" className="btn btn-primary">Save Service</button>
              </div>
            </form>
          </div>
        </div>
      )
    }

    if (showModal === 'hospital') {
      return (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal animate-slide-up" role="dialog" aria-labelledby="hosp-title" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 id="hosp-title">{editingHospital ? 'Edit Hospital' : 'Add Hospital'}</h2><button className="btn-ghost" aria-label="Close" onClick={closeModal}><X size={20} /></button></div>
            <form onSubmit={saveHospital}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-field"><label className="form-label" htmlFor="h-name">Hospital Name *</label><input id="h-name" className="form-input" required autoFocus value={hospForm.name} onChange={e => setHospForm({ ...hospForm, name: e.target.value })} /></div>
                  <div className="form-field"><label className="form-label" htmlFor="h-loc">Location</label><input id="h-loc" className="form-input" value={hospForm.location} onChange={e => setHospForm({ ...hospForm, location: e.target.value })} /></div>
                  <div className="form-field full">
                    <span className="form-label">Payment Rule</span>
                    <div className="basis-toggle" role="radiogroup" aria-label="Payment rule">
                      <button type="button" role="radio" aria-checked={hospForm.payout_basis === 'share'} className={hospForm.payout_basis === 'share' ? 'active' : ''} onClick={() => setHospForm({ ...hospForm, payout_basis: 'share' })}>Revenue Share<small>% of gross billing</small></button>
                      <button type="button" role="radio" aria-checked={hospForm.payout_basis === 'fixed'} className={hospForm.payout_basis === 'fixed' ? 'active' : ''} onClick={() => setHospForm({ ...hospForm, payout_basis: 'fixed' })}>Fixed Fee<small>flat amount per case</small></button>
                    </div>
                  </div>
                  {hospForm.payout_basis === 'fixed'
                    ? <div className="form-field"><label className="form-label" htmlFor="h-fee">Fixed Fee per Case (₹)</label><input id="h-fee" className="form-input" type="number" min="0" value={hospForm.fixed_fee} onChange={e => setHospForm({ ...hospForm, fixed_fee: e.target.value })} /></div>
                    : <div className="form-field"><label className="form-label" htmlFor="h-pct">Revenue Share %</label><input id="h-pct" className="form-input" type="number" min="0" max="100" value={hospForm.payout_percentage} onChange={e => setHospForm({ ...hospForm, payout_percentage: e.target.value })} /></div>}
                  <div className="form-field"><label className="form-label" htmlFor="h-tds">TDS Rate %</label><input id="h-tds" className="form-input" type="number" min="0" value={hospForm.tds_rate} onChange={e => setHospForm({ ...hospForm, tds_rate: e.target.value })} /></div>
                  <div className="form-field"><label className="form-label" htmlFor="h-ded">Deduction Rate %</label><input id="h-ded" className="form-input" type="number" min="0" value={hospForm.deduction_rate} onChange={e => setHospForm({ ...hospForm, deduction_rate: e.target.value })} /></div>
                  <div className="form-field"><label className="form-label" htmlFor="h-cycle">Settlement Cycle</label><input id="h-cycle" className="form-input" value={hospForm.settlement_cycle} onChange={e => setHospForm({ ...hospForm, settlement_cycle: e.target.value })} /></div>
                  <div className="form-field"><label className="form-label" htmlFor="h-fc">Finance Contact</label><input id="h-fc" className="form-input" value={hospForm.finance_contact_name} onChange={e => setHospForm({ ...hospForm, finance_contact_name: e.target.value })} placeholder="Name" /></div>
                  <div className="form-field"><label className="form-label" htmlFor="h-fe">Contact Email</label><input id="h-fe" className="form-input" type="email" value={hospForm.finance_contact_email} onChange={e => setHospForm({ ...hospForm, finance_contact_email: e.target.value })} /></div>
                  <div className="form-field"><label className="form-label" htmlFor="h-fp">Contact Phone</label><input id="h-fp" className="form-input" value={hospForm.finance_contact_phone} onChange={e => setHospForm({ ...hospForm, finance_contact_phone: e.target.value })} /></div>
                </div>
                {hospError && <div className="form-error" role="alert">{hospError}</div>}
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button><button type="submit" className="btn btn-primary">{editingHospital ? 'Save Changes' : 'Save & Add Services'}</button></div>
            </form>
          </div>
        </div>
      )
    }

    if (showModal === 'payout') {
      return (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal modal-compact animate-slide-up" role="dialog" aria-labelledby="pay-title" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 id="pay-title">{editingPayout ? 'Edit Payment' : 'Record Payment'}</h2><button className="btn-ghost" aria-label="Close" onClick={closeModal}><X size={20} /></button></div>
            <form onSubmit={savePayout}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-field full">
                    <label className="form-label" htmlFor="p-hosp">Hospital</label>
                    <select id="p-hosp" className="form-select" autoFocus={!editingPayout} disabled={!!editingPayout} value={payoutForm.hospital_id} onChange={e => setPayoutForm({ ...payoutForm, hospital_id: e.target.value })}>
                      <option value="">Select hospital…</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                  <div className="form-field"><label className="form-label" htmlFor="p-amt">Amount Received (₹)</label><input id="p-amt" className="form-input" type="number" min="0" inputMode="numeric" value={payoutForm.actual_net} onChange={e => setPayoutForm({ ...payoutForm, actual_net: e.target.value })} /></div>
                  <div className="form-field"><label className="form-label" htmlFor="p-date">Payment Date</label><input id="p-date" className="form-input" type="date" value={payoutForm.date} onChange={e => setPayoutForm({ ...payoutForm, date: e.target.value })} /></div>
                  <div className="form-field full"><label className="form-label" htmlFor="p-ref">Reference</label><input id="p-ref" className="form-input" value={payoutForm.transaction_ref} onChange={e => setPayoutForm({ ...payoutForm, transaction_ref: e.target.value })} placeholder="UTR / NEFT / Cheque No." /></div>
                  <div className="form-field full">
                    <span className="form-label">Status</span>
                    <div className="basis-toggle three" role="radiogroup" aria-label="Payment status">
                      {PAYOUT_STATUS_OPTIONS.map(o => (
                        <button key={o.value} type="button" role="radio" aria-checked={payoutForm.status === o.value} className={payoutForm.status === o.value ? 'active' : ''} onClick={() => setPayoutForm({ ...payoutForm, status: o.value })}>
                          {o.label}<small>{o.hint}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {payoutError && <div className="form-error" role="alert">{payoutError}</div>}
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button><button type="submit" className="btn btn-success">{editingPayout ? 'Save Changes' : 'Save Payment'}</button></div>
            </form>
          </div>
        </div>
      )
    }

    return null
  }

  const renderPage = () => {
    switch (page) {
      case 'Ledger': return renderLedger()
      case 'Hospitals': return renderHospitals()
      case 'Payouts': return renderPayouts()
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
        <MeshGradient className="login-mesh" />
        <div className="login-mesh-overlay" aria-hidden="true" />
        <div className="login-card">
          <button className="login-back" onClick={() => setShowAuth(false)}><ArrowLeft size={14} /> Back to home</button>
          {authView === 'login' && (<>
            <div className="login-header">
              <h1><span className="wordmark large">Doc<span>Track</span><i /></span></h1>
              <p>Revenue Reconciliation Platform</p>
            </div>
            <form className="login-form" onSubmit={handleLogin}>
              <Field id="login-user" label="Username or Email" icon={User} value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} autoComplete="username" />
              <Field id="login-pw" label="Password" icon={Lock} type={showPw ? 'text' : 'password'} value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} autoComplete="current-password"
                trailing={<button type="button" className="ff-eye" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={17} /> : <Eye size={17} />}</button>} />
              <label className="ff-remember">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /> Remember me
              </label>
              {loginError && <div className="login-error" role="alert">{loginError}</div>}
              <InteractiveHoverButton type="submit" className="block" text="Login" />
            </form>
            <div className="login-switch"><button onClick={() => { setAuthView('signup'); setSignupError('') }}>Don't have an account? Create one</button></div>
          </>)}

          {authView === 'signup' && (<>
            <div className="login-header">
              <span className="wordmark" style={{ display: 'inline-flex', marginBottom: 12 }}>Doc<span>Track</span><i /></span>
              <h1>Create Account</h1>
              <p>Set up your revenue tracking</p>
            </div>
            <form className="login-form" onSubmit={handleSignup}>
              <Field id="su-name" label="Full Name" icon={User} value={signupForm.name || ''} onChange={e => setSignupForm({ ...signupForm, name: e.target.value })} autoComplete="name" />
              <Field id="su-email" label="Email" icon={Mail} type="email" value={signupForm.email || ''} onChange={e => setSignupForm({ ...signupForm, email: e.target.value })} autoComplete="email" />
              <Field id="su-user" label="Username" icon={AtSign} value={signupForm.username || ''} onChange={e => setSignupForm({ ...signupForm, username: e.target.value })} autoComplete="username" />
              <Field id="su-pw" label="Password" icon={Lock} type="password" value={signupForm.password || ''} onChange={e => setSignupForm({ ...signupForm, password: e.target.value })} autoComplete="new-password" />
              <Field id="su-pw2" label="Confirm Password" icon={Lock} type="password" value={signupForm.confirmPassword || ''} onChange={e => setSignupForm({ ...signupForm, confirmPassword: e.target.value })} autoComplete="new-password" />
              {signupError && <div className="login-error" role="alert">{signupError}</div>}
              <InteractiveHoverButton type="submit" className="block" text="Create Account" />
            </form>
            <div className="login-switch"><button onClick={() => { setAuthView('login'); setLoginError('') }}>Already have an account? Log in</button></div>
          </>)}

          {authView === 'success' && (
            <div className="text-center" style={{ padding: '32px 0' }}>
              <CheckCircle2 size={48} className="text-green" style={{ margin: '0 auto 16px' }} />
              <h2 style={{ color: '#f8fafc', marginBottom: 8 }}>Account Created</h2>
              <p className="text-muted mb-6">You can now log in with your credentials.</p>
              <ShinyButton className="block" onClick={() => { setAuthView('login'); setSignupForm({}) }}>Go to Login</ShinyButton>
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
    { key: 'Payouts', icon: IndianRupee, label: 'Payments' },
  ]

  return (<>
    <div className="app-shell">
      <button className="mobile-menu-btn" aria-label="Menu" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-inner">
            <div className="brand-text"><span className="wordmark">Doc<span>Track</span><i /></span><span className="brand-tagline">Revenue Reconciliation</span></div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item nav-cta" onClick={() => { openEntry(); setSidebarOpen(false) }}>
            <span className="nav-icon"><Plus size={18} /></span>Add Entry
          </button>
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
    {toast && <div className="toast" role="status"><CheckCircle2 size={16} /> {toast}</div>}
  </>)
}

export default App
