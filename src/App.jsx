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

function AbstractRevenueVisual() {
  return (
    <div className="abstract-visual" aria-hidden="true">
      <div className="visual-glow glow-one" />
      <div className="visual-glow glow-two" />
      <div className="visual-glow glow-three" />

      <svg className="visual-svg" viewBox="0 0 760 820" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="panelGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff9c4b" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#ff6b00" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f8c39d" stopOpacity="0.2" />
            <stop offset="40%" stopColor="#ff8a3d" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffd5b5" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff7f0" />
            <stop offset="100%" stopColor="#ffb06a" />
          </linearGradient>
          <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g opacity="0.95">
          <path d="M85 640L220 430L310 515L310 640Z" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
          <path d="M280 640L420 420L560 515L560 640Z" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.11)" strokeWidth="1.1" />
          <path d="M500 640L640 470L705 520L705 640Z" fill="rgba(255,255,255,0.018)" stroke="rgba(255,255,255,0.1)" strokeWidth="1.1" />
        </g>

        <g opacity="0.9">
          <path d="M230 205L260 180L286 205V270H230V205Z" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
          <path d="M435 170L466 145L500 170V250H435V170Z" fill="none" stroke="rgba(255,255,255,0.17)" strokeWidth="1.5" />
          <path d="M590 218L620 198L647 218V300H590V218Z" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        </g>

        <g filter="url(#softGlow)">
          <path d="M360 223C368 198 382 180 404 159C420 145 438 138 457 138C490 138 517 165 519 200C521 232 494 252 462 255L441 255C413 255 388 245 370 223Z" fill="rgba(255, 120, 30, 0.12)" opacity="0.8" />
          <circle cx="449" cy="132" r="29" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
          <path d="M423 158C435 166 449 170 464 170C480 170 491 165 500 156" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M385 271C407 250 429 236 449 236C487 236 523 261 541 301L572 378C582 402 578 433 558 448L543 459C528 470 505 465 493 451L454 410L410 452C396 466 370 467 353 452L338 439C320 424 316 398 327 378L385 271Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
          <path d="M421 286C435 279 447 279 460 286" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M428 302H495" stroke="rgba(255,255,255,0.34)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M411 328H516" stroke="rgba(255,255,255,0.25)" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        <g fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M128 232C189 202 214 197 252 201" opacity="0.8" />
          <path d="M180 315C250 292 287 294 341 322" opacity="0.8" />
          <path d="M452 304C512 298 563 312 609 334" opacity="0.8" />
          <path d="M555 455C592 473 624 492 661 498" opacity="0.85" />
          <path d="M255 473C305 448 337 442 372 450" opacity="0.7" />
        </g>

        <g>
          <circle cx="128" cy="232" r="7" fill="url(#nodeGradient)" filter="url(#softGlow)" />
          <circle cx="252" cy="201" r="7" fill="url(#nodeGradient)" filter="url(#softGlow)" />
          <circle cx="180" cy="315" r="6" fill="url(#nodeGradient)" filter="url(#softGlow)" />
          <circle cx="341" cy="322" r="6" fill="url(#nodeGradient)" filter="url(#softGlow)" />
          <circle cx="452" cy="304" r="7" fill="url(#nodeGradient)" filter="url(#softGlow)" />
          <circle cx="609" cy="334" r="6.5" fill="url(#nodeGradient)" filter="url(#softGlow)" />
          <circle cx="555" cy="455" r="7" fill="url(#nodeGradient)" filter="url(#softGlow)" />
          <circle cx="661" cy="498" r="7" fill="url(#nodeGradient)" filter="url(#softGlow)" />
          <circle cx="255" cy="473" r="6.5" fill="url(#nodeGradient)" filter="url(#softGlow)" />
          <circle cx="372" cy="450" r="6.5" fill="url(#nodeGradient)" filter="url(#softGlow)" />
        </g>

        <g opacity="0.9" fontSize="26" fontWeight="700" fill="rgba(255,255,255,0.8)" fontFamily="Inter, sans-serif">
          <text x="89" y="462" transform="rotate(-12 89 462)">₹</text>
          <text x="596" y="585" transform="rotate(18 596 585)">₹</text>
          <text x="319" y="620" transform="rotate(-8 319 620)">₹</text>
        </g>

        <g stroke="rgba(255,255,255,0.26)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
          <path d="M615 586L627 598L646 576" />
          <path d="M300 548L315 562L338 538" />
          <path d="M171 584L183 596L202 576" />
        </g>

        <g opacity="0.8">
          <path d="M172 584H202" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M300 548H339" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M615 586H646" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4" strokeLinecap="round" />
        </g>

        <g opacity="0.68" fill="none" stroke="rgba(255,255,255,0.11)" strokeWidth="1.2">
          <path d="M110 655C205 629 243 625 317 660" />
          <path d="M404 685C493 650 563 651 659 682" />
          <path d="M250 700C300 685 348 683 399 701" />
        </g>

        <g opacity="0.42">
          <rect x="280" y="175" width="86" height="220" rx="18" fill="url(#panelGlow)" />
          <rect x="390" y="170" width="130" height="246" rx="20" fill="url(#panelGlow)" />
        </g>
      </svg>
    </div>
  )
}

