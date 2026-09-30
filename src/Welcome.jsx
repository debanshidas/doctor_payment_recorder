import { ArrowRight, Building2, IndianRupee, ShieldCheck } from 'lucide-react'
import CinematicFooter from './CinematicFooter.jsx'
import MeshGradient from './MeshGradient.jsx'
import ShinyButton from './ShinyButton.jsx'
import './welcome.css'

const FEATURES = [
  { icon: Building2, title: 'Share or fixed-fee rules', text: 'Model each hospital the way it actually pays you: a percentage of gross billing, or a fixed amount per case.' },
  { icon: IndianRupee, title: 'TDS and deductions, automatically', text: 'Every entry shows gross, your share, TDS, deductions and the exact net you should expect to receive.' },
  { icon: ShieldCheck, title: 'Verified payments', text: 'Record a payment in seconds; it stays under review until verified so your numbers are never inflated.' },
]

const STEPS = [
  { n: '01', title: 'Add your hospitals', text: 'Enter each hospital once with its payout rule and its services — consultation, follow-up, surgery types — with prices.' },
  { n: '02', title: 'Log your work', text: 'Pick hospital and service; the amount appears. Multiple cases on the same day take one entry.' },
  { n: '03', title: 'Record payments', text: 'Enter what landed in your account. DocTrack shows earned vs received and what is still pending, per hospital.' },
]

export default function Welcome({ onLogin, onSignup }) {
  return (
    <div className="welcome">
      <main className="welcome-main">
        <div className="welcome-top">
        <MeshGradient className="welcome-mesh" />
        <div className="welcome-mesh-overlay" aria-hidden="true" />
        <header className="welcome-nav">
          <div className="welcome-brand">
            <span className="wordmark">Doc<span>Track</span><i /></span>
          </div>
          <nav>
            <button className="welcome-link" onClick={onLogin}>Log in</button>
            <button className="welcome-btn btn-noise" onClick={onSignup}>Get started <ArrowRight size={16} /></button>
          </nav>
        </header>

        <section className="welcome-hero">
          <span className="welcome-eyebrow">Revenue reconciliation for consulting doctors</span>
          <h1>Know exactly what every hospital owes you.</h1>
          <p>DocTrack turns your procedures into an expected-payout ledger, then checks each settlement against it — TDS, deductions and shortfalls included.</p>
          <div className="welcome-cta">
            <ShinyButton onClick={onSignup}>Create free account <ArrowRight size={18} /></ShinyButton>
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
        </div>

        <section className="welcome-section feature-cards">
          <div className="feature-cards-intro">
            <h2>Powerful, simple features</h2>
            <p>Everything between the OT and your bank account — priced once, logged in three clicks, reconciled automatically.</p>
          </div>
          <div className="feature-cards-row">
            <article className="feature-card">
              <div className="feature-art art-entry" aria-hidden="true">
                <div className="art-row"><span>Hospital</span><b>Kauvery Hospital</b></div>
                <div className="art-row"><span>Service</span><b>Consultation</b></div>
                <div className="art-row"><span>Amount</span><b className="art-green">₹1,000</b></div>
                <div className="art-btn">Save Entry</div>
              </div>
              <h3>Three-click daily entries</h3>
              <p>Pick the hospital and service; the amount fills itself from your prices. Save, or save and add another.</p>
            </article>
            <article className="feature-card">
              <div className="feature-art art-services" aria-hidden="true">
                <div className="art-title">Kauvery Hospital · Services</div>
                <div className="art-chips">
                  <span>Consultation <em>₹1,000</em></span>
                  <span>Follow-up <em>₹500</em></span>
                  <span>Surgery <em>3 types</em></span>
                  <span className="art-chip-add">+ Add Service</span>
                </div>
              </div>
              <h3>Services priced per hospital</h3>
              <p>Consultation, follow-up, surgery types with their own rates — configured once on the hospital card.</p>
            </article>
            <article className="feature-card">
              <div className="feature-art art-money" aria-hidden="true">
                <div className="art-bar"><span>Earned</span><i style={{ width: '100%' }} /><b>₹1.2L</b></div>
                <div className="art-bar"><span>Received</span><i className="g" style={{ width: '62%' }} /><b>₹74k</b></div>
                <div className="art-bar"><span>Review</span><i className="a" style={{ width: '18%' }} /><b>₹22k</b></div>
                <div className="art-bar"><span>Pending</span><i className="r" style={{ width: '20%' }} /><b>₹24k</b></div>
              </div>
              <h3>Earned vs received</h3>
              <p>Earned, received, under review and pending — per hospital, always computed from real entries and payments.</p>
            </article>
          </div>
          <ul className="feature-points">
            {FEATURES.map(f => (
              <li key={f.title}><f.icon size={16} /><span><strong>{f.title}.</strong> {f.text}</span></li>
            ))}
          </ul>
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
