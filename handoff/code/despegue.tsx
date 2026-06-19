/* ============================================================================
   VuelaAbuela — "Despegue" component kit  (drop into src/components/despegue.tsx)
   ----------------------------------------------------------------------------
   Reusable, framework-agnostic React + TS building blocks for the redesign.
   They use INLINE STYLES that read the CSS variables defined in theme.css, so
   they are a 1:1 port of the prototype and easy to copy into a new screen.

   Why inline styles (not Tailwind classes) here?
   - These pieces are the visual "source of truth"; inline keeps every value
     visible and editable in one place, exactly as the prototype renders.
   - You can absolutely re-express them as Tailwind utilities later — every
     literal maps to a token in theme.css (e.g. #03361E === var(--color-canvas)).

   Conventions
   - Colors come from theme.css via var(--…). The `T` object below mirrors the
     hexes for places JS needs a raw value (SVG stroke, computed offsets).
   - Light text lives ON the dark canvas; dark text lives ON .va-surface cards.
   - Motion: --ease-glide for travel, --ease-spring for taps/pops. Keyframes are
     in theme.css (prefixed `va-`).
   ============================================================================ */
import {
  useEffect, useRef, useState,
  type CSSProperties, type ReactNode, type ButtonHTMLAttributes,
} from 'react'

/* Raw token mirror — only for JS that needs a value (SVG, math). UI should
   prefer var(--…) so a token change in theme.css propagates everywhere. */
export const T = {
  canvas: '#03361E',
  green500: '#086B3C', green700: '#054F2C', green900: '#03361E',
  green50: '#E8F1EB', green100: '#C5DDCE',
  yellow: '#FFDD00', amberMid: '#E0A800', amberText: '#946C00', amberHint: '#8A5400',
  ink: '#1B2620', muted: '#5C6B61', border: '#DDE3DA',
  bg: '#FAFBF8', onDarkMuted: '#9CC3AC', onDarkSoft: '#C5DDCE',
  success: '#2E8B57', successText: '#21724A', errorText: '#B83333',
  ease: { glide: 'cubic-bezier(0.22,1,0.36,1)', spring: 'cubic-bezier(0.34,1.45,0.5,1)' },
} as const

const display: CSSProperties = { fontFamily: 'var(--font-display)' }

/* ----------------------------------------------------------------------------
   GlowField — the three ambient drifting glows behind the canvas.
   Render ONCE near the top of your app shell, inside a position:relative parent
   with overflow:hidden. Purely decorative (pointer-events:none).
   Reproduce/extend: add more <div>s with a radial-gradient bg + va-drift/va-driftB
   on long, offset durations. Keep them low-opacity so cards stay legible.
   ---------------------------------------------------------------------------- */
export function GlowField() {
  const base: CSSProperties = { position: 'fixed', borderRadius: '50%', pointerEvents: 'none' }
  return (
    <>
      <div style={{ ...base, top: -160, left: -120, width: 520, height: 520,
        background: 'radial-gradient(circle at 40% 40%, rgba(8,107,60,.5) 0%, rgba(8,107,60,0) 68%)',
        animation: 'va-drift 20s var(--ease-glide) infinite' }} />
      <div style={{ ...base, bottom: -200, right: -140, width: 560, height: 560,
        background: 'radial-gradient(circle at 50% 50%, rgba(224,168,0,.22) 0%, rgba(224,168,0,0) 66%)',
        animation: 'va-driftB 26s var(--ease-glide) infinite' }} />
      <div style={{ ...base, top: '40%', left: '55%', width: 380, height: 380,
        background: 'radial-gradient(circle at 50% 50%, rgba(8,107,60,.28) 0%, rgba(8,107,60,0) 70%)',
        animation: 'va-driftB 32s var(--ease-glide) infinite' }} />
    </>
  )
}

/* ----------------------------------------------------------------------------
   Switcher — the segmented control with a spring-sliding yellow indicator.
   Generic over a tab id union. The indicator position is index * TAB_W.
   ---------------------------------------------------------------------------- */