function App() {
  const [users, setUsers] = useState([
    { username: 'admin2026', email: 'admin@example.com', password: 'admin@123', name: 'Admin User', role: 'admin' },
    { username: 'doctor2026', email: 'doc@example.com', password: 'doc@123', name: 'Dr. Aisha Nair', role: 'doctor' }
  ])
  const [session, setSession] = useState({ loggedIn: false, role: 'doctor', user: null })
  const [activePage, setActivePage] = useState('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const [authView, setAuthView] = useState('login') // 'login', 'signup', 'success'
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [signupError, setSignupError] = useState('')

  const [hospitals, setHospitals] = useState(hospitalsSeed.map(h => ({ ...h, userId: 'doctor2026' })))
  const [records, setRecords] = useState(recordsSeed.map(r => ({ ...r, userId: 'doctor2026' })))
  const [payments, setPayments] = useState(paymentsSeed.map(p => ({ ...p, userId: 'doctor2026' })))
  const [discrepancies, setDiscrepancies] = useState(discrepanciesSeed)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [viewState, setViewState] = useState('list')

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

    const user = users.find(u => (u.username === username || u.email === username) && u.password === password)
    
    if (user) {
      setSession({ loggedIn: true, role: user.role, user })
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
    setSession({ loggedIn: false, role: 'doctor', user: null })
    setActivePage('Dashboard')
    setSidebarOpen(false)
    setLoginForm({ username: '', password: '' })
    setLoginError('')
  }

  const myHospitals = session.role === 'admin' ? hospitals : hospitals.filter(h => h.userId === session.user?.username)
  const myRecords = session.role === 'admin' ? records : records.filter(r => r.userId === session.user?.username)
  const myPayments = session.role === 'admin' ? payments : payments.filter(p => p.userId === session.user?.username)
  const myDiscrepancies = session.role === 'admin' ? discrepancies : discrepancies.filter(d => {
    const parentPayment = myPayments.find(p => p.hospital === d.hospital)
    return parentPayment ? true : false // approximation for now
  })

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

  const renderDashboard = () => (
    <section className="space-y-6 animate-fade-in">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-neutral-500">Revenue overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Good morning{session.user ? `, ${session.user.name.split(' ')[0]}` : ''}
          </h1>
        </div>
        {session.role === 'doctor' && (
          <button className="primary-btn" onClick={() => { setActivePage('My Records'); setViewState('form') }}>
            + Start New Record
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
            Across {hospitals.length} active hospitals
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
            <span className="text-neutral-400">↗</span>
          </div>
          <button className="mt-6 text-sm font-medium text-orange-600 hover-text-orange-700" onClick={() => setActivePage('My Payments')}>
            View payments →
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
                {records.slice(0, 4).map((record) => (
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
              <strong>{records.length}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  )

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

  const renderPayments = () => (
    <section className="animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Payments</h1>
          <p className="text-sm text-neutral-500 mt-1">Track received and outstanding payments</p>
        </div>
        {session.role === 'doctor' && (
          <button className="primary-btn" onClick={() => { setActivePage('My Records'); setViewState('form') }}>
            + Start New Record
          </button>
        )}
      </div>
      
      <div className="card bg-white">
        <div className="p-4 border-b">
          <h3 className="text-sm font-medium">Active Cases</h3>
        </div>
        <div className="table-wrap">
          <table className="clean-table">
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Date</th>
                <th>Service</th>
                <th>Expected Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {myRecords.map((record) => {
                const currentStatus = record.status || 'Active'
                return (
                  <tr key={record.id}>
                    <td>{record.hospital}</td>
                    <td>{record.date}</td>
                    <td>{record.service}</td>
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card bg-white" style={{ marginTop: '24px' }}>
        <div className="p-4 border-b">
          <h3 className="text-sm font-medium">Ledger (Auto-Synced)</h3>
        </div>
        <div className="table-wrap">
          <table className="clean-table">
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {myPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.hospital}</td>
                  <td>{payment.date}</td>
                  <td>{formatMoney(payment.amount)}</td>
                  <td><span className={`status-badge ${payment.status.toLowerCase().replace(/\s+/g, '-')}`}>{payment.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button type="button" className="secondary-btn" onClick={() => setActivePage('Dashboard')}>← Back to Dashboard</button>
        <button type="button" className="primary-btn" onClick={() => setActivePage('Discrepancies')}>Next: Reconciliation →</button>
      </div>
    </section>
  )

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
        <div className="auth-panel">
          <div className="login-visual">
            <AbstractRevenueVisual />
          </div>
          <div className="login-card">
            {authView === 'login' && (
              <>
                <div className="login-header">
                  <p className="eyebrow neutral">Secure access</p>
                  <h1>Doctor Revenue Tracking</h1>
                </div>
                <form className="login-form" onSubmit={handleLogin}>
                  <label className="field"><span className="field-label">Username or Email</span><input type="text" value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} placeholder="Enter email" /></label>
                  <label className="field"><span className="field-label">Password</span><input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="Enter password" /></label>
                  {loginError && <div className="login-error">{loginError}</div>}
                  <button type="submit" className="primary-btn full-width-btn">Login</button>
                </form>
                <div className="mt-6 text-center">
                  <button className="text-orange-600 font-medium hover-text-orange-700 bg-transparent border-0 p-0" style={{cursor:'pointer'}} onClick={() => { setAuthView('signup'); setSignupError(''); setLoginError(''); }}>
                    Don't have an account? Create an account
                  </button>
                </div>
                <div className="login-note"><strong>Demo accounts</strong><p>Doctor: doctor2026 / doc@123</p><p>Admin: admin2026 / admin@123</p></div>
              </>
            )}

            {authView === 'signup' && (
              <>
                <div className="login-header">
                  <p className="eyebrow neutral">Get Started</p>
                  <h1>Create your account</h1>
                  <p className="text-sm text-neutral-400 mt-2">Set up your account to manage your hospitals, services and payments.</p>
                </div>
                <form className="login-form" onSubmit={handleSignup}>
                  <label className="field"><span className="field-label">Full Name</span><input type="text" value={signupForm.name} onChange={(event) => setSignupForm({ ...signupForm, name: event.target.value })} placeholder="John Doe" /></label>
                  <label className="field"><span className="field-label">Email Address</span><input type="email" value={signupForm.email} onChange={(event) => setSignupForm({ ...signupForm, email: event.target.value })} placeholder="doctor@example.com" /></label>
                  <label className="field"><span className="field-label">Password</span><input type="password" value={signupForm.password} onChange={(event) => setSignupForm({ ...signupForm, password: event.target.value })} placeholder="Create a strong password" /></label>
                  <label className="field"><span className="field-label">Confirm Password</span><input type="password" value={signupForm.confirmPassword} onChange={(event) => setSignupForm({ ...signupForm, confirmPassword: event.target.value })} placeholder="Confirm password" /></label>
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
                <button className="primary-btn full-width-btn" onClick={() => { setAuthView('login'); setSignupForm({ name: '', email: '', password: '', confirmPassword: '' }); }}>
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
      <div className="app-shell">
        <button type="button" className="mobile-toggle" aria-label="Toggle menu" onClick={() => setSidebarOpen((value) => !value)}>☰</button>
        <aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}>
          <div className="brand-block"><div className="brand-mark">VD</div><div><p className="eyebrow neutral">{session.role === 'admin' ? 'Admin' : 'Doctor'}</p><h2>Revenue Ledger</h2></div></div>
          <nav className="sidebar-nav" aria-label="Sidebar navigation">
            {navItems.map((item) => (
              <button key={item} type="button" className={activePage === item ? 'nav-item active' : 'nav-item'} onClick={() => { setActivePage(item); setViewState('list'); setSidebarOpen(false) }}>
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
