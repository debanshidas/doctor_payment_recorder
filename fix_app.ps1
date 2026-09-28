$AppContent = @'
import { useMemo, useState } from 'react'
import './App.css'

const roleConfig = {
  doctor: {
    label: 'Doctor',
    navItems: ['Dashboard', 'My Hospitals', 'My Records', 'My Payments', 'Discrepancies', 'My Account', 'Logout'],
  },
  admin: {
    label: 'Admin',
    navItems: ['Dashboard', 'Doctors', 'Hospitals', 'Records', 'Payments', 'Discrepancies', 'My Account', 'Logout'],
  },
}

const formatMoney = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const FormField = ({ label, helper, children }) => (
  <label className="field">
    <span className="field-label">{label}</span>
    {children}
    <small className="field-hint">{helper}</small>
  </label>
)

function App() {
  const [session, setSession] = useState({ loggedIn: false, role: 'doctor', user: null })
  const [activePage, setActivePage] = useState('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')

  const [hospitals, setHospitals] = useState([
    {
      id: 1,
      name: 'Kauvery Hospital',
      location: 'Bangalore',
      paymentTerms: 'Net 15',
      services: [
        { name: 'Consultation', rate: 1000 },
        { name: 'Procedure A', rate: 5000 },
        { name: 'Surgery', rate: 15000 },
      ],
    },
    {
      id: 2,
      name: 'Apollo Hospital',
      location: 'Bangalore',
      paymentTerms: 'Net 30',
      services: [
        { name: 'Consultation', rate: 1200 },
        { name: 'Follow-up', rate: 700 },
      ],
    },
  ])

  const [records, setRecords] = useState([
    { id: 1, hospital: 'Kauvery Hospital', date: '2026-09-02', purpose: 'Consultation', service: 'Consultation', cases: 5, expectedAmount: 5000 },
    { id: 2, hospital: 'Apollo Hospital', date: '2026-09-05', purpose: 'Procedure', service: 'Procedure A', cases: 3, expectedAmount: 15000 },
    { id: 3, hospital: 'Kauvery Hospital', date: '2026-09-08', purpose: 'Surgery', service: 'Surgery', cases: 2, expectedAmount: 30000 },
  ])

  const [payments, setPayments] = useState([
    { id: 1, hospital: 'Kauvery Hospital', date: '2026-09-12', amount: 18000, status: 'Paid' },
    { id: 2, hospital: 'Apollo Hospital', date: '2026-09-18', amount: 12000, status: 'Pending' },
    { id: 3, hospital: 'Kauvery Hospital', date: '2026-09-20', amount: 9000, status: 'Partially Paid' },
  ])

  const [discrepancies, setDiscrepancies] = useState([
    { id: 1, hospital: 'Kauvery Hospital', date: '2026-09-09', expectedAmount: 20000, receivedAmount: 12000, difference: 8000, status: 'Open' },
    { id: 2, hospital: 'Apollo Hospital', date: '2026-09-15', expectedAmount: 18000, receivedAmount: 18000, difference: 0, status: 'Resolved' },
  ])

  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    paymentTerms: 'Net 15',
    serviceName: 'Consultation',
    serviceRate: '1000',
    services: [{ name: 'Consultation', rate: 1000 }],
  })

  const [recordForm, setRecordForm] = useState({
    hospital: 'Kauvery Hospital',
    date: '2026-09-10',
    purpose: 'Consultation',
    service: 'Consultation',
    cases: '5',
  })

  const [paymentForm, setPaymentForm] = useState({
    hospital: 'Kauvery Hospital',
    date: '2026-09-18',
    amount: '15000',
    status: 'Paid',
  })

  const userRole = session.role
  const navItems = roleConfig[userRole].navItems

  const currentHospitalServices = useMemo(() => {
    const hospital = hospitals.find((item) => item.name === recordForm.hospital)
    return hospital ? hospital.services : []
  }, [hospitals, recordForm.hospital])

  const selectedServiceRate = useMemo(() => {
    const service = currentHospitalServices.find((item) => item.name === recordForm.service)
    return Number(service?.rate || 0)
  }, [currentHospitalServices, recordForm.service])

  const calculatedExpectedAmount = Number(recordForm.cases || 0) * selectedServiceRate

  const hospitalSummary = useMemo(
    () =>
      hospitals.map((hospital) => {
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
      }),
    [hospitals, payments, records]
  )

  const totalExpected = hospitalSummary.reduce((sum, hospital) => sum + hospital.expected, 0)
  const totalReceived = hospitalSummary.reduce((sum, hospital) => sum + hospital.received, 0)
  const totalOutstanding = totalExpected - totalReceived
  const discrepancyAmount = discrepancies
    .filter((item) => item.status !== 'Resolved')
    .reduce((sum, item) => sum + Number(item.difference || 0), 0)

  const needsAttention = [
    { label: 'Pending payment', value: `${payments.filter((payment) => payment.status === 'Pending').length} items`, tone: 'warning' },
    { label: 'Partially paid', value: `${payments.filter((payment) => payment.status === 'Partially Paid').length} items`, tone: 'neutral' },
    { label: 'Open discrepancy', value: `${discrepancies.filter((item) => item.status === 'Open').length} items`, tone: 'danger' },
  ]

  const handleLogin = (event) => {
    event.preventDefault()
    const username = loginForm.username.trim()
    const password = loginForm.password.trim()

    if (username === 'admin2026' && password === 'admin@123') {
      setSession({ loggedIn: true, role: 'admin', user: { name: 'Admin User', username, email: 'admin@revenueops.in' } })
      setActivePage('Dashboard')
      setLoginError('')
      return
    }

    if (username === 'doctor2026' && password === 'doc@123') {
      setSession({ loggedIn: true, role: 'doctor', user: { name: 'Dr. Aisha Nair', username, email: 'aisha.nair@healthcare.in' } })
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
  }

  const handleHospitalServiceAdd = () => {
    const name = hospitalForm.serviceName.trim()
    const rate = Number(hospitalForm.serviceRate || 0)

    if (!name || rate <= 0) return

    const exists = hospitalForm.services.some((service) => service.name.toLowerCase() === name.toLowerCase())
    if (exists) return

    setHospitalForm((current) => ({
      ...current,
      serviceName: '',
      serviceRate: '',
      services: [...current.services, { name, rate }],
    }))
  }

  const handleHospitalSave = (event) => {
    event.preventDefault()

    if (!hospitalForm.name.trim()) return

    const servicesToSave = hospitalForm.services.length
      ? hospitalForm.services
      : [{ name: hospitalForm.serviceName.trim() || 'Consultation', rate: Number(hospitalForm.serviceRate || 0) }]

    const newHospital = {
      id: Date.now(),
      name: hospitalForm.name.trim(),
      location: 'Bangalore',
      paymentTerms: hospitalForm.paymentTerms || 'Net 15',
      services: servicesToSave,
    }

    setHospitals((prev) => [newHospital, ...prev])
    setRecordForm((current) => ({
      ...current,
      hospital: newHospital.name,
      service: newHospital.services[0]?.name || current.service,
    }))
    setHospitalForm({
      name: '',
      paymentTerms: 'Net 15',
      serviceName: 'Consultation',
      serviceRate: '1000',
      services: [{ name: 'Consultation', rate: 1000 }],
    })
  }

  const handleRecordSave = (event) => {
    event.preventDefault()

    const rate = selectedServiceRate
    const cases = Number(recordForm.cases || 0)
    const expected = rate * cases

    setRecords((prev) => [{
      id: Date.now(),
      hospital: recordForm.hospital,
      date: recordForm.date,
      purpose: recordForm.purpose,
      service: recordForm.service,
      cases,
      expectedAmount: expected,
    }, ...prev])

    setRecordForm((current) => ({
      ...current,
      date: '2026-09-15',
      purpose: 'Consultation',
      service: currentHospitalServices[0]?.name || 'Consultation',
      cases: '5',
    }))
  }

  const handlePaymentSave = (event) => {
    event.preventDefault()

    setPayments((prev) => [{
      id: Date.now(),
      hospital: paymentForm.hospital,
      date: paymentForm.date,
      amount: Number(paymentForm.amount || 0),
      status: paymentForm.status,
    }, ...prev])

    setPaymentForm({
      hospital: paymentForm.hospital,
      date: '2026-09-20',
      amount: '10000',
      status: 'Paid',
    })
  }

  const updateDiscrepancyStatus = (id, nextStatus) => {
    setDiscrepancies((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)))
  }

  const renderDashboard = () => (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>{userRole === 'doctor' ? 'My Dashboard' : 'Admin Dashboard'}</h1>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span>Expected Revenue</span>
          <strong>{formatMoney(totalExpected)}</strong>
          <small>Booked value</small>
        </div>
        <div className="kpi-card">
          <span>Received Revenue</span>
          <strong>{formatMoney(totalReceived)}</strong>
          <small>Actual payments</small>
        </div>
        <div className="kpi-card">
          <span>Outstanding Revenue</span>
          <strong>{formatMoney(totalOutstanding)}</strong>
          <small>Due still pending</small>
        </div>
        <div className="kpi-card">
          <span>Discrepancy Amount</span>
          <strong>{formatMoney(discrepancyAmount)}</strong>
          <small>Needs follow-up</small>
        </div>
        <div className="kpi-card">
          <span>Hospitals</span>
          <strong>{hospitals.length}</strong>
          <small>Active accounts</small>
        </div>
        <div className="kpi-card">
          <span>Records</span>
          <strong>{records.length}</strong>
          <small>Visits logged</small>
        </div>
      </div>

      <div className="two-col-layout">
        <div className="panel">
          <div className="panel-header">
            <h3>Hospital-wise summary</h3>
            <span className="chip neutral">Live</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Expected</th>
                  <th>Received</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {hospitalSummary.map((hospital) => (
                  <tr key={hospital.id}>
                    <td>{hospital.name}</td>
                    <td>{formatMoney(hospital.expected)}</td>
                    <td>{formatMoney(hospital.received)}</td>
                    <td>{formatMoney(hospital.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Needs attention</h3>
          </div>
          <ul className="attention-list">
            {needsAttention.map((item) => (
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
      <div className="page-header">
        <div>
          <p className="eyebrow">Hospitals</p>
          <h1>{userRole === 'doctor' ? 'My Hospitals' : 'Hospitals'}</h1>
        </div>
      </div>

      {userRole === 'doctor' && (
        <div className="panel form-panel">
          <h3>Add Hospital</h3>
          <form className="grid-form" onSubmit={handleHospitalSave}>
            <FormField label="Hospital Name" helper="Enter the hospital name.">
              <input type="text" value={hospitalForm.name} onChange={(event) => setHospitalForm({ ...hospitalForm, name: event.target.value })} placeholder="Hospital Name" />
            </FormField>

            <FormField label="Payment Terms" helper="Choose the payment cycle.">
              <select value={hospitalForm.paymentTerms} onChange={(event) => setHospitalForm({ ...hospitalForm, paymentTerms: event.target.value })}>
                <option value="Net 15">Net 15</option>
                <option value="Net 21">Net 21</option>
                <option value="Net 30">Net 30</option>
              </select>
            </FormField>

            <FormField label="Service Name" helper="Add a service this hospital offers.">
              <input type="text" value={hospitalForm.serviceName} onChange={(event) => setHospitalForm({ ...hospitalForm, serviceName: event.target.value })} placeholder="Consultation" />
            </FormField>

            <FormField label="Service Rate (₹)" helper="Set the per-case rate.">
              <input type="number" min="0" value={hospitalForm.serviceRate} onChange={(event) => setHospitalForm({ ...hospitalForm, serviceRate: event.target.value })} placeholder="1000" />
            </FormField>

            <div className="form-action-row">
              <button type="button" className="secondary-btn" onClick={handleHospitalServiceAdd}>+ Add Service</button>
            </div>

            <div className="form-action-row full-width-action">
              <button type="submit" className="primary-btn">+ Save Hospital</button>
            </div>
          </form>

          <div className="service-list">
            {hospitalForm.services.map((service) => (
              <span key={`${service.name}-${service.rate}`} className="service-pill">
                {service.name} · {formatMoney(service.rate)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Location</th>
                <th>Payment Terms</th>
                <th>Services</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((hospital) => (
                <tr key={hospital.id}>
                  <td>{hospital.name}</td>
                  <td>{hospital.location}</td>
                  <td>{hospital.paymentTerms}</td>
                  <td>
                    <div className="inline-pill-list">
                      {hospital.services.map((service) => (
                        <span key={`${hospital.id}-${service.name}`} className="service-pill small-pill">
                          {service.name}: {formatMoney(service.rate)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )

  const renderRecords = () => (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Records</p>
          <h1>{userRole === 'doctor' ? 'My Records' : 'Records'}</h1>
        </div>
      </div>

      {userRole === 'doctor' && (
        <div className="panel form-panel">
          <h3>Add Visit Record</h3>
          <form className="grid-form" onSubmit={handleRecordSave}>
            <FormField label="Hospital" helper="Select the hospital where you worked.">
              <select value={recordForm.hospital} onChange={(event) => {
                const nextHospitalName = event.target.value
                const nextHospital = hospitals.find((hospital) => hospital.name === nextHospitalName)
                setRecordForm({
                  ...recordForm,
                  hospital: nextHospitalName,
                  service: nextHospital?.services[0]?.name || 'Consultation',
                })
              }}>
                {hospitals.map((hospital) => (
                  <option key={hospital.id} value={hospital.name}>{hospital.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Date" helper="Choose the visit date.">
              <input type="date" value={recordForm.date} onChange={(event) => setRecordForm({ ...recordForm, date: event.target.value })} />
            </FormField>

            <FormField label="Purpose" helper="Briefly describe the visit.">
              <input type="text" value={recordForm.purpose} onChange={(event) => setRecordForm({ ...recordForm, purpose: event.target.value })} placeholder="Consultation" />
            </FormField>

            <FormField label="Service" helper="Select the service you provided.">
              <select value={recordForm.service} onChange={(event) => setRecordForm({ ...recordForm, service: event.target.value })}>
                {currentHospitalServices.map((service) => (
                  <option key={service.name} value={service.name}>{service.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Number of Cases" helper="Enter the number of cases handled.">
              <input type="number" min="0" value={recordForm.cases} onChange={(event) => setRecordForm({ ...recordForm, cases: event.target.value })} placeholder="5" />
            </FormField>

            <FormField label="Expected Amount" helper="This auto-calculates from rate × cases.">
              <input type="text" value={formatMoney(calculatedExpectedAmount)} readOnly />
            </FormField>

            <div className="form-action-row full-width-action">
              <button type="submit" className="primary-btn">Save Record</button>
            </div>
          </form>

          <div className="calculation-box">
            <small>{formatMoney(selectedServiceRate)} per case × {Number(recordForm.cases || 0)} cases</small>
            <strong>Expected Amount: {formatMoney(calculatedExpectedAmount)}</strong>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Date</th>
                <th>Purpose</th>
                <th>Service</th>
                <th>Cases</th>
                <th>Expected</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.hospital}</td>
                  <td>{record.date}</td>
                  <td>{record.purpose}</td>
                  <td>{record.service}</td>
                  <td>{record.cases}</td>
                  <td>{formatMoney(record.expectedAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )

  const renderPayments = () => (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Payments</p>
          <h1>{userRole === 'doctor' ? 'My Payments' : 'Payments'}</h1>
        </div>
      </div>

      {userRole === 'doctor' && (
        <div className="panel form-panel">
          <h3>Record Payment</h3>
          <form className="grid-form" onSubmit={handlePaymentSave}>
            <FormField label="Hospital" helper="Select the hospital that paid you.">
              <select value={paymentForm.hospital} onChange={(event) => setPaymentForm({ ...paymentForm, hospital: event.target.value })}>
                {hospitals.map((hospital) => (
                  <option key={hospital.id} value={hospital.name}>{hospital.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Payment Date" helper="Select the date payment was received.">
              <input type="date" value={paymentForm.date} onChange={(event) => setPaymentForm({ ...paymentForm, date: event.target.value })} />
            </FormField>

            <FormField label="Payment Amount" helper="Enter the amount received in INR.">
              <input type="number" min="0" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} placeholder="15000" />
            </FormField>

            <FormField label="Status" helper="Choose its current status.">
              <select value={paymentForm.status} onChange={(event) => setPaymentForm({ ...paymentForm, status: event.target.value })}>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </FormField>

            <div className="form-action-row full-width-action">
              <button type="submit" className="primary-btn">Save Payment</button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
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
    </>
  )

  const renderDiscrepancies = () => (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Follow-up</p>
          <h1>Discrepancies</h1>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Date</th>
                <th>Expected</th>
                <th>Received</th>
                <th>Difference</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {discrepancies.map((item) => (
                <tr key={item.id}>
                  <td>{item.hospital}</td>
                  <td>{item.date}</td>
                  <td>{formatMoney(item.expectedAmount)}</td>
                  <td>{formatMoney(item.receivedAmount)}</td>
                  <td>{formatMoney(item.difference)}</td>
                  <td><span className={`status-badge ${item.status.toLowerCase()}`}>{item.status}</span></td>
                  <td>
                    <select value={item.status} onChange={(event) => updateDiscrepancyStatus(item.id, event.target.value)}>
                      <option value="Open">Open</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )

  const renderDoctors = () => (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Doctors</p>
          <h1>Doctor Overview</h1>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Hospitals</th>
                <th>Records</th>
                <th>Payments</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Dr. Aisha Nair</td>
                <td>doctor2026</td>
                <td>{hospitals.length}</td>
                <td>{records.length}</td>
                <td>{payments.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )

  const renderMyAccount = () => (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>My Account</h1>
        </div>
      </div>

      <div className="panel account-panel">
        <div className="account-header">
          <div className="avatar">{(session.user?.name || 'A').charAt(0)}</div>
          <div>
            <h3>{session.user?.name || 'Doctor User'}</h3>
            <p>{userRole === 'doctor' ? 'Doctor' : 'Admin'}</p>
          </div>
        </div>

        <div className="account-grid">
          <div className="account-detail">
            <span>Name</span>
            <strong>{session.user?.name || 'Doctor User'}</strong>
          </div>
          <div className="account-detail">
            <span>Username</span>
            <strong>{session.user?.username || 'doctor2026'}</strong>
          </div>
          <div className="account-detail">
            <span>Role</span>
            <strong>{userRole === 'doctor' ? 'Doctor' : 'Admin'}</strong>
          </div>
          <div className="account-detail">
            <span>Email</span>
            <strong>{session.user?.email || 'n/a'}</strong>
          </div>
        </div>

        <div className="account-actions">
          <button type="button" className="secondary-btn">Change password</button>
          <button type="button" className="danger-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </>
  )

  const renderPage = () => {
    switch (activePage) {
      case 'Dashboard':
        return renderDashboard()
      case 'My Hospitals':
      case 'Hospitals':
        return renderHospitals()
      case 'My Records':
      case 'Records':
        return renderRecords()
      case 'My Payments':
      case 'Payments':
        return renderPayments()
      case 'Discrepancies':
        return renderDiscrepancies()
      case 'Doctors':
        return renderDoctors()
      case 'My Account':
        return renderMyAccount()
      default:
        return renderDashboard()
    }
  }

  if (!session.loggedIn) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-header">
            <p className="eyebrow neutral">Secure access</p>
            <h1>Doctor Revenue Tracking</h1>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <label className="field">
              <span className="field-label">Username</span>
              <input type="text" value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} placeholder="Enter username" />
            </label>

            <label className="field">
              <span className="field-label">Password</span>
              <input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="Enter password" />
            </label>

            {loginError && <div className="login-error">{loginError}</div>}

            <button type="submit" className="primary-btn full-width-btn">Login</button>
          </form>

          <div className="login-note">
            <strong>Demo accounts</strong>
            <p>Doctor: doctor2026 / doc@123</p>
            <p>Admin: admin2026 / admin@123</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <button type="button" className="mobile-toggle" onClick={() => setSidebarOpen((current) => !current)} aria-label="Toggle menu">
        ☰
      </button>

      <aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand-block">
          <div className="brand-mark">VD</div>
          <div>
            <p className="eyebrow neutral">{userRole === 'doctor' ? 'Doctor' : 'Admin'}</p>
            <h2>Revenue Ledger</h2>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Sidebar navigation">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className={activePage === item ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                if (item === 'Logout') {
                  handleLogout()
                  return
                }

                setActivePage(item)
                setSidebarOpen(false)
              }}
            >
              <span className="nav-icon">
                {item === 'Dashboard' && '🏠'}
                {item === 'My Hospitals' && '🏥'}
                {item === 'My Records' && '📋'}
                {item === 'My Payments' && '💰'}
                {item === 'Discrepancies' && '⚠️'}
                {item === 'My Account' && '👤'}
                {item === 'Doctors' && '👨‍⚕️'}
                {item === 'Hospitals' && '🏥'}
                {item === 'Records' && '🧾'}
                {item === 'Payments' && '₹'}
                {item === 'Logout' && '🚪'}
              </span>
              {item}
            </button>
          ))}
        </nav>
      </aside>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main className="content-area">{renderPage()}</main>
    </div>
  )
}

export default App
'@

$CSSContent = @'
:root {
  --bg: #f4f7fb;
  --surface: #ffffff;
  --surface-soft: #f8fafc;
  --primary: #0f766e;
  --primary-strong: #115e59;
  --accent: #2563eb;
  --text: #18212f;
  --muted: #64748b;
  --border: rgba(148, 163, 184, 0.2);
  --warning: #d97706;
  --danger: #dc2626;
  --success: #047857;
  --shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Inter, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
}

button,
input,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

.login-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #f6fafb 0%, #ebf2f5 100%);
  padding: 20px;
}

.login-card {
  width: min(460px, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 32px 24px;
  box-shadow: var(--shadow);
}

.login-header h1 {
  margin: 0;
  font-size: clamp(1.8rem, 3vw, 2.3rem);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 24px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text);
}

.field input,
.field select,
.grid-form input,
.grid-form select,
table select {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  border-radius: 12px;
  color: var(--text);
  padding: 11px 12px;
}

.field input:focus,
.field select:focus,
.grid-form input:focus,
.grid-form select:focus,
table select:focus {
  outline: none;
  border-color: rgba(15, 118, 110, 0.7);
  box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.1);
}

.field-hint {
  font-size: 0.72rem;
  color: var(--muted);
}

.login-error {
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.2);
  color: var(--danger);
  padding: 10px 12px;
  border-radius: 10px;
}

.full-width-btn {
  width: 100%;
}

.login-note {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  color: var(--muted);
}

.login-note p { margin: 4px 0; }

.app-shell {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(180deg, #f8fafc 0%, #edf4f8 100%);
}

.sidebar {
  width: 270px;
  background: linear-gradient(180deg, #111827 0%, #0f172a 100%);
  color: #edf2f7;
  padding: 22px 16px;
  position: sticky;
  top: 0;
  height: 100vh;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  margin-bottom: 18px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: #fff;
  font-weight: 800;
}

.brand-block h2 {
  margin: 0;
  color: #f8fafc;
  font-size: 1.14rem;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--primary);
}

.eyebrow.neutral {
  color: #bfdbfe;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  width: 100%;
  padding: 12px 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #e2e8f0;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
}

.nav-item:hover,
.nav-item.active {
  background: rgba(15, 118, 110, 0.14);
  border-color: rgba(15, 118, 110, 0.35);
  color: #fff;
}

.nav-icon {
  width: 20px;
  display: inline-flex;
  justify-content: center;
}

.content-area {
  flex: 1;
  padding: 32px 28px 40px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: clamp(1.9rem, 2.5vw, 2.6rem);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 22px;
}

.kpi-card {
  background: var(--surface);
  border-radius: 18px;
  border: 1px solid var(--border);
  padding: 20px 16px;
  box-shadow: var(--shadow);
}

.kpi-card span {
  display: block;
  color: var(--muted);
  margin-bottom: 10px;
  font-size: 0.76rem;
}

.kpi-card strong {
  display: block;
  font-size: clamp(1.4rem, 2vw, 1.8rem);
  margin-bottom: 8px;
}

.kpi-card small {
  color: var(--muted);
  font-size: 0.7rem;
}

.two-col-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 18px;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 20px 18px;
  box-shadow: var(--shadow);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.08rem;
}

.chip {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
}

.chip.neutral {
  background: rgba(37, 99, 235, 0.08);
  color: var(--accent);
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 14px 12px;
  text-align: left;
  border-bottom: 1px solid #edf2f7;
}

th {
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.attention-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attention-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
}

.tone-warning { border-left: 4px solid var(--warning); }
.tone-danger { border-left: 4px solid var(--danger); }
.tone-neutral { border-left: 4px solid #0ea5e9; }

.form-panel {
  margin-bottom: 22px;
}

.grid-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.form-action-row {
  display: flex;
  align-items: end;
}

.full-width-action {
  grid-column: 1 / -1;
}

.primary-btn,
.secondary-btn,
.danger-btn {
  border-radius: 12px;
  padding: 11px 16px;
  font-weight: 700;
  border: none;
}

.primary-btn {
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: white;
}

.secondary-btn {
  background: rgba(37, 99, 235, 0.08);
  color: var(--accent);
  border: 1px solid rgba(37, 99, 235, 0.18);
}

.danger-btn {
  background: rgba(220, 38, 38, 0.08);
  color: var(--danger);
  border: 1px solid rgba(220, 38, 38, 0.18);
}

.service-list,
.inline-pill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.service-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(15, 118, 110, 0.08);
  color: var(--primary-strong);
  border: 1px solid rgba(15, 118, 110, 0.15);
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 0.75rem;
  font-weight: 600;
}

.small-pill {
  font-size: 0.68rem;
}

.calculation-box {
  margin-top: 16px;
  padding: 14px 16px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.calculation-box small {
  color: var(--muted);
}

.calculation-box strong {
  font-size: 1.08rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.7rem;
  font-weight: 700;
}

.status-badge.paid,
.status-badge.resolved {
  background: rgba(4, 120, 87, 0.12);
  color: var(--success);
}

.status-badge.pending {
  background: rgba(217, 119, 6, 0.12);
  color: var(--warning);
}

.status-badge.overdue,
.status-badge.open {
  background: rgba(220, 38, 38, 0.12);
  color: var(--danger);
}

.status-badge.partially-paid {
  background: rgba(59, 130, 246, 0.12);
  color: var(--accent);
}

.account-panel {
  max-width: 920px;
}

.account-header {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 24px;
}

.avatar {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: #fff;
  font-size: 1.5rem;
}

.account-header h3 {
  margin: 0 0 4px;
  font-size: 1.4rem;
}

.account-header p {
  margin: 0;
  color: var(--muted);
}

.account-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.account-detail {
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface-soft);
  padding: 14px 16px;
}

.account-detail span {
  display: block;
  color: var(--muted);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.account-detail strong {
  color: var(--text);
}

.account-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.mobile-toggle {
  display: none;
  position: fixed;
  left: 14px;
  top: 14px;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow);
  color: var(--text);
  z-index: 30;
}

.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 20;
}

@media (max-width: 1100px) {
  .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .two-col-layout, .grid-form, .account-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 760px) {
  .mobile-toggle { display: block; }

  .sidebar {
    position: fixed;
    left: -100%;
    top: 0;
    bottom: 0;
    width: min(82vw, 300px);
    z-index: 22;
    transition: left 0.25s ease;
  }

  .sidebar.open { left: 0; }

  .content-area { padding: 78px 16px 32px; }
  .kpi-grid, .two-col-layout, .grid-form, .account-grid { grid-template-columns: 1fr; }
  .account-actions { flex-direction: column; }
}
'@

Set-Content -Path 'C:\Users\deban\Desktop\Doctor tracking\src\App.jsx' -Value $AppContent -Encoding UTF8
Set-Content -Path 'C:\Users\deban\Desktop\Doctor tracking\src\App.css' -Value $CSSContent -Encoding UTF8
Write-Host 'App files updated successfully.'
