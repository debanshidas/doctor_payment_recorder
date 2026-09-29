import re

app_path = "src/App.jsx"
with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Auth UI
auth_ui = """  if (!session.loggedIn) {
    return (
      <div className="login-shell">
        <div className="auth-panel single-col">
          <div className="login-card">
            {authView === 'login' && (
              <>
                <div className="login-header">
                  <img src="/doctrack-logo.png" alt="DocTrack" className="login-logo" style={{ objectFit: 'contain' }} />
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
                  <img src="/doctrack-logo.png" alt="DocTrack" className="login-logo" style={{ objectFit: 'contain' }} />
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
  }"""

content = re.sub(r"  if \(!session\.loggedIn\) \{.*?    \)\n  \}", auth_ui, content, flags=re.DOTALL)
content = re.sub(r"function AbstractRevenueVisual\(\) \{.*?  \)\n\}\n", "", content, flags=re.DOTALL)

# 2. Payments View Update
payments_view = """  const renderPayments = () => {
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
  )}"""

content = re.sub(r"  const renderPayments = \(\) => \(\n.*?    </section>\n  \)", payments_view, content, flags=re.DOTALL)

# 3. Reports View
reports_view = """  const renderReports = () => {
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
"""

content = re.sub(r"  const renderDiscrepancies = \(\) => \(.*?    </>\n  \)", r"\g<0>\n" + reports_view, content, flags=re.DOTALL)

# 4. Update renderPage routing
render_page_update = """  const renderPage = () => {
    if (activePage === 'Dashboard') return renderDashboard()
    if (activePage === 'My Hospitals') return renderHospitals()
    if (activePage === 'My Records') return renderRecords()
    if (activePage === 'My Payments') return renderPayments()
    if (activePage === 'Discrepancies') return renderDiscrepancies()
    if (activePage === 'Reports') return renderReports()
    if (activePage === 'Settings') return renderSettings()
    return renderDashboard()
  }"""
content = re.sub(r"  const renderPage = \(\) => \{.*?    return renderDashboard\(\)\n  \}", render_page_update, content, flags=re.DOTALL)

# 5. Sidebar and Hamburger animation logic
sidebar_ui = """      <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <button type="button" className="mobile-toggle flex items-center justify-center" aria-label="Toggle menu" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ position: 'fixed', left: '16px', top: '16px', zIndex: 50, background: 'white', borderRadius: '8px', padding: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <Menu size={24} className="text-neutral-900" />
        </button>
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} style={{ width: sidebarCollapsed ? '0px' : '250px', overflow: 'hidden', transition: 'width 0.3s ease', background: '#1e293b', color: '#f8fafc', padding: sidebarCollapsed ? '0' : '20px 16px', height: '100vh', position: 'sticky', top: 0 }}>
          <div className="brand-block" style={{ opacity: sidebarCollapsed ? 0 : 1, transition: 'opacity 0.2s', marginTop: '40px' }}>
            <div className="brand-inner">
              <img src="/doctrack-logo.png" alt="" className="sidebar-logo" style={{ objectFit: 'contain' }} />
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
      </div>"""

content = re.sub(r'      <div className="app-shell">.*?      </div>\n\n      \{confirmDelete', sidebar_ui + '\n\n      {confirmDelete', content, flags=re.DOTALL)

with open(app_path, "w", encoding="utf-8") as f:
    f.write(content)

# Update CSS for login page columns
with open(css_path, "r", encoding="utf-8") as f:
    css = f.read()

css = css.replace("grid-template-columns: 1.18fr 0.82fr;", "grid-template-columns: 1fr;")
with open(css_path, "w", encoding="utf-8") as f:
    f.write(css)

print("App.jsx and App.css refactored for Reports, Settings, Sidebar, UI cleanup.")
