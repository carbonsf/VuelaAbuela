# Despegue — Per-Screen Build Recipes

How each redesigned screen maps onto your existing source, using the kit in
`code/despegue.tsx`. The redesign is **theming only** — keep all logic, state,
transport, and validation exactly as they are; swap the presentation.

Import once per screen:
```tsx
import {
  CanvasShell, Screen, Switcher, ProgressArc, Surface, SurfaceInset,
  Button, Pill, PhaseDot, HandoffShuffle, useReplay, T,
} from '../components/despegue'
```

---

## App shell + the wordmark (App.tsx)

Wrap the routed area in the dark canvas and render the top bar once. **Retire the
emoji `<BrandMark>`** — Despegue is icon-free.

```tsx
// Wordmark (replaces BrandMark 👵✈️)
function Wordmark() {
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20,
      letterSpacing: '-.01em', color: 'var(--color-neutral-bg)' }}>
      Vuela<span style={{ color: 'var(--color-yellow-500)' }}>Abuela</span>
    </span>
  )
}

// Top bar: Wordmark + school slot (white-label) · Switcher · room code
<CanvasShell>
  <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
    gap:18, padding:'20px 30px', maxWidth:1080, margin:'0 auto' }}>
    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
      <Wordmark/>
      <Pill tone="onDark">{schoolName /* white-label slot */}</Pill>
    </div>
    <Switcher tabs={[
      { id:'input',   label:'Construir' },
      { id:'conv',    label:'Conversar' },
      { id:'reparto', label:'Reparto'  },
      { id:'teacher', label:'Tablero'  },
    ]} value={tab} onChange={setTab}/>
    <span style={{ fontFamily:'var(--font-display)', fontSize:11, letterSpacing:'.16em',
      textTransform:'uppercase', color:T.onDarkMuted }}>Sala <span style={{color:T.bg}}>{room}</span></span>
  </header>
  <main style={{ padding:'8px 30px 64px' }}>{routedScreen}</main>
</CanvasShell>
```

> **The switcher is the prototype's demo harness.** In production your real
> god-mode bar / router decides which device is shown — keep your existing
> routing and just restyle it. The `<Switcher>` is provided so you can reproduce
> the prototype's device-flip feel if useful.

> **School white-label slot:** the `<Pill tone="onDark">{schoolName}</Pill>` is
> the hook for per-school branding. Later: drive `schoolName` (and optionally a
> logo + an accent override) from lesson/room config.

---

## 1. Construir — `src/screens/InputScreen.tsx`

The "build your secret person" screen. Structure top→bottom:

1. **Hero row:** stacked H1 (`Construye / tu persona / secreta`, last word yellow)
   + `<ProgressArc value={passedCount} total={phase1.length}/>` on the right.
2. **Intro line** + meta pills (`<Pill tone="brand">el presente</Pill>`,
   `<Pill tone="onDark">3.ª persona</Pill>`, live-validation pill with a pulsing dot).
