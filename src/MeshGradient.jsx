import { memo, useEffect, useRef, useState } from 'react'

let CachedMeshGradient = null

// WebGL mesh gradient from @paper-design/shaders-react, loaded lazily so the
// welcome page renders immediately with a plain CSS gradient underneath.
const MeshGradient = memo(function MeshGradient({
  colors = ['#0a1a4a', '#1f4fd8', '#4c9bff', '#0f172a'],
  speed = 0.6,
  distortion = 1,
  swirl = 0.57,
  scale = 1.45,
  rotation = 120,
  className = '',
  style,
}) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [Shader, setShader] = useState(() => CachedMeshGradient)
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (CachedMeshGradient) return
    let cancelled = false
    import('@paper-design/shaders-react')
      .then(mod => { if (!cancelled) { CachedMeshGradient = mod.MeshGradient; setShader(() => mod.MeshGradient) } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const apply = (w, h) => { if (w > 0 && h > 0) setSize({ width: Math.round(w), height: Math.round(h) }) }
    const ro = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; apply(width, height) })
    ro.observe(el)
    const { width, height } = el.getBoundingClientRect()
    apply(width, height)
    return () => ro.disconnect()
  }, [])

  const fallback = { background: `linear-gradient(to top right, ${colors[colors.length - 1]}, ${colors[1] || colors[0]}, ${colors[2] || colors[0]})` }

  return (
    <div ref={containerRef} className={`mesh-gradient ${className}`} style={{ ...fallback, ...style }} aria-hidden="true">
      {Shader && (
        <Shader
          width={size.width}
          height={size.height}
          colors={colors}
          speed={reduceMotion ? 0 : speed}
          distortion={distortion}
          swirl={swirl}
          scale={scale}
          rotation={rotation}
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </div>
  )
})

export default MeshGradient
