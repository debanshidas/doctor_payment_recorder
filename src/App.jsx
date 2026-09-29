import { useMemo, useState, useEffect } from 'react'
import { Eye, EyeOff, LayoutDashboard, Building2, FileText, IndianRupee, AlertTriangle, LogOut, Menu, X, ArrowUpRight, BarChart3, Settings, Plus, User } from 'lucide-react'
import './App.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function usePersistentState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}
function App() {
  const [users, setUsers] = usePersistentState('doctrack_users', []);
  const [session, setSession] = usePersistentState('doctrack_session', { loggedIn: false, role: 'doctor', user: null });
  const [activePage, setActivePage] = useState('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false)
  
  const [authView, setAuthView] = useState('login')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [signupForm, setSignupForm] = useState({ username: '', password: '', confirmPassword: '' })
  const [signupError, setSignupError] = useState('')

  const [hospitals, setHospitals] = usePersistentState('doctrack_hospitals', []);
  const [records, setRecords] = usePersistentState('doctrack_records', []);
  const [payments, setPayments] = usePersistentState('doctrack_payments', []);
  const [discrepancies, setDiscrepancies] = usePersistentState('doctrack_discrepancies', []);
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [viewState, setViewState] = useState('list')

  const myHospitals = hospitals.filter(h => h.userId === session.user?.username)
  const myRecords = records.filter(r => r.userId === session.user?.username)
  const myPayments = payments.filter(p => p.userId === session.user?.username)
  const myDiscrepancies = discrepancies.filter(d => {
    const parentPayment = myPayments.find(p => p.hospital === d.hospital)
    return parentPayment ? true : false
  })

  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    location: 'Bangalore',
    serviceName: '',
    serviceRate: '1000',
    services: [{ name: 'Consultation', rate: 1000 }],
  })

  const [recordForm, setRecordForm] = useState({
    hospital: '',
    date: new Date().toISOString().split('T')[0],
    service: '',
    cases: '1',
  })

  const [paymentForm, setPaymentForm] = useState({
    hospital: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    status: 'Paid',
  })
  const selectedHospital = myHospitals.find((hospital) => hospital.name === recordForm.hospital) || myHospitals[0] || { services: [] }
  const selectedRate = selectedHospital?.services.find((service) => service.name === recordForm.service)?.rate || 0
  const expectedValue = Number(recordForm.cases || 0) * selectedRate

  const hospitalSummary = useMemo(() => {
    return myHospitals.map((hospital) => {
      const expected = myRecords
        .filter((record) => record.hospital === hospital.name)
        .reduce((sum, record) => sum + Number(record.expectedAmount || 0), 0)

      const received = myPayments
        .filter((payment) => payment.hospital === hospital.name)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

      return {
        ...hospital,
        expected,
        received,
        outstanding: expected - received,
      }
    })
  }, [myHospitals, myPayments, myRecords])

  const totalExpected = hospitalSummary.reduce((sum, item) => sum + item.expected, 0)
  const totalReceived = hospitalSummary.reduce((sum, item) => sum + item.received, 0)
  const totalOutstanding = totalExpected - totalReceived
  const totalDiscrepancy = myDiscrepancies
    .filter((item) => item.status !== 'Resolved')
    .reduce((sum, item) => sum + Number(item.difference || 0), 0)

  const followUpList = [
    { label: 'Pending payments', value: `${myPayments.filter((item) => item.status === 'Pending').length} items`, tone: 'warning' },
    { label: 'Partially paid', value: `${myPayments.filter((item) => item.status === 'Partially Paid').length} items`, tone: 'neutral' },
    { label: 'Open discrepancies', value: `${myDiscrepancies.filter((item) => item.status === 'Open').length} items`, tone: 'danger' },
  ]



  const handleLogin = (event) => {
    event.preventDefault()
    const username = loginForm.username.trim()
    const password = loginForm.password.trim()

    const user = users.find(u => (u.username === username || u.email === username) && u.password === password)
    
    if (user) {
      const newSession = { loggedIn: true, role: user.role, user }
      setSession(newSession)
      if (rememberMe) {
        localStorage.setItem('doctorSession', JSON.stringify(newSession))
      } else {
        localStorage.removeItem('doctorSession')
      }
      setActivePage('Dashboard')
      setLoginError('')
      return
    }

    setLoginError('Invalid username or password.')
  }

  const handleSignup = (event) => {
    event.preventDefault()
    const name = signupForm.name.trim()
    const email = signupForm.email.trim()
    const password = signupForm.password.trim()
    const confirmPassword = signupForm.confirmPassword.trim()

    if (!name) return setSignupError('Full name cannot be empty.')
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return setSignupError('Please enter a valid email address.')
    if (!password) return setSignupError('Password cannot be empty.')
    if (password.length < 6) return setSignupError('Password must be at least 6 characters long.')
    if (password !== confirmPassword) return setSignupError('Passwords do not match.')

    const existingUser = users.find(u => u.email === email || u.username === email)
    if (existingUser) {
      return setSignupError('An account with this email already exists. Please log in instead.')
    }

    const newUser = {
      username: email,
      email,
      password,
      name,
      role: 'doctor'
    }

    setUsers([...users, newUser])
    setAuthView('success')
  }

  const handleLogout = () => {
    localStorage.removeItem('doctorSession')
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
      userId: session.user.username,
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
    setViewState('success')
  }

  const handleRecordSave = (event) => {
    event.preventDefault()
    setRecords((current) => [{
      id: Date.now(),
      userId: session.user.username,
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
    setViewState('success')
  }

  const handlePaymentSave = (event) => {
    event.preventDefault()
    setPayments((current) => [{
      id: Date.now(),
      userId: session.user.username,
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

  const handleStatusChange = (record, newStatus) => {
    // Update the local record status so it appears in the UI
    setRecords((current) =>
      current.map((r) => (r.id === record.id ? { ...r, status: newStatus } : r))
    )

    // Update or create a payment to keep backend calculations intact
    setPayments((current) => {
      const existing = current.find((p) => p.recordId === record.id)
      let amount = 0
      if (newStatus === 'Paid' || newStatus === 'Resolved') amount = record.expectedAmount
      if (newStatus === 'Partially Paid') amount = record.expectedAmount / 2

      if (existing) {
        return current.map((p) =>
          p.recordId === record.id ? { ...p, status: newStatus, amount } : p
        )
      } else {
        return [
          {
            id: Date.now(),
            userId: session.user.username,
            recordId: record.id,
            hospital: record.hospital,
            date: record.date,
            amount,
            status: newStatus,
          },
          ...current,
        ]
      }
    })
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'Good morning'
    if (hour >= 12 && hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const renderDashboard = () => {
    if (myRecords.length === 0 && myHospitals.length === 0 && myPayments.length === 0) {
      return (
        <section className="space-y-6 animate-fade-in">
          <header className="flex items-end justify-between">
            <div>
              <p className="text-sm text-neutral-500">Revenue overview</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {getGreeting()}{session.user ? `, ${session.user.name.split(' ')[0]}` : ''}
              </h1>
            </div>
          </header>
          
          <div className="card bg-white p-12 text-center" style={{ marginTop: '2rem' }}>
            <FileText size={48} className="text-neutral-300" style={{ margin: '0 auto', marginBottom: '1rem' }} />
            <h2 className="text-xl font-semibold mb-2">No transactions yet</h2>
            <p className="text-neutral-500 mb-6">Start by creating your first record to track your revenue.</p>
            <button className="primary-btn inline-flex items-center gap-2" style={{ width: 'auto' }} onClick={() => { setActivePage('My Records'); setViewState('form') }}>
              <Plus size={18} /> Start New Record
            </button>
          </div>
        </section>
      )
    }

    return (
      <section className="space-y-6 animate-fade-in">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-sm text-neutral-500">Revenue overview</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {getGreeting()}{session.user ? `, ${session.user.name.split(' ')[0]}` : ''}
            </h1>
          </div>
          {session.role === 'doctor' && (
            <button className="primary-btn inline-flex items-center gap-2" onClick={() => { setActivePage('My Records'); setViewState('form') }}>
              <Plus size={18} /> Start New Record
            </button>
          )}
        </header>

        <div className="grid gap-4 lg-grid-cols-12 mt-6">
          <div className="card lg-col-7 bg-white p-6">
            <p className="text-sm text-neutral-500">Total expected revenue</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight">
              {formatMoney(totalExpected)}
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Across {myHospitals.length} active hospitals
            </p>
          </div>

          <div className="card lg-col-5 bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-neutral-500">Outstanding revenue</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-warning">
                  {formatMoney(totalOutstanding)}
                </p>
                <p className="mt-2 text-sm text-neutral-500">
                  Requires follow-up
                </p>
              </div>
              <ArrowUpRight size={20} className="text-neutral-400" />
            </div>
            <button className="mt-6 text-sm font-medium text-orange-600 hover-text-orange-700 inline-flex items-center" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => setActivePage('My Payments')}>
              View payments &rarr;
            </button>
          </div>

          <div className="card lg-col-8 bg-white p-6">
            <h3 className="text-sm font-medium mb-4">Recent Services</h3>
            <div className="table-wrap">
              <table className="clean-table">
                <thead>
                  <tr><th>Hospital</th><th>Date</th><th>Service</th><th>Expected</th></tr>
                </thead>
                <tbody>
                  {myRecords.slice(0, 4).map((record) => (
                    <tr key={record.id}>
                      <td>{record.hospital}</td>
                      <td>{record.date}</td>
                      <td>{record.service}</td>
                      <td>{formatMoney(record.expectedAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card lg-col-4 bg-white p-6">
            <h3 className="text-sm font-medium mb-4">At a Glance</h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b pb-3">
                <span className="text-sm text-neutral-500">Total Received</span>
                <strong className="text-success">{formatMoney(totalReceived)}</strong>
              </div>
              <div className="flex justify-between items-center border-b pb-3">
                <span className="text-sm text-neutral-500">Deductions</span>
                <strong className="text-danger">{formatMoney(totalDiscrepancy)}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-500">Active Cases</span>
                <strong>{myRecords.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const renderHospitals = () => {
    if (viewState === 'form') {
      return (
        <>
          <div className="page-header"><div><p className="eyebrow">Hospitals</p><h1>Add Hospital</h1></div></div>
          <div className="panel form-panel">
            <form className="grid-form" onSubmit={handleHospitalSave}>
              <label className="field"><span className="field-label">Hospital Name</span><input type="text" value={hospitalForm.name} onChange={(event) => setHospitalForm({ ...hospitalForm, name: event.target.value })} placeholder="Hospital name" /></label>
              <label className="field"><span className="field-label">Location</span><input type="text" value={hospitalForm.location} onChange={(event) => setHospitalForm({ ...hospitalForm, location: event.target.value })} placeholder="Bangalore" /></label>
              <label className="field"><span className="field-label">Service Name</span><input type="text" value={hospitalForm.serviceName} onChange={(event) => setHospitalForm({ ...hospitalForm, serviceName: event.target.value })} placeholder="Consultation" /></label>
              <label className="field"><span className="field-label">Service Rate (₹)</span><input type="number" min="0" value={hospitalForm.serviceRate} onChange={(event) => setHospitalForm({ ...hospitalForm, serviceRate: event.target.value })} placeholder="1000" /></label>
              <div className="field"><span className="field-label">&nbsp;</span><button type="button" className="secondary-btn" onClick={addService}>Add service</button></div>
              
              <div className="field full-span form-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="secondary-btn" onClick={() => setViewState('list')}>← Back</button>
                <button type="submit" className="primary-btn">Save Hospital & Continue →</button>
              </div>
            </form>
            <div className="service-list">{hospitalForm.services.map((service) => <span key={`${service.name}-${service.rate}`} className="service-pill">{service.name} · {formatMoney(service.rate)}</span>)}</div>
          </div>
        </>
      )
    }

    if (viewState === 'success') {
      return (
        <div className="panel success-panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h3 style={{ color: 'var(--success)', fontSize: '1.5rem', marginBottom: '24px' }}>✅ Hospital Added Successfully</h3>
          <div className="form-actions" style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
             <button type="button" className="secondary-btn" onClick={() => setViewState('list')}>View Hospitals</button>
             <button type="button" className="secondary-btn" onClick={() => setViewState('form')}>+ Add Another</button>
             <button type="button" className="primary-btn" onClick={() => { setActivePage('My Records'); setViewState('form') }}>Next: Add Visit Record →</button>
          </div>
        </div>
      )
    }

    return (
      <>
        <div className="page-header">
          <div><p className="eyebrow">Hospitals</p><h1>My Hospitals</h1></div>
          {session.role === 'doctor' && <button className="primary-btn" onClick={() => setViewState('form')}>+ Add Hospital</button>}
        </div>
        <div className="panel">
          <div className="table-wrap"><table><thead><tr><th>Hospital</th><th>Location</th><th>Services</th><th>Action</th></tr></thead><tbody>{myHospitals.map((hospital) => <tr key={hospital.id}><td>{hospital.name}</td><td>{hospital.location}</td><td><div className="service-list compact-list">{hospital.services.map((service) => <span key={`${hospital.id}-${service.name}`} className="service-pill compact-pill">{service.name}: {formatMoney(service.rate)}</span>)}</div></td><td><button type="button" className="danger-text-btn" onClick={() => setConfirmDelete({ type: 'hospital', id: hospital.id, title: 'Delete this hospital?', message: 'Deleting the hospital may also affect its associated records.' })}>Delete</button></td></tr>)}</tbody></table></div>
        </div>
      </>
    )
  }

  const renderRecords = () => {
    if (viewState === 'form') {
      return (
        <>
          <div className="page-header"><div><p className="eyebrow">Records</p><h1>Add Visit Record</h1></div></div>
          <div className="panel form-panel">
            <form className="grid-form" onSubmit={handleRecordSave}>
              <label className="field"><span className="field-label">Hospital</span><select value={recordForm.hospital} onChange={(event) => { const nextHospital = hospitals.find((hospital) => hospital.name === event.target.value); setRecordForm({ ...recordForm, hospital: event.target.value, service: nextHospital?.services[0]?.name || 'Consultation' }) }}>
                {hospitals.map((hospital) => <option key={hospital.id} value={hospital.name}>{hospital.name}</option>)}
              </select></label>
              <label className="field"><span className="field-label">Date</span><input type="date" value={recordForm.date} onChange={(event) => setRecordForm({ ...recordForm, date: event.target.value })} /></label>
              <label className="field"><span className="field-label">Service</span><select value={recordForm.service} onChange={(event) => setRecordForm({ ...recordForm, service: event.target.value })}>{(selectedHospital?.services || []).map((service) => <option key={service.name} value={service.name}>{service.name}</option>)}</select></label>
              <label className="field"><span className="field-label">Number of Cases</span><input type="number" min="0" value={recordForm.cases} onChange={(event) => setRecordForm({ ...recordForm, cases: event.target.value })} /></label>
              <label className="field"><span className="field-label">Rate per Case</span><input type="text" value={formatMoney(selectedRate)} readOnly /></label>
              <label className="field"><span className="field-label">Expected Amount</span><input type="text" value={formatMoney(expectedValue)} readOnly /></label>
              <div className="field full-span form-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="secondary-btn" onClick={() => setViewState('list')}>← Back</button>
                <button type="submit" className="primary-btn">Save Record & Continue →</button>
              </div>
            </form>
          </div>
        </>
      )
    }

    if (viewState === 'success') {
      return (
        <div className="panel success-panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h3 style={{ color: 'var(--success)', fontSize: '1.5rem', margin: '0 0 24px' }}>✅ Visit Record Logged Successfully</h3>
          <div className="form-actions" style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
             <button type="button" className="secondary-btn" onClick={() => setViewState('list')}>View Records</button>
             <button type="button" className="secondary-btn" onClick={() => setViewState('form')}>+ Log Another</button>
             <button type="button" className="primary-btn" onClick={() => { setActivePage('My Payments'); setViewState('list') }}>Next: Track Payments →</button>
          </div>
        </div>
      )
    }

    return (
      <>
        <div className="page-header">
          <div><p className="eyebrow">Records</p><h1>My Records</h1></div>
          {session.role === 'doctor' && <button className="primary-btn" onClick={() => setViewState('form')}>+ Start New Record</button>}
        </div>
        <div className="panel"><div className="table-wrap"><table><thead><tr><th>Hospital</th><th>Date</th><th>Service</th><th>Cases</th><th>Expected</th><th>Action</th></tr></thead><tbody>{myRecords.map((record) => <tr key={record.id}><td>{record.hospital}</td><td>{record.date}</td><td>{record.service}</td><td>{record.cases}</td><td>{formatMoney(record.expectedAmount)}</td><td><button type="button" className="danger-text-btn" onClick={() => setConfirmDelete({ type: 'record', id: record.id, title: 'Delete this record?', message: 'This action cannot be undone.' })}>Delete</button></td></tr>)}</tbody></table></div></div>
      </>
    )
  }

  const renderPayments = () => {
    const totalReceived = myPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalRevenue = myRecords.reduce((sum, r) => sum + Number(r.expectedAmount), 0)
    const totalPending = totalRevenue - totalReceived
    const numPaid = myPayments.filter(p => p.status === 'Paid' || p.status === 'Resolved').length
    const numPending = myRecords.length - numPaid // Approximation
    
    return (
    <section className="animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payment Overview</h1>
          <p className="text-sm text-neutral-500 mt-1">Track received and outstanding payments</p>
        </div>
        <button className="primary-btn" onClick={() => { setActivePage('My Records'); setViewState('form') }}>
          + Start New Record
        </button>
      </div>

      <div className="metrics-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="metric-item">
          <span className="metric-label">Total Received</span>
          <span className="metric-value success">{formatMoney(totalReceived)}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Total Pending</span>
          <span className="metric-value warning">{formatMoney(totalPending)}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Total Revenue</span>
          <span className="metric-value">{formatMoney(totalRevenue)}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Paid Trans.</span>
          <span className="metric-value">{numPaid}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Pending Trans.</span>
          <span className="metric-value">{numPending}</span>
        </div>
      </div>
      
      <div className="card bg-white">
        <div className="p-4 border-b">
          <h3 className="text-sm font-medium">Transaction Table</h3>
        </div>
        <div className="table-wrap">
          <table className="clean-table">
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Visit Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment Date</th>
                <th>Transaction Ref</th>
              </tr>
            </thead>
            <tbody>
              {myRecords.map((record) => {
                const currentStatus = record.status || 'Active'
                const relatedPayment = myPayments.find(p => p.recordId === record.id)
                return (
                  <tr key={record.id}>
                    <td>{record.hospital}</td>
                    <td>{record.date}</td>
                    <td>{formatMoney(record.expectedAmount)}</td>
                    <td>
                      <select 
                        className="status-dropdown"
                        value={currentStatus} 
                        onChange={(event) => handleStatusChange(record, event.target.value)}
                      >
                        <option value="Active">Active</option>
                        <option value="Payment Pending">Payment Pending</option>
                        <option value="Partially Paid">Partially Paid</option>
                        <option value="Paid">Paid</option>
                        <option value="Under Review">Under Review</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </td>
                    <td>{relatedPayment ? relatedPayment.date : '-'}</td>
                    <td>{relatedPayment ? `TRX-${relatedPayment.id.toString().slice(-6)}` : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )}

  const renderDiscrepancies = () => (
    <>
      <div className="page-header"><div><p className="eyebrow">Follow-up</p><h1>Discrepancies</h1></div></div>
      <div className="panel"><div className="table-wrap"><table><thead><tr><th>Hospital</th><th>Expected</th><th>Received</th><th>Difference</th><th>Status</th><th>Action</th></tr></thead><tbody>{myDiscrepancies.map((item) => <tr key={item.id}><td>{item.hospital}</td><td>{formatMoney(item.expectedAmount)}</td><td>{formatMoney(item.receivedAmount)}</td><td>{formatMoney(item.difference)}</td><td><span className={`status-badge ${item.status.toLowerCase()}`}>{item.status}</span></td><td><select value={item.status} onChange={(event) => updateDiscrepancyStatus(item.id, event.target.value)}><option value="Open">Open</option><option value="Resolved">Resolved</option></select></td></tr>)}</tbody></table></div></div>
      
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button type="button" className="secondary-btn" onClick={() => setActivePage('My Payments')}>← Back to Payments</button>
        <button type="button" className="primary-btn" onClick={() => setActivePage('Dashboard')}>Done / Back to Dashboard</button>
      </div>
    </>
  )
  const renderReports = () => {
    const hospitalMap = {}
    myRecords.forEach(r => {
      if(!hospitalMap[r.hospital]) hospitalMap[r.hospital] = { revenue: 0, visits: 0, cases: 0 }
      hospitalMap[r.hospital].revenue += Number(r.expectedAmount)
      hospitalMap[r.hospital].visits += 1
      hospitalMap[r.hospital].cases += Number(r.cases || 1)
    })
    
    return (
      <section className="animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
            <p className="text-sm text-neutral-500 mt-1">Summary of your revenue and visits</p>
          </div>
        </div>
        
        <div className="card bg-white" style={{ marginBottom: '24px' }}>
          <div className="p-4 border-b"><h3 className="text-sm font-medium">Hospital-wise Summary</h3></div>
          <div className="table-wrap">
            <table className="clean-table">
              <thead><tr><th>Hospital</th><th>Revenue</th><th>Visits</th><th>Cases</th></tr></thead>
              <tbody>
                {Object.keys(hospitalMap).map(h => (
                  <tr key={h}><td>{h}</td><td>{formatMoney(hospitalMap[h].revenue)}</td><td>{hospitalMap[h].visits}</td><td>{hospitalMap[h].cases}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    )
  }

  const renderSettings = () => {
    return (
      <section className="animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-neutral-500 mt-1">Manage your account preferences</p>
          </div>
        </div>
        
        <div className="card bg-white p-6 max-w-2xl">
          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-neutral-200">
            <div className="avatar"><User size={32} /></div>
            <div>
              <h3 className="text-lg font-medium">{session.user?.username}</h3>
              <p className="text-neutral-500">Role: {session.role}</p>
            </div>
          </div>
          
          <h3 className="text-md font-medium mb-4">Account Actions</h3>
          <div className="flex flex-col gap-4">
            <button className="secondary-btn w-fit">Change Password</button>
            <button className="danger-btn w-fit" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </section>
    )
  }


  const renderPage = () => {
    if (activePage === 'Dashboard') return renderDashboard()
    if (activePage === 'My Hospitals') return renderHospitals()
    if (activePage === 'My Records') return renderRecords()
    if (activePage === 'My Payments') return renderPayments()
    if (activePage === 'Discrepancies') return renderDiscrepancies()
    if (activePage === 'Reports') return renderReports()
    if (activePage === 'Settings') return renderSettings()
    return renderDashboard()
  }

  if (!session.loggedIn) {
    return (
      <div className="login-shell">
        <div className="auth-panel single-col">
          <div className="login-card">
            {authView === 'login' && (
              <>
                <div className="login-header">
                  <img src="doctrack-logo.png" alt="DocTrack" className="login-logo" style={{ objectFit: 'contain' }} />
                  <p className="eyebrow neutral" style={{ marginTop: '12px' }}>Secure access</p>
                  <h1>DocTrack</h1>
                  <p className="text-sm text-neutral-400 mt-2">Track Visits. Manage Revenue.</p>
                </div>
                <form className="login-form" onSubmit={handleLogin}>
                  <label className="field"><span className="field-label">Username</span><input type="text" value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} placeholder="Enter username" /></label>
                  <label className="field">
                    <span className="field-label">Password</span>
                    <div className="relative" style={{ position: 'relative' }}>
                      <input type={showLoginPassword ? "text" : "password"} value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="Enter password" style={{ width: '100%', paddingRight: '40px' }} />
                      <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} className="text-neutral-400">
                        {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>
                  <label className="field flex items-center" style={{ flexDirection: 'row', marginTop: '4px', gap: '8px' }}>
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: 'auto' }} />
                    <span className="text-sm text-neutral-500">Remember me</span>
                  </label>
                  {loginError && <div className="login-error">{loginError}</div>}
                  <button type="submit" className="primary-btn full-width-btn mt-2">Login</button>
                </form>
                <div className="mt-6 text-center">
                  <button className="text-orange-600 font-medium hover-text-orange-700 bg-transparent border-0 p-0" style={{cursor:'pointer'}} onClick={() => { setAuthView('signup'); setSignupError(''); setLoginError(''); }}>
                    Don't have an account? Create an account
                  </button>
                </div>
              </>
            )}

            {authView === 'signup' && (
              <>
                <div className="login-header">
                  <img src="doctrack-logo.png" alt="DocTrack" className="login-logo" style={{ objectFit: 'contain' }} />
                  <p className="eyebrow neutral">Get Started</p>
                  <h1>Create your account</h1>
                  <p className="text-sm text-neutral-400 mt-2">Set up your account to manage your hospitals, services and payments.</p>
                </div>
                <form className="login-form" onSubmit={handleSignup}>
                  <label className="field"><span className="field-label">Username</span><input type="text" value={signupForm.username} onChange={(event) => setSignupForm({ ...signupForm, username: event.target.value })} placeholder="Choose a username" /></label>
                  <label className="field">
                    <span className="field-label">Password</span>
                    <div className="relative" style={{ position: 'relative' }}>
                      <input type={showSignupPassword ? "text" : "password"} value={signupForm.password} onChange={(event) => setSignupForm({ ...signupForm, password: event.target.value })} placeholder="Create a strong password" style={{ width: '100%', paddingRight: '40px' }} />
                      <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} className="text-neutral-400">
                        {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>
                  <label className="field">
                    <span className="field-label">Confirm Password</span>
                    <div className="relative" style={{ position: 'relative' }}>
                      <input type={showSignupConfirmPassword ? "text" : "password"} value={signupForm.confirmPassword} onChange={(event) => setSignupForm({ ...signupForm, confirmPassword: event.target.value })} placeholder="Confirm password" style={{ width: '100%', paddingRight: '40px' }} />
                      <button type="button" onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} className="text-neutral-400">
                        {showSignupConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>
                  {signupError && <div className="login-error">{signupError}</div>}
                  <button type="submit" className="primary-btn full-width-btn mt-2">Create Account</button>
                </form>
                <div className="mt-6 text-center">
                  <button className="text-orange-600 font-medium hover-text-orange-700 bg-transparent border-0 p-0" style={{cursor:'pointer'}} onClick={() => { setAuthView('login'); setSignupError(''); setLoginError(''); }}>
                    Already have an account? Log in
                  </button>
                </div>
              </>
            )}

            {authView === 'success' && (
              <div className="text-center p-6">
                <h3 className="text-2xl font-semibold text-success mb-2">✅ Account created successfully</h3>
                <p className="text-neutral-400 mb-6">You can now log in using your new credentials.</p>
                <button className="primary-btn full-width-btn" onClick={() => { setAuthView('login'); setSignupForm({ username: '', password: '', confirmPassword: '' }); }}>
                  Go to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <button type="button" className="mobile-toggle flex items-center justify-center" aria-label="Toggle menu" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ position: 'fixed', left: '16px', top: '16px', zIndex: 50, background: 'white', borderRadius: '8px', padding: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <Menu size={24} className="text-neutral-900" />
        </button>
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} style={{ width: sidebarCollapsed ? '0px' : '250px', overflow: 'hidden', transition: 'width 0.3s ease', background: '#1e293b', color: '#f8fafc', padding: sidebarCollapsed ? '0' : '20px 16px', height: '100vh', position: 'sticky', top: 0 }}>
          <div className="brand-block" style={{ opacity: sidebarCollapsed ? 0 : 1, transition: 'opacity 0.2s', marginTop: '40px' }}>
            <div className="brand-inner">
              <img src="doctrack-logo.png" alt="" className="sidebar-logo" style={{ objectFit: 'contain' }} />
              <div className="brand-text">
                <span className="brand-name">DocTrack</span>
                <span className="brand-tagline">Manage Revenue</span>
              </div>
            </div>
          </div>
          <nav className="sidebar-nav" aria-label="Sidebar navigation" style={{ opacity: sidebarCollapsed ? 0 : 1, transition: 'opacity 0.2s' }}>
            <button type="button" className={activePage === 'Dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => { setActivePage('Dashboard'); setViewState('list'); }}><span className="nav-icon"><LayoutDashboard size={20} /></span>Dashboard</button>
            <button type="button" className={activePage === 'My Hospitals' ? 'nav-item active' : 'nav-item'} onClick={() => { setActivePage('My Hospitals'); setViewState('list'); }}><span className="nav-icon"><Building2 size={20} /></span>Hospitals</button>
            <button type="button" className={activePage === 'My Records' ? 'nav-item active' : 'nav-item'} onClick={() => { setActivePage('My Records'); setViewState('list'); }}><span className="nav-icon"><FileText size={20} /></span>Visits</button>
            <button type="button" className={activePage === 'My Payments' ? 'nav-item active' : 'nav-item'} onClick={() => { setActivePage('My Payments'); setViewState('list'); }}><span className="nav-icon"><IndianRupee size={20} /></span>Payments</button>
            <button type="button" className={activePage === 'Discrepancies' ? 'nav-item active' : 'nav-item'} onClick={() => { setActivePage('Discrepancies'); setViewState('list'); }}><span className="nav-icon"><AlertTriangle size={20} /></span>Discrepancies</button>
            <button type="button" className={activePage === 'Reports' ? 'nav-item active' : 'nav-item'} onClick={() => { setActivePage('Reports'); }}><span className="nav-icon"><BarChart3 size={20} /></span>Reports</button>
            <button type="button" className={activePage === 'Settings' ? 'nav-item active' : 'nav-item'} onClick={() => { setActivePage('Settings'); }}><span className="nav-icon"><Settings size={20} /></span>Settings</button>
            <button type="button" className="nav-item logout-item" onClick={handleLogout}><span className="nav-icon"><LogOut size={20} /></span>Logout</button>
          </nav>
        </aside>
        <main className="content-area" style={{ flex: 1, padding: '28px 28px 46px', maxWidth: sidebarCollapsed ? '100vw' : 'calc(100vw - 250px)', transition: 'max-width 0.3s ease', paddingTop: '70px' }}>{renderPage()}</main>
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