3. **Name card** (dark translucent — it's the locked, from-join value):
   `background:rgba(250,251,248,.06); border:1px solid rgba(255,255,255,.12)`.
4. **Prompt rows** — one `<Surface>` each, containing a `<SurfaceInset>` for the
   answer + a `<Button>` to check. Map your `RowFeedback` states to inset tone:

| Your feedback kind | Inset tone | Button | Note shown |
|---|---|---|---|
| `pass` | `ok` (green border) + check disc | hidden / "Recheck" | — |
| `idle` (active) | `active` (green ring) | `solid` "Revisar ✓" | — |
| `correct` (grammar) | `warn` (amber border) | `primary` "Revisar" | amber-hint line: "Casi— …" |
| `block` / `reenter` | `warn`/error border | `primary` | error-text line |

Example passed row:
```tsx
<Surface hoverLift style={{ marginTop: 13 }}>
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
    <div style={{ fontWeight:600, fontSize:15, color:T.ink }}>{prompt.labelL1}</div>
    <span style={{ width:20, height:20, borderRadius:'50%', background:T.green500, color:'#fff',
      display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>✓</span>
  </div>
  <SurfaceInset tone="ok" style={{ marginTop:10, fontWeight:500 }}>{cell.value}</SurfaceInset>
</Surface>
```

*Live validation:* keep your `validateInput()` call untouched; on `pass`, animate
the row's new passed-inset in with `va-rise` (see cookbook §4) and let the
`<ProgressArc>` re-fill as `passedCount` updates.

---

## 2. Conversar — `src/screens/ConversationScreen.tsx`

Two `<Surface>` cards stacked (they were `lg:grid-cols-2`; stacked reads better
at the 660px device width — your call):

- **"Tu persona — descríbela"** — the persona this student conveys. Render each
  slot as a row: muted uppercase label (left) + a **white inset chip** (right):
  ```tsx
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:16 }}>
    <span style={{ fontSize:11, fontWeight:700, letterSpacing:'.08em',
      textTransform:'uppercase', color:T.muted }}>{line.label}</span>
    <span className="va-inset" style={{ padding:'6px 11px', fontWeight:600, color:T.green700 }}>{line.value}</span>
  </div>
  ```
- **"Entrevista a {partner}"** — your questions list. Each: `<label>` + a
  `<SurfaceInset>` that becomes a real `<input>` bound to your `answers` state
  (tone `ok` once filled, `active` when focused, `neutral` when empty). Footer:
  "respuestas sin validar" + `<Button>Enviar al profesor →</Button>` wired to
  `transport.submitAnswers(...)`.

Keep the `2/4` progress `<Pill tone="warn">` driven by `answeredCount`.

---

## 3. Reparto — NEW screen for the `HANDOFF` activity state

Today `App.tsx` renders the `HANDOFF` state as a centered emoji (`🔀✈️`). Replace
that with the shuffle set-piece. This is teacher-triggered (after
`runHandoff(...)` in `TeacherDashboard.tsx`) and lands students into Activation/
Conversation.

```tsx
function Reparto({ personas, pairings, onContinue }) {
  const [key, replay] = useReplay()
  return (
    <Screen key="reparto" maxWidth={1020}>
      <div style={{ marginTop:18, textAlign:'center' }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:40,
          letterSpacing:'-.03em', color:T.bg, margin:0 }}>
          Barajando las <span style={{ color:T.yellow }}>respuestas</span>
        </h1>
        <p style={{ color:T.onDarkMuted, maxWidth:520, margin:'12px auto 0' }}>
          Cada respuesta vuela hacia una persona nueva. Parejas nuevas para entrevistar.
        </p>
      </div>
      <HandoffShuffle personas={personas} pairings={pairings} playKey={key}/>
      <div style={{ display:'flex', justifyContent:'center', gap:12, marginTop:26 }}>
        <Button variant="ghost" onClick={replay}>↻ Repetir</Button>
        <Button onClick={onContinue}>Ir a la conversación →</Button>
      </div>
    </Screen>
  )
}
```

Map your post-redistribution state → `personas: NewPersona[]` (`{dotColor, title,
chips}`) and `pairings: string[]` (`"Marisol ↔ Diego"`). See cookbook §5 to feed
real data and to cap chips per card for large classes.

---

## 4. Tablero — `src/teacher/TeacherDashboard.tsx`

The live monitor. Mostly cards, so it's the fastest win.

- **Header:** "Monitor en vivo" H1 + status pills (`<Pill tone="brand">Fase:
  entrada</Pill>`, `<Pill tone="onDark">6 unidos</Pill>`).
- **Activity control** — a dark translucent bar (same as the name card) with the
  phase summary + a `<Button>` primary CTA ("Redistribuir y emparejar →"). Keep
  your real enable/disable logic (`allReady`); the prototype enables it for demo.
- **Roster grid** — `repeat(3,1fr)`, each student a `<Surface>` with name
  (Space Grotesk), `<PhaseDot phase={student.phase}/>`, and a right-aligned
  `<Pill>` (`ok` ready / `warn` filling / red "atascada"). The **stuck signal**
  (`isStuck`) adds `boxShadow:'0 0 0 2px rgba(214,69,69,.5)'` to the Surface and a
  red detail line. Marked-out students get `opacity:.5`.

```tsx
<Surface hoverLift style={ stuck ? { boxShadow:'0 0 0 2px rgba(214,69,69,.5), inset 0 1px 0 rgba(255,255,255,.7), 0 14px 36px -22px rgba(0,0,0,.6)' } : undefined }>
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
    <div>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:16, color:T.ink }}>{s.name}</div>
      <div style={{ marginTop:5 }}><PhaseDot phase={s.phase}/></div>
    </div>
    {ready && <Pill tone="ok">lista</Pill>}
    {stuck && <span style={{ fontSize:11, fontWeight:700, color:T.errorText, background:'#FBE8E8', borderRadius:999, padding:'3px 9px' }}>atascada</span>}
  </div>
</Surface>
```

---

## 5. The remaining screens (same kit, not in the prototype)

Restyle with the identical primitives:

- **JoinScreen** — center a single `<Surface>` (or a dark translucent card) on
  the canvas: Wordmark, party-code + name `<SurfaceInset>` inputs, a `primary`
  Button. (Hero "first impression" — give the H1 the stacked/yellow treatment.)
- **HoldingScreen** — `<ProgressArc>` for "x / y listos" on the canvas; the STUB
  game slot becomes a dark translucent panel.
- **ActivationScreen** — the press-and-hold target: a large circle on the canvas;
  on hold, `transform:scale(.95)` + a `va-pulseDot`-style expanding ring (reuse
  the pulse keyframe at larger scale). Abstract, no plane icon.

If you build genuinely new pages, start from `<CanvasShell>` + `<Screen>` and
compose `<Surface>`/`<SurfaceInset>`/`<Button>`/`<Pill>` — that's the whole
vocabulary.
