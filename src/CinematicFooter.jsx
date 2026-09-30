import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowUp, LogIn, UserPlus } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

function MagneticButton({ as: Component = 'button', className = '', children, ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(hover: none)').matches) return

    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left - r.width / 2
      const y = e.clientY - r.top - r.height / 2
      gsap.to(el, { x: x * 0.4, y: y * 0.4, rotationX: -y * 0.15, rotationY: x * 0.15, scale: 1.05, ease: 'power2.out', duration: 0.4 })
    }
    const onLeave = () => gsap.to(el, { x: 0, y: 0, rotationX: 0, rotationY: 0, scale: 1, ease: 'elastic.out(1, 0.3)', duration: 1.2 })

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      gsap.killTweensOf(el)
    }
  }, [])

  return <Component ref={ref} className={`cf-pill ${className}`} {...props}>{children}</Component>
}

const MARQUEE = ['Revenue Reconciliation', 'Payout Waterfall', 'TDS Tracking', 'Hospital Profiles', 'Statement Matching']

const MarqueeItem = () => (
  <div className="cf-marquee-group">
    {MARQUEE.map((t, i) => (
      <span key={t}><span>{t}</span><span className={i % 2 ? 'cf-star alt' : 'cf-star'}>✦</span></span>
    ))}
  </div>
)

export default function CinematicFooter({ onLogin, onSignup }) {
  const wrapperRef = useRef(null)
  const giantRef = useRef(null)
  const headingRef = useRef(null)
  const linksRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(giantRef.current, { y: '10vh', scale: 0.8, opacity: 0 }, {
        y: '0vh', scale: 1, opacity: 1, ease: 'power1.out',
        scrollTrigger: { trigger: wrapperRef.current, start: 'top 80%', end: 'bottom bottom', scrub: 1 },
      })
      gsap.fromTo([headingRef.current, linksRef.current], { y: 50, opacity: 0 }, {
        y: 0, opacity: 1, stagger: 0.15, ease: 'power3.out',
        scrollTrigger: { trigger: wrapperRef.current, start: 'top 40%', end: 'bottom bottom', scrub: 1 },
      })
    }, wrapperRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={wrapperRef} className="cf-curtain">
      <footer className="cf-footer">
        <div className="cf-aurora" />
        <div className="cf-grid" />
        <div ref={giantRef} className="cf-giant">DOCTRACK</div>

        <div className="cf-marquee">
          <div className="cf-marquee-track"><MarqueeItem /><MarqueeItem /></div>
        </div>

        <div className="cf-center">
          <h2 ref={headingRef} className="cf-heading">Ready to begin?</h2>
          <div ref={linksRef} className="cf-links">
            <div className="cf-links-row">
              <MagneticButton className="primary" onClick={onSignup}><UserPlus size={20} /> Create free account</MagneticButton>
              <MagneticButton className="primary" onClick={onLogin}><LogIn size={20} /> Log in</MagneticButton>
            </div>
            <div className="cf-links-row">
              <MagneticButton as="a" href="#" className="secondary">Privacy Policy</MagneticButton>
              <MagneticButton as="a" href="#" className="secondary">Terms of Service</MagneticButton>
              <MagneticButton as="a" href="mailto:support@doctrack.app" className="secondary">Support</MagneticButton>
            </div>
          </div>
        </div>

        <div className="cf-bottom">
          <div className="cf-copy">© {new Date().getFullYear()} DocTrack. All rights reserved.</div>
          <div className="cf-pill cf-badge">
            <span>Crafted with</span><span className="cf-heart">❤</span><span>for doctors</span>
          </div>
          <MagneticButton className="cf-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top">
            <ArrowUp size={18} />
          </MagneticButton>
        </div>
      </footer>
    </div>
  )
}
