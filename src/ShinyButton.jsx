export default function ShinyButton({ children, onClick, className = '', type = 'button' }) {
  return (
    <button type={type} className={`shiny-cta ${className}`} onClick={onClick}>
      <span>{children}</span>
    </button>
  )
}
