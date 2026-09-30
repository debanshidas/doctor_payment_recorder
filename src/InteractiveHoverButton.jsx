import { ArrowRight } from 'lucide-react'

export default function InteractiveHoverButton({ text = 'Button', className = '', type = 'button', ...props }) {
  return (
    <button type={type} className={`ihb ${className}`} {...props}>
      <span className="ihb-text">{text}</span>
      <span className="ihb-hover"><span>{text}</span><ArrowRight size={18} /></span>
      <span className="ihb-dot" aria-hidden="true" />
    </button>
  )
}
