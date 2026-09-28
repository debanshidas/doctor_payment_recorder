import { useMemo, useState } from 'react'
import './App.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const hospitalsSeed = [
  {
    id: 1,
    name: 'Kauvery Hospital',
    location: 'Bangalore',
    services: [
      { name: 'Consultation', rate: 1000 },
      { name: 'Procedure', rate: 4500 },
      { name: 'Surgery', rate: 15000 },
    ],
  },
  {
    id: 2,
    name: 'Apollo Hospital',
    location: 'Bangalore',
    services: [
      { name: 'Consultation', rate: 1200 },
      { name: 'Follow-up', rate: 700 },
    ],
  },
]

const recordsSeed = [
  { id: 1, hospital: 'Kauvery Hospital', date: '2026-09-02', service: 'Consultation', cases: 5, expectedAmount: 5000 },
  { id: 2, hospital: 'Apollo Hospital', date: '2026-09-05', service: 'Procedure', cases: 3, expectedAmount: 13500 },
  { id: 3, hospital: 'Kauvery Hospital', date: '2026-09-08', service: 'Surgery', cases: 2, expectedAmount: 30000 },
]

const paymentsSeed = [
  { id: 1, hospital: 'Kauvery Hospital', date: '2026-09-12', amount: 18000, status: 'Paid' },
  { id: 2, hospital: 'Apollo Hospital', date: '2026-09-18', amount: 12000, status: 'Pending' },
  { id: 3, hospital: 'Kauvery Hospital', date: '2026-09-20', amount: 9000, status: 'Partially Paid' },
]

const discrepanciesSeed = [
  { id: 1, hospital: 'Kauvery Hospital', expectedAmount: 20000, receivedAmount: 12000, difference: 8000, status: 'Open' },
  { id: 2, hospital: 'Apollo Hospital', expectedAmount: 18000, receivedAmount: 18000, difference: 0, status: 'Resolved' },
]

