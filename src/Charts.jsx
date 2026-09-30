// Lightweight, dependency-free charts (SVG + CSS) matching the DocTrack palette.

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const short = (n) => {
  n = Number(n) || 0
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(n % 1e7 ? 1 : 0) + 'Cr'
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(n % 1e5 ? 1 : 0) + 'L'
  if (n >= 1e3) return '₹' + (n / 1e3).toFixed(n % 1e3 ? 1 : 0) + 'k'
  return '₹' + n
}

export const STATUS_COLOR = {
  Paid: '#10b981', 'Partially Paid': '#6366f1', 'Under Review': '#f59e0b', Pending: '#94a3b8', Rejected: '#ef4444',
}
const SERIES = ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#f97316']

export function ChartEmpty({ message = 'No data available yet. Add your first visit to start seeing analytics.' }) {
  return <div className="chart-empty">{message}</div>
}

// Horizontal stacked bars — hospital payments split into received / under review / pending.
export function SettlementBars({ rows }) {
  if (!rows || rows.length === 0) return <ChartEmpty />
  const max = Math.max(1, ...rows.map(r => r.earned))
  return (
    <div className="cbars">
      <div className="cbars-legend">
        <span><i style={{ background: STATUS_COLOR.Paid }} />Received</span>
        <span><i style={{ background: STATUS_COLOR['Under Review'] }} />Under review</span>
        <span><i style={{ background: STATUS_COLOR.Pending }} />Pending</span>
      </div>
      {rows.map(r => (
        <div key={r.id ?? r.name} className="cbar-row">
          <div className="cbar-head"><span className="cbar-name">{r.name}</span><span className="cbar-val">{money(r.earned)} earned</span></div>
          <div className="cbar-track" role="img" aria-label={`${r.name}: received ${money(r.received)}, under review ${money(r.under_review)}, pending ${money(r.pending)}`}>
            <div style={{ width: `${(r.received / max) * 100}%`, background: STATUS_COLOR.Paid }} title={`Received ${money(r.received)}`} />
            <div style={{ width: `${(r.under_review / max) * 100}%`, background: STATUS_COLOR['Under Review'] }} title={`Under review ${money(r.under_review)}`} />
            <div style={{ width: `${(r.pending / max) * 100}%`, background: STATUS_COLOR.Pending }} title={`Pending ${money(r.pending)}`} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Horizontal bars for a single metric (services by type, revenue by hospital).
export function MetricBars({ data, valueKey = 'value', labelKey = 'label', color }) {
  if (!data || data.length === 0) return <ChartEmpty />
  const max = Math.max(1, ...data.map(d => d[valueKey]))
  return (
    <div className="cbars">
      {data.map((d, i) => (
        <div key={d.id ?? d[labelKey]} className="cbar-row">
          <div className="cbar-head"><span className="cbar-name">{d[labelKey]}</span><span className="cbar-val">{d.suffix || short(d[valueKey])}</span></div>
          <div className="cbar-track single"><div style={{ width: `${(d[valueKey] / max) * 100}%`, background: color || SERIES[i % SERIES.length] }} /></div>
        </div>
      ))}
    </div>
  )
}

// Donut for payment status distribution.
export function Donut({ data, centerLabel, centerValue }) {
  const items = (data || []).filter(d => d.value > 0)
  if (items.length === 0) return <ChartEmpty />
  const total = items.reduce((s, d) => s + d.value, 0)
  const R = 42, C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="cdonut">
      <svg viewBox="0 0 100 100" className="cdonut-svg" role="img" aria-label="Payment status distribution">
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--border-light)" strokeWidth="12" />
        {items.map((d, i) => {
          const len = (d.value / total) * C
          const seg = <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={d.color || SERIES[i % SERIES.length]} strokeWidth="12" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 50 50)" />
          offset += len
          return seg
        })}
        <text x="50" y="46" textAnchor="middle" className="cdonut-num">{centerValue ?? total}</text>
        <text x="50" y="60" textAnchor="middle" className="cdonut-lbl">{centerLabel ?? 'total'}</text>
      </svg>
      <div className="cdonut-legend">
        {items.map((d, i) => (
          <span key={i}><i style={{ background: d.color || SERIES[i % SERIES.length] }} />{d.label} <b>{d.value}</b></span>
        ))}
      </div>
    </div>
  )
}

// Line chart for monthly revenue trend.
export function LineChart({ points, valueKey = 'value' }) {
  if (!points || points.length === 0) return <ChartEmpty />
  const W = 640, H = 200, pad = { l: 44, r: 12, t: 14, b: 26 }
  const max = Math.max(1, ...points.map(p => p[valueKey]))
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const x = (i) => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw)
  const y = (v) => pad.t + ih - (v / max) * ih
  const line = points.map((p, i) => `${x(i)},${y(p[valueKey])}`).join(' ')
  const area = `${pad.l},${pad.t + ih} ${line} ${x(points.length - 1)},${pad.t + ih}`
  const ticks = [0, max / 2, max]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cline" role="img" aria-label="Monthly revenue trend">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border-light)" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="cline-axis">{short(t)}</text>
        </g>
      ))}
      <polygon points={area} fill="rgba(59,130,246,0.12)" />
      <polyline points={line} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p[valueKey])} r="3.5" fill="#3b82f6" />
          <text x={x(i)} y={H - 8} textAnchor="middle" className="cline-axis">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}