const TAB_W = 134
export function Switcher<Id extends string>({
  tabs, value, onChange,
}: { tabs: { id: Id; label: string }[]; value: Id; onChange: (id: Id) => void }) {
  const idx = Math.max(0, tabs.findIndex(t => t.id === value))
  return (
    <div role="tablist" style={{ position: 'relative', display: 'flex',
      background: 'rgba(250,251,248,.06)', border: '1px solid rgba(255,255,255,.1)',
      borderRadius: 999, padding: 5 }}>
      <div aria-hidden style={{ position: 'absolute', top: 5, left: 5, width: TAB_W,
        height: 'calc(100% - 10px)', borderRadius: 999, background: 'var(--color-yellow-500)',
        transform: `translateX(${idx * TAB_W}px)`, transition: 'transform .55s var(--ease-spring)',
        boxShadow: '0 6px 18px -6px rgba(255,221,0,.6)' }} />
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={t.id === value} onClick={() => onChange(t.id)}
          style={{ position: 'relative', width: TAB_W, border: 'none', background: 'transparent',
            cursor: 'pointer', padding: '11px 0', borderRadius: 999, fontFamily: 'var(--font-sans)',
            fontWeight: 600, fontSize: 13.5,
            color: t.id === value ? 'var(--color-canvas)' : 'var(--color-on-dark-muted)',
            transition: 'color .4s var(--ease-glide)' }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------------------------
   ProgressArc — the circular "x / total ready" gauge (yellow on translucent ring).
   r=40 → circumference ≈ 251. offset = 251 * (1 - value/total).
   ---------------------------------------------------------------------------- */
export function ProgressArc({ value, total, label = 'listas', size = 96 }:
  { value: number; total: number; label?: string; size?: number }) {
  const C = 251
  const offset = Math.round(C * (1 - value / total))
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="7" />
        <circle cx="48" cy="48" r="40" fill="none" stroke={T.yellow} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .8s var(--ease-glide)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ ...display, fontWeight: 600, fontSize: 21, color: 'var(--color-neutral-bg)', lineHeight: 1 }}>
          {value}<span style={{ fontSize: 13, color: 'var(--color-on-dark-muted)' }}>/{total}</span>
        </span>
        <span style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'var(--color-on-dark-muted)', marginTop: 3 }}>{label}</span>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------------
   Surface — the rich green-gray card. Put SurfaceInset values/inputs inside it.
   ---------------------------------------------------------------------------- */
export function Surface({ children, style, hoverLift = false }:
  { children: ReactNode; style?: CSSProperties; hoverLift?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => hoverLift && setHover(true)}
      onMouseLeave={() => hoverLift && setHover(false)}
      style={{ padding: 18,
        background: 'linear-gradient(157deg,#F4F7F2 0%,#E9EFE9 100%)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.7), 0 16px 40px -22px rgba(0,0,0,.6)',
        transform: hover ? 'translateY(-3px)' : 'none',
        transition: 'transform .45s var(--ease-spring)', ...style }}>
      {children}
    </div>
  )
}