function App() {
  const [session, setSession] = useState({ loggedIn: false, role: 'doctor', user: null })
  const [activePage, setActivePage] = useState('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [hospitals, setHospitals] = useState(hospitalsSeed)
  const [records, setRecords] = useState(recordsSeed)
  const [payments, setPayments] = useState(paymentsSeed)
  const [discrepancies, setDiscrepancies] = useState(discrepanciesSeed)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    location: 'Bangalore',
    serviceName: '',
    serviceRate: '1000',
    services: [{ name: 'Consultation', rate: 1000 }],
  })

  const [recordForm, setRecordForm] = useState({
    hospital: hospitalsSeed[0].name,
    date: '2026-09-15',
    service: hospitalsSeed[0].services[0].name,
    cases: '5',
  })

  const [paymentForm, setPaymentForm] = useState({
    hospital: hospitalsSeed[0].name,
    date: '2026-09-18',
    amount: '15000',
    status: 'Paid',
  })

  const selectedHospital = hospitals.find((hospital) => hospital.name === recordForm.hospital) || hospitals[0]
  const selectedRate = selectedHospital?.services.find((service) => service.name === recordForm.service)?.rate || 0
  const expectedValue = Number(recordForm.cases || 0) * selectedRate

  const hospitalSummary = useMemo(() => {
    return hospitals.map((hospital) => {
      const expected = records
        .filter((record) => record.hospital === hospital.name)
        .reduce((sum, record) => sum + Number(record.expectedAmount || 0), 0)

      const received = payments
        .filter((payment) => payment.hospital === hospital.name)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

      return {
        ...hospital,
        expected,
        received,
        outstanding: expected - received,
      }
    })
  }, [hospitals, payments, records])

  const navItems = ['Dashboard', 'My Hospitals', 'My Records', 'My Payments', 'Discrepancies']
  const totalExpected = hospitalSummary.reduce((sum, item) => sum + item.expected, 0)
  const totalReceived = hospitalSummary.reduce((sum, item) => sum + item.received, 0)
  const totalOutstanding = totalExpected - totalReceived
  const totalDiscrepancy = discrepancies
    .filter((item) => item.status !== 'Resolved')
    .reduce((sum, item) => sum + Number(item.difference || 0), 0)

  const followUpList = [
    { label: 'Pending payments', value: `${payments.filter((item) => item.status === 'Pending').length} items`, tone: 'warning' },
    { label: 'Partially paid', value: `${payments.filter((item) => item.status === 'Partially Paid').length} items`, tone: 'neutral' },
    { label: 'Open discrepancies', value: `${discrepancies.filter((item) => item.status === 'Open').length} items`, tone: 'danger' },
  ]

  const handleLogin = (event) => {
    event.preventDefault()
    const username = loginForm.username.trim()
    const password = loginForm.password.trim()

    if (username === 'admin2026' && password === 'admin@123') {
      setSession({ loggedIn: true, role: 'admin', user: { name: 'Admin User', username } })
      setActivePage('Dashboard')
      setLoginError('')
      return
    }

    if (username === 'doctor2026' && password === 'doc@123') {
      setSession({ loggedIn: true, role: 'doctor', user: { name: 'Dr. Aisha Nair', username } })
      setActivePage('Dashboard')
      setLoginError('')
      return
    }

    setLoginError('Invalid username or password.')
  }

  const handleLogout = () => {
    setSession({ loggedIn: false, role: 'doctor', user: null })
    setActivePage('Dashboard')
    setSidebarOpen(false)
    setLoginForm({ username: '', password: '' })
    setLoginError('')
  }

  const addService = () => {
    const name = hospitalForm.serviceName.trim()
    const rate = Number(hospitalForm.serviceRate || 0)

    if (!name || rate <= 0) return

    const exists = hospitalForm.services.some(
      (service) => service.name.toLowerCase() === name.toLowerCase(),
    )

    if (exists) return

    setHospitalForm((current) => ({
      ...current,
      serviceName: '',
      serviceRate: '1000',
      services: [...current.services, { name, rate }],
    }))
  }

  const handleHospitalSave = (event) => {
    event.preventDefault()
    if (!hospitalForm.name.trim()) return

    const newHospital = {
      id: Date.now(),
      name: hospitalForm.name.trim(),
      location: hospitalForm.location || 'Bangalore',
      services: hospitalForm.services.length
        ? hospitalForm.services
        : [{ name: hospitalForm.serviceName.trim() || 'Consultation', rate: Number(hospitalForm.serviceRate || 0) }],
    }

    setHospitals((current) => [newHospital, ...current])
    setRecordForm((current) => ({
      ...current,
      hospital: newHospital.name,
      service: newHospital.services[0]?.name || current.service,
    }))
    setPaymentForm((current) => ({
      ...current,
      hospital: newHospital.name,
    }))

    setHospitalForm({
      name: '',
      location: 'Bangalore',
      serviceName: '',
      serviceRate: '1000',
      services: [{ name: 'Consultation', rate: 1000 }],
    })
  }

  const handleRecordSave = (event) => {
    event.preventDefault()
    setRecords((current) => [{
      id: Date.now(),
      hospital: recordForm.hospital,
      date: recordForm.date,
      service: recordForm.service,
      cases: Number(recordForm.cases || 0),
      expectedAmount: expectedValue,
    }, ...current])

    setRecordForm((current) => ({
      ...current,
      date: '2026-09-15',
      service: selectedHospital?.services[0]?.name || 'Consultation',
      cases: '5',
    }))
  }

  const handlePaymentSave = (event) => {
    event.preventDefault()
    setPayments((current) => [{
      id: Date.now(),
      hospital: paymentForm.hospital,
      date: paymentForm.date,
      amount: Number(paymentForm.amount || 0),
      status: paymentForm.status,
    }, ...current])

    setPaymentForm((current) => ({
      ...current,
      date: '2026-09-18',
      amount: '15000',
      status: 'Paid',
    }))
  }

  const handleRecordDelete = (recordId) => {
    setRecords((current) => current.filter((record) => record.id !== recordId))
    setConfirmDelete(null)
  }

  const handleHospitalDelete = (hospitalId) => {
    const hospital = hospitals.find((item) => item.id === hospitalId)
    if (!hospital) {
      setConfirmDelete(null)
      return
    }

    setHospitals((current) => current.filter((item) => item.id !== hospitalId))
    setRecords((current) => current.filter((record) => record.hospital !== hospital.name))
    setPayments((current) => current.filter((payment) => payment.hospital !== hospital.name))
    setDiscrepancies((current) => current.filter((item) => item.hospital !== hospital.name))
    setConfirmDelete(null)
  }

  const updateDiscrepancyStatus = (id, status) => {
    setDiscrepancies((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    )
  }

  const renderDashboard = () => (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>{session.role === 'admin' ? 'Admin Dashboard' : 'My Dashboard'}</h1>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><span>Expected Revenue</span><strong>{formatMoney(totalExpected)}</strong><small>Booked value</small></div>
        <div className="kpi-card"><span>Received Revenue</span><strong>{formatMoney(totalReceived)}</strong><small>Actual payments</small></div>
        <div className="kpi-card"><span>Outstanding Revenue</span><strong>{formatMoney(totalOutstanding)}</strong><small>Still due</small></div>
        <div className="kpi-card"><span>Discrepancy Amount</span><strong>{formatMoney(totalDiscrepancy)}</strong><small>Needs follow-up</small></div>
        <div className="kpi-card"><span>Hospitals</span><strong>{hospitals.length}</strong><small>Active accounts</small></div>
        <div className="kpi-card"><span>Records</span><strong>{records.length}</strong><small>Visits logged</small></div>
      </div>

      <div className="two-col-layout">
        <div className="panel">
          <div className="panel-header"><h3>Hospital-wise summary</h3><span className="chip neutral">Live</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Hospital</th><th>Expected</th><th>Received</th><th>Outstanding</th></tr></thead>
              <tbody>
                {hospitalSummary.map((hospital) => (
                  <tr key={hospital.id}><td>{hospital.name}</td><td>{formatMoney(hospital.expected)}</td><td>{formatMoney(hospital.received)}</td><td>{formatMoney(hospital.outstanding)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h3>Follow-up list</h3></div>
          <ul className="attention-list">
            {followUpList.map((item) => (
              <li key={item.label} className={`tone-${item.tone}`}>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )

  const renderHospitals = () => (
    <>
      <div className="page-header"><div><p className="eyebrow">Hospitals</p><h1>{session.role === 'admin' ? 'Hospital List' : 'My Hospitals'}</h1></div></div>
      {session.role === 'doctor' && (
        <div className="panel form-panel">
          <h3>Add Hospital</h3>
          <form className="grid-form" onSubmit={handleHospitalSave}>
            <label className="field"><span className="field-label">Hospital Name</span><input type="text" value={hospitalForm.name} onChange={(event) => setHospitalForm({ ...hospitalForm, name: event.target.value })} placeholder="Hospital name" /></label>
            <label className="field"><span className="field-label">Location</span><input type="text" value={hospitalForm.location} onChange={(event) => setHospitalForm({ ...hospitalForm, location: event.target.value })} placeholder="Bangalore" /></label>
            <label className="field"><span className="field-label">Service Name</span><input type="text" value={hospitalForm.serviceName} onChange={(event) => setHospitalForm({ ...hospitalForm, serviceName: event.target.value })} placeholder="Consultation" /></label>
            <label className="field"><span className="field-label">Service Rate (₹)</span><input type="number" min="0" value={hospitalForm.serviceRate} onChange={(event) => setHospitalForm({ ...hospitalForm, serviceRate: event.target.value })} placeholder="1000" /></label>
            <div className="field"><span className="field-label">&nbsp;</span><button type="button" className="secondary-btn" onClick={addService}>Add service</button></div>
            <div className="field full-span"><span className="field-label">&nbsp;</span><button type="submit" className="primary-btn">Save hospital</button></div>
          </form>
          <div className="service-list">{hospitalForm.services.map((service) => <span key={`${service.name}-${service.rate}`} className="service-pill">{service.name} · {formatMoney(service.rate)}</span>)}</div>
        </div>
      )}

      <div className="panel">
        <div className="table-wrap"><table><thead><tr><th>Hospital</th><th>Location</th><th>Services</th><th>Action</th></tr></thead><tbody>{hospitals.map((hospital) => <tr key={hospital.id}><td>{hospital.name}</td><td>{hospital.location}</td><td><div className="service-list compact-list">{hospital.services.map((service) => <span key={`${hospital.id}-${service.name}`} className="service-pill compact-pill">{service.name}: {formatMoney(service.rate)}</span>)}</div></td><td><button type="button" className="danger-text-btn" onClick={() => setConfirmDelete({ type: 'hospital', id: hospital.id, title: 'Delete this hospital?', message: 'Deleting the hospital may also affect its associated records.' })}>Delete</button></td></tr>)}</tbody></table></div>
      </div>
    </>
  )

  const renderRecords = () => (
    <>
      <div className="page-header"><div><p className="eyebrow">Records</p><h1>{session.role === 'admin' ? 'All Records' : 'My Records'}</h1></div></div>
      {session.role === 'doctor' && (
        <div className="panel form-panel">
          <h3>Add Visit Record</h3>
          <form className="grid-form" onSubmit={handleRecordSave}>
            <label className="field"><span className="field-label">Hospital</span><select value={recordForm.hospital} onChange={(event) => { const nextHospital = hospitals.find((hospital) => hospital.name === event.target.value); setRecordForm({ ...recordForm, hospital: event.target.value, service: nextHospital?.services[0]?.name || 'Consultation' }) }}>
              {hospitals.map((hospital) => <option key={hospital.id} value={hospital.name}>{hospital.name}</option>)}
            </select></label>
            <label className="field"><span className="field-label">Date</span><input type="date" value={recordForm.date} onChange={(event) => setRecordForm({ ...recordForm, date: event.target.value })} /></label>
            <label className="field"><span className="field-label">Service</span><select value={recordForm.service} onChange={(event) => setRecordForm({ ...recordForm, service: event.target.value })}>{(selectedHospital?.services || []).map((service) => <option key={service.name} value={service.name}>{service.name}</option>)}</select></label>
            <label className="field"><span className="field-label">Number of Cases</span><input type="number" min="0" value={recordForm.cases} onChange={(event) => setRecordForm({ ...recordForm, cases: event.target.value })} /></label>
            <label className="field"><span className="field-label">Rate per Case</span><input type="text" value={formatMoney(selectedRate)} readOnly /></label>
            <label className="field full-span"><span className="field-label">Expected Amount</span><input type="text" value={formatMoney(expectedValue)} readOnly /></label>
            <div className="field full-span"><span className="field-label">&nbsp;</span><button type="submit" className="primary-btn">Save record</button></div>
          </form>
        </div>
      )}
      <div className="panel"><div className="table-wrap"><table><thead><tr><th>Hospital</th><th>Date</th><th>Service</th><th>Cases</th><th>Expected</th><th>Action</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{record.hospital}</td><td>{record.date}</td><td>{record.service}</td><td>{record.cases}</td><td>{formatMoney(record.expectedAmount)}</td><td><button type="button" className="danger-text-btn" onClick={() => setConfirmDelete({ type: 'record', id: record.id, title: 'Delete this record?', message: 'This action cannot be undone.' })}>Delete</button></td></tr>)}</tbody></table></div></div>
    </>
  )

  const renderPayments = () => (
    <>
      <div className="page-header"><div><p className="eyebrow">Payments</p><h1>{session.role === 'admin' ? 'Payment Ledger' : 'My Payments'}</h1></div></div>
      {session.role === 'doctor' && (
        <div className="panel form-panel">
          <h3>Record Payment</h3>
          <form className="grid-form" onSubmit={handlePaymentSave}>
            <label className="field"><span className="field-label">Hospital</span><select value={paymentForm.hospital} onChange={(event) => setPaymentForm({ ...paymentForm, hospital: event.target.value })}>{hospitals.map((hospital) => <option key={hospital.id} value={hospital.name}>{hospital.name}</option>)}</select></label>
            <label className="field"><span className="field-label">Date</span><input type="date" value={paymentForm.date} onChange={(event) => setPaymentForm({ ...paymentForm, date: event.target.value })} /></label>
            <label className="field"><span className="field-label">Amount</span><input type="number" min="0" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} /></label>
            <label className="field"><span className="field-label">Status</span><select value={paymentForm.status} onChange={(event) => setPaymentForm({ ...paymentForm, status: event.target.value })}><option value="Paid">Paid</option><option value="Pending">Pending</option><option value="Partially Paid">Partially Paid</option><option value="Overdue">Overdue</option></select></label>
            <div className="field full-span"><span className="field-label">&nbsp;</span><button type="submit" className="primary-btn">Save payment</button></div>
          </form>
        </div>
      )}
      <div className="panel"><div className="table-wrap"><table><thead><tr><th>Hospital</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.hospital}</td><td>{payment.date}</td><td>{formatMoney(payment.amount)}</td><td><span className={`status-badge ${payment.status.toLowerCase().replace(/\s+/g, '-')}`}>{payment.status}</span></td></tr>)}</tbody></table></div></div>
    </>
  )

  const renderDiscrepancies = () => (
    <>
      <div className="page-header"><div><p className="eyebrow">Follow-up</p><h1>Discrepancies</h1></div></div>
      <div className="panel"><div className="table-wrap"><table><thead><tr><th>Hospital</th><th>Expected</th><th>Received</th><th>Difference</th><th>Status</th><th>Action</th></tr></thead><tbody>{discrepancies.map((item) => <tr key={item.id}><td>{item.hospital}</td><td>{formatMoney(item.expectedAmount)}</td><td>{formatMoney(item.receivedAmount)}</td><td>{formatMoney(item.difference)}</td><td><span className={`status-badge ${item.status.toLowerCase()}`}>{item.status}</span></td><td><select value={item.status} onChange={(event) => updateDiscrepancyStatus(item.id, event.target.value)}><option value="Open">Open</option><option value="Resolved">Resolved</option></select></td></tr>)}</tbody></table></div></div>
    </>
  )

  const renderPage = () => {
    if (activePage === 'Dashboard') return renderDashboard()
    if (activePage === 'My Hospitals') return renderHospitals()
    if (activePage === 'My Records') return renderRecords()
    if (activePage === 'My Payments') return renderPayments()
    if (activePage === 'Discrepancies') return renderDiscrepancies()
    return renderDashboard()
  }

  if (!session.loggedIn) {
    return (
      <div className="login-shell">
        <div className="login-hero-panel">
          <div className="hero-visual" aria-hidden="true">
            <div className="hero-glow hero-glow-one" />
            <div className="hero-glow hero-glow-two" />
            <div className="hero-grid" />
            <div className="hero-metric hero-metric-top">
              <span className="metric-label">Expected</span>
              <strong>₹48,500</strong>
            </div>
            <div className="hero-metric hero-metric-bottom">
              <span className="metric-label">Outstanding</span>
              <strong>₹9,500</strong>
            </div>
          </div>

          <div className="hero-copy">
            <p className="eyebrow neutral">Consultant revenue intelligence</p>
            <h1>Know what you should earn, what you received, and what still needs follow-up.</h1>
          </div>
        </div>

        <div className="login-card">
          <div className="login-mark">☼</div>
          <h2>Get Started</h2>
          <p className="login-subtitle">Welcome to Revenue Ledger — Let’s get started</p>

          <form className="login-form" onSubmit={handleLogin}>
            <label className="field">
              <span className="field-label">Your email</span>
              <input
                type="text"
                value={loginForm.username}
                onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
                placeholder="doctor@revenue.com"
              />
            </label>
            <label className="field">
              <span className="field-label">Create new password</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                placeholder="Enter password"
              />
            </label>
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="primary-btn full-width-btn">Create a new account</button>
          </form>

          <div className="login-note">
            <span>Already have account? <button type="button" className="inline-link" onClick={() => setLoginForm({ username: 'doctor2026', password: 'doc@123' })}>Login</button></span>
            <div className="demo-box"><strong>Demo accounts</strong><p>Doctor: doctor2026 / doc@123</p><p>Admin: admin2026 / admin@123</p></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="app-shell">
        <button type="button" className="mobile-toggle" aria-label="Toggle menu" onClick={() => setSidebarOpen((value) => !value)}>☰</button>
        <aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}>
          <div className="brand-block"><div className="brand-mark">VD</div><div><p className="eyebrow neutral">{session.role === 'admin' ? 'Admin' : 'Doctor'}</p><h2>Revenue Ledger</h2></div></div>
          <nav className="sidebar-nav" aria-label="Sidebar navigation">
            {navItems.map((item) => (
              <button key={item} type="button" className={activePage === item ? 'nav-item active' : 'nav-item'} onClick={() => { setActivePage(item); setSidebarOpen(false) }}>
                <span className="nav-icon">{item === 'Dashboard' ? '🏠' : item === 'My Hospitals' ? '🏥' : item === 'My Records' ? '🧾' : item === 'My Payments' ? '₹' : '⚠️'}</span>
                {item}
              </button>
            ))}
            <button type="button" className="nav-item logout-item" onClick={handleLogout}><span className="nav-icon">🚪</span>Logout</button>
          </nav>
        </aside>
        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        <main className="content-area">{renderPage()}</main>
      </div>

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>{confirmDelete.title}</h3>
            <p>{confirmDelete.message}</p>
            <div className="confirm-actions">
              <button type="button" className="secondary-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button type="button" className="danger-btn" onClick={() => {
                if (confirmDelete.type === 'record') {
                  handleRecordDelete(confirmDelete.id)
                } else {
                  handleHospitalDelete(confirmDelete.id)
                }
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
