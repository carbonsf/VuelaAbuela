import { useEffect, useRef } from 'react'
import { Button, T } from '../components/despegue'

// Dynamic visual landing (takeoff). Continuous comets fly along bezier curves
// (the "dynamic visual"); the wordmark + CTA fly in along a curved arc, then the
// passing comets "charge" the wordmark — its scale and glow rise as a comet
// nears, peaking when one passes directly underneath. Pure theming.

// Optical kerning for the display wordmark. A uniform base track tightens the
// whole word; KERN then adds a per-pair optical correction (em, margin-left on
// the *second* letter of each pair) where Space Grotesk's metric spacing reads
// uneven at display size — chiefly the open diagonals of V and A.
const WORDMARK = 'VuelaAbuela'
const WHITE_UNTIL = 5 // "Vuela" white, "Abuela" yellow
const BASE_TRACK = -0.03 // uniform tracking applied to every pair
//                  V     u       e       l       a       A      b       u       e       l       a
const KERN = [0, -0.032, 0.002, -0.004, 0.004, -0.006, -0.03, -0.004, 0.002, -0.004, 0.004]

function KernedWordmark({ size }: { size: string }) {
  return (
    <span aria-label={WORDMARK} role="img"
      style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size, lineHeight: 0.95,
        fontKerning: 'none', whiteSpace: 'nowrap' }}>
      {WORDMARK.split('').map((ch, i) => (
        <span key={i} aria-hidden style={{ marginLeft: i === 0 ? 0 : `${BASE_TRACK + KERN[i]}em`,
          color: i < WHITE_UNTIL ? T.bg : T.yellow }}>
          {ch}
        </span>
      ))}
    </span>
  )
}

interface Comet {
  d: string // a cubic-bezier path that enters and exits off-canvas (loop reset hidden)
  color: string
  r: number
  dur: string
  begin: string
}

// viewBox 0 0 1200 800; paths start/end beyond the edges so the loop reset is off-screen.
const COMETS: Comet[] = [
  { d: 'M -140 240 C 320 -60, 760 700, 1340 360', color: T.yellow, r: 5, dur: '9s', begin: '0s' },
  { d: 'M 1340 140 C 820 460, 360 -120, -160 520', color: T.green100, r: 4, dur: '11s', begin: '-3s' },
  { d: 'M -160 620 C 280 380, 820 880, 1340 200', color: T.blue500, r: 4.5, dur: '13s', begin: '-6s' },
  { d: 'M 600 -160 C 200 320, 1000 480, 640 980', color: T.amberMid, r: 3.5, dur: '15s', begin: '-9s' },
]

function CometField() {
  return (
    <svg
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {COMETS.map((c, i) => (
        <g key={i}>
          {/* faint bezier trail — makes the flight path itself part of the visual */}
          <path d={c.d} fill="none" stroke={c.color} strokeOpacity={0.1} strokeWidth={1.5} strokeLinecap="round" />
          <circle className="va-comet" r={c.r} fill={c.color} style={{ filter: `drop-shadow(0 0 8px ${c.color})` }}>
            <animateMotion
              dur={c.dur}
              begin={c.begin}
              repeatCount="indefinite"
              path={c.d}
              calcMode="spline"
              keyPoints="0;1"
              keyTimes="0;1"
              keySplines="0.42 0 0.58 1"
            />
          </circle>
        </g>
      ))}
    </svg>
  )
}

export function LandingScreen({ onBegin }: { onBegin: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const markRef = useRef<HTMLDivElement>(null)

  // The comets "charge" the wordmark: each frame, find the strongest nearby
  // comet and drive the wordmark's scale + yellow glow from it. Influence peaks
  // when a comet is horizontally over/under the word AND vertically close, so a
  // pass directly underneath gives the biggest surge; it eases back as it leaves.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const RADIUS = 360 // px reach of a comet's influence
    let raf = 0
    let scale = 1
    let glow = 0
    const tick = () => {
      const mark = markRef.current
      const root = rootRef.current
      if (mark && root) {
        const mr = mark.getBoundingClientRect()
        const cx = mr.left + mr.width / 2
        const cy = mr.top + mr.height / 2
        let influence = 0
        root.querySelectorAll('.va-comet').forEach((el) => {
          const r = (el as Element).getBoundingClientRect()
          const dx = r.left + r.width / 2 - cx
          const dy = r.top + r.height / 2 - cy
          const radial = Math.max(0, 1 - Math.hypot(dx, dy) / RADIUS)
          const horiz = Math.max(0, 1 - Math.abs(dx) / (mr.width * 0.6)) // aligned under/over the word
          const vert = Math.max(0, 1 - Math.abs(dy) / RADIUS)
          influence = Math.max(influence, radial * 0.5, horiz * vert) // "underneath" charges most
        })
        const targetScale = 1 + influence * 0.085
        scale += (targetScale - scale) * 0.12 // smooth charge / discharge
        glow += (influence - glow) * 0.12
        mark.style.transform = `scale(${scale.toFixed(4)})`
        mark.style.filter = glow > 0.01
          ? `drop-shadow(0 0 ${(glow * 26).toFixed(1)}px rgba(255,221,0,${(glow * 0.55).toFixed(3)}))`
          : 'none'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={rootRef} style={{ position: 'relative', minHeight: '100vh', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      <CometField />

      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: 24 }}>
        {/* curved fly-in: outer animates X (glide), inner animates Y (spring) */}
        <div style={{ animation: 'va-flyX 1.1s var(--ease-glide) both', ['--fx' as string]: '-7vw' }}>
          <div style={{ animation: 'va-flyY 1.1s var(--ease-spring) both', ['--fy' as string]: '34vh' }}>
            <div ref={markRef} style={{ display: 'inline-block', willChange: 'transform, filter', transformOrigin: 'center' }}>
              <KernedWordmark size="clamp(48px, 11vw, 124px)" />
            </div>
          </div>
        </div>

        <p style={{ animation: 'va-fadeUp .7s var(--ease-glide) both', animationDelay: '0.95s',
          margin: '20px 0 0', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600,
          letterSpacing: '.32em', textTransform: 'uppercase', color: T.onDarkMuted }}>
          Inventa · Baraja · Despega
        </p>

        <p style={{ animation: 'va-fadeUp .7s var(--ease-glide) both', animationDelay: '1.1s',
          margin: '14px auto 0', maxWidth: 460, fontSize: 16, color: T.onDarkSoft }}>
          Un Mad Lib comunal para tu clase de idiomas. Cada respuesta vuela hacia un desconocido por inventar.
        </p>

        <div style={{ animation: 'va-fadeUp .7s var(--ease-spring) both', animationDelay: '1.35s', marginTop: 30 }}>
          <Button onClick={onBegin} style={{ fontSize: 17, padding: '15px 34px' }}>
            Comenzar →
          </Button>
        </div>
      </div>
    </div>
  )
}
