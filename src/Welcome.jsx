import { Activity, ArrowRight, Building2, FileText, IndianRupee, ShieldCheck, Upload } from 'lucide-react'
import CinematicFooter from './CinematicFooter.jsx'
import './welcome.css'

const FEATURES = [
  { icon: FileText, title: 'Log procedures in seconds', text: 'Pick the hospital, enter cases and the billing amount per case. The payout waterfall is calculated instantly.' },
  { icon: Building2, title: 'Share or fixed-fee rules', text: 'Model each hospital the way it actually pays you: a percentage of gross billing, or a fixed amount per case.' },
  { icon: IndianRupee, title: 'TDS and deductions, automatically', text: 'Every entry shows gross, your share, TDS, deductions and the exact net you should expect to receive.' },
  { icon: Upload, title: 'Upload hospital statements', text: 'Drop in the statement for a settlement period and let DocTrack line it up against your ledger.' },
  { icon: Activity, title: 'Reconciliation at a glance', text: 'Matched, discrepancies and unmatched procedures side by side, with a live match rate for each hospital.' },
  { icon: ShieldCheck, title: 'Shortfall alerts', text: 'When a payout arrives short, DocTrack flags the gap so you can raise it with the finance team immediately.' },
]

const STEPS = [
  { n: '01', title: 'Add your hospitals', text: 'Enter each hospital once with its payout rule, TDS rate, deductions and settlement cycle.' },
  { n: '02', title: 'Log your work', text: 'Record procedures as they happen. Multiple cases on the same day take one entry.' },
  { n: '03', title: 'Reconcile payouts', text: 'Record what actually landed in your account and see exactly where it differs from what was owed.' },
]

export default function Welcome({ onLogin, onSignup }) {
  return (
    <div className="welcome">
      <main className="welcome-main">
        <header className="welcome-nav">
          <div className="welcome-brand">
            <img src="doctrack-logo.png" alt="" />
            <span>DocTrack</span>
          </div>
          <nav>
            <button className="welcome-link" onClick={onLogin}>Log in</button>
            <button className="welcome-btn" onClick={onSignup}>Get started <ArrowRight size={16} /></button>
          </nav>
        </header>

        <section className="welcome-hero">
          <span className="welcome-eyebrow">Revenue reconciliation for consulting doctors</span>
          <h1>Know exactly what every hospital owes you.</h1>
          <p>DocTrack turns your procedures into an expected-payout ledger, then checks each settlement against it — TDS, deductions and shortfalls included.</p>
          <div className="welcome-cta">
            <button className="welcome-btn large" onClick={onSignup}>Create free account <ArrowRight size={18} /></button>
            <button className="welcome-btn ghost large" onClick={onLogin}>I already have an account</button>
          </div>
          <div className="welcome-preview">
            <div className="welcome-preview-row head"><span>Gross billing (5 × ₹10,000)</span><span>₹50,000</span></div>
            <div className="welcome-preview-row"><span>Doctor share (80%)</span><span>₹40,000</span></div>
            <div className="welcome-preview-row minus"><span>TDS (10%)</span><span>− ₹4,000</span></div>
            <div className="welcome-preview-row minus"><span>Deductions (2%)</span><span>− ₹800</span></div>
            <div className="welcome-preview-row net"><span>Net expected payout</span><span>₹35,200</span></div>
          </div>
        </section>

        <section className="welcome-section">
          <h2>Everything between the OT and your bank account</h2>
          <div className="welcome-features">
            {FEATURES.map(f => (
              <div key={f.title} className="welcome-feature">
                <div className="welcome-feature-icon"><f.icon size={20} /></div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="welcome-section">
          <h2>How it works</h2>
          <div className="welcome-steps">
            {STEPS.map(s => (
              <div key={s.n} className="welcome-step">
                <span className="welcome-step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <CinematicFooter onLogin={onLogin} onSignup={onSignup} />
    </div>
  )
}
