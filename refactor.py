import re
import os

app_path = "src/App.jsx"
css_path = "src/App.css"

with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports and Persistent State
imports_and_helpers = """import { useMemo, useState, useEffect } from 'react'
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
"""

content = re.sub(r"import \{ useMemo.*?(?=function App\(\) \{)", imports_and_helpers, content, flags=re.DOTALL)

# 2. App State variables
state_vars = """function App() {
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
"""

content = re.sub(r"function App\(\) \{.*?(?=  const selectedHospital)", state_vars, content, flags=re.DOTALL)

# 3. Auth Handlers
auth_handlers = """  const handleLogin = async (event) => {
    event.preventDefault()
    const username = loginForm.username.trim()
    const password = loginForm.password.trim()

    if (!username || !password) return setLoginError('Please enter both username and password.')

    const hashedPassword = await hashPassword(password)
    const user = users.find(u => u.username === username && u.password === hashedPassword)
    
    if (user) {
      const newSession = { loggedIn: true, role: user.role, user }
      setSession(newSession)
      setActivePage('Dashboard')
      setLoginError('')
      return
    }

    setLoginError('Invalid username or password.')
  }

  const handleSignup = async (event) => {
    event.preventDefault()
    const username = signupForm.username.trim()
    const password = signupForm.password.trim()
    const confirmPassword = signupForm.confirmPassword.trim()

    if (!username) return setSignupError('Username cannot be empty.')
    if (!password) return setSignupError('Password cannot be empty.')
    if (password.length < 6) return setSignupError('Password must be at least 6 characters long.')
    if (password !== confirmPassword) return setSignupError('Passwords do not match.')

    const existingUser = users.find(u => u.username === username)
    if (existingUser) {
      return setSignupError('An account with this username already exists. Please log in instead.')
    }

    const hashedPassword = await hashPassword(password)

    const newUser = {
      username,
      password: hashedPassword,
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
  }"""

content = re.sub(r"  const handleLogin =.*?\}  const addService = \(\) => \{", auth_handlers + "\n\n  const addService = () => {", content, flags=re.DOTALL)

with open(app_path, "w", encoding="utf-8") as f:
    f.write(content)

print("App.jsx refactored for persistent state and auth.")