/* White inset box that sits on a Surface (the value/answer/input container). */
export function SurfaceInset({ children, tone = 'neutral', style }:
  { children: ReactNode; tone?: 'neutral' | 'ok' | 'active' | 'warn'; style?: CSSProperties }) {
  const border = { neutral: T.border, ok: T.green100, active: T.green500, warn: T.amberMid }[tone]
  const extra: CSSProperties = tone === 'active' ? { boxShadow: '0 0 0 4px rgba(8,107,60,.1)' } : {}
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${border}`, borderRadius: 'var(--radius-box)',
      padding: '11px 14px', fontSize: 15, color: T.green700, ...extra, ...style }}>
      {children}
    </div>
  )
}

/* ----------------------------------------------------------------------------
   Buttons. Primary = dark text on yellow (passes 11.6:1). Solid = white on green.
   Ghost = light on translucent (for use on the dark canvas).
   ---------------------------------------------------------------------------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'solid' | 'ghost' }
export function Button({ variant = 'primary', style, children, ...rest }: BtnProps) {
  const variants: Record<string, CSSProperties> = {
    primary: { color: T.canvas, background: 'var(--color-yellow-500)',
      boxShadow: '0 10px 24px -10px rgba(255,221,0,.6)' },
    solid:   { color: '#fff', background: 'var(--color-green-500)' },
    ghost:   { color: 'var(--color-neutral-bg)', background: 'rgba(255,255,255,.07)',
      border: '1px solid rgba(255,255,255,.16)' },
  }
  return (
    <button {...rest} style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14.5,
      border: 'none', borderRadius: 11, padding: '12px 22px', minHeight: 44, cursor: 'pointer',
      transition: 'filter .25s var(--ease-glide), transform .3s var(--ease-spring)',
      ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

/* Pill — small status/label chip. `dark` variants are for the canvas. */
export function Pill({ children, tone = 'neutral' }:
  { children: ReactNode; tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'info' | 'onDark' }) {
  const tones: Record<string, CSSProperties> = {
    neutral: { color: T.successText, background: T.green50 },
    brand:   { color: T.canvas, background: 'var(--color-yellow-500)' },
    ok:      { color: T.successText, background: T.green50 },
    warn:    { color: T.amberHint, background: 'var(--color-yellow-soft)' },
    info:    { color: T.green700 + '', background: T.blue50 ?? '#E6F0F8' },
    onDark:  { color: T.onDarkSoft, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)' },
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
      borderRadius: 999, padding: '4px 11px', whiteSpace: 'nowrap', ...tones[tone] }}>
      {children}
    </span>
  )
}

/* PhaseDot — a labeled status dot for the teacher roster. */
const PHASE: Record<string, { color: string; label: string; pulse?: boolean }> = {
  joined:     { color: T.onDarkMuted, label: 'Unido' },
  filling:    { color: T.amberMid,    label: 'Rellenando' },
  validating: { color: T.amberMid,    label: 'Validando', pulse: true },
  passed:     { color: T.success,     label: 'Listo' },
  conversing: { color: T.success,     label: 'Conversando' },
  submitted:  { color: T.green700,    label: 'Enviado' },
  out:        { color: '#9AA69D',     label: 'Fuera de la ronda' },
}
export function PhaseDot({ phase }: { phase: keyof typeof PHASE }) {
  const m = PHASE[phase] ?? PHASE.joined
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color,
        animation: m.pulse ? 'va-pulseDot 1.6s var(--ease-glide) infinite' : undefined }} />
      <span style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>{m.label}</span>
    </span>
  )
}

/* ----------------------------------------------------------------------------
   HandoffShuffle — the signature set-piece. Answer chips fly in along spring
   paths (va-shuffleIn, per-chip --sx/--sy/--sr offsets) and assemble into new
   persona cards (va-cardPop), while pairing pills fade up (va-riseSoft).
   `playKey` forces a remount → the whole sequence replays. Bump it (e.g. a
   counter in state, or Date.now()) whenever the teacher triggers redistribution.

   Extend: feed real personas. Each card is a group; each chip is one slot value.
   Stagger via animationDelay; keep total under ~1s so it feels snappy.
   ---------------------------------------------------------------------------- */
export interface NewPersona { dotColor: string; title: string; chips: string[] }
const DOT = [T.green500, T.amberMid, '#2D7DC4']
// deterministic-ish scatter offsets so replays look organic but stable
const OFF = [
  { sx: -160, sy: -120, sr: -16 }, { sx: 200, sy: -90, sr: 12 }, { sx: -120, sy: 160, sr: 18 },
  { sx: 150, sy: 130, sr: -10 }, { sx: -200, sy: 30, sr: 8 },
]
export function HandoffShuffle({
  personas, pairings, playKey = 0,
}: { personas: NewPersona[]; pairings: string[]; playKey?: number }) {
  return (
    <div key={playKey}>
      {/* new pairings */}
      <div style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
        {pairings.map((p, i) => (
          <span key={p} style={{ animation: 'va-riseSoft .6s var(--ease-glide) both',
            animationDelay: `${1.2 + i * 0.15}s`, fontSize: 13, fontWeight: 600,
            color: 'var(--color-neutral-bg)', background: 'rgba(255,255,255,.08)',
            border: '1px solid rgba(255,255,255,.14)', borderRadius: 999, padding: '7px 14px',
            whiteSpace: 'nowrap' }}>{p}</span>
        ))}
      </div>
      {/* new persona cards */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {personas.map((persona, ci) => (
          <div key={persona.title} style={{ animation: 'va-cardPop .7s var(--ease-spring) both',
            animationDelay: `${0.05 + ci * 0.13}s`, padding: 18,
            background: 'linear-gradient(157deg,#F4F7F2 0%,#E9EFE9 100%)', borderRadius: 'var(--radius-card)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.7), 0 18px 44px -24px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: persona.dotColor }} />
              <span style={{ ...display, fontWeight: 600, fontSize: 14, color: T.ink }}>{persona.title}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {persona.chips.map((chip, i) => {
                const o = OFF[i % OFF.length]
                return (
                  <span key={chip} style={{
                    // CSS custom props consumed by the va-shuffleIn keyframe:
                    ['--sx' as string]: `${o.sx}px`, ['--sy' as string]: `${o.sy}px`, ['--sr' as string]: `${o.sr}deg`,
                    animation: 'va-shuffleIn .85s var(--ease-spring) both',
                    animationDelay: `${0.15 + ci * 0.07 + i * 0.13}s`,
                    background: '#fff', border: `1px solid ${T.border}`, borderRadius: 9,
                    padding: '7px 11px', fontWeight: 600, fontSize: 13.5, color: T.green700,
                  } as CSSProperties}>{chip}</span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
export const SAMPLE_DOTS = DOT // exported in case callers want matching dot colors

/* ----------------------------------------------------------------------------
   useReplay — tiny helper to drive replayable mount animations.
   const [key, replay] = useReplay(); … <HandoffShuffle playKey={key} /> …
   <Button onClick={replay}>Repetir</Button>
   ---------------------------------------------------------------------------- */
export function useReplay(): [number, () => void] {
  const [key, setKey] = useState(0)
  return [key, () => setKey(k => k + 1)]
}

/* ----------------------------------------------------------------------------
   Screen — wrapper that applies the transform-only enter animation. Give it a
   `key` that changes per route so it re-runs on navigation.
   ---------------------------------------------------------------------------- */
export function Screen({ children, maxWidth = 660, style }:
  { children: ReactNode; maxWidth?: number; style?: CSSProperties }) {
  return (
    <div className="va-screen" style={{ maxWidth, margin: '0 auto', ...style }}>{children}</div>
  )
}

/* Convenience: the full canvas shell (glows + relative/overflow container). */
export function CanvasShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--color-canvas)', overflow: 'hidden' }}>
      <GlowField />
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}
