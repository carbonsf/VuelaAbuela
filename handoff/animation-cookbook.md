# Despegue — Animation Cookbook

Every motion in the redesign, what it's for, and how to reproduce or extend it.
All keyframes are defined in `code/theme.css` (prefixed `va-`) and consumed by the
components in `code/despegue.tsx`. Two easing tokens do all the work:

- `--ease-glide` `cubic-bezier(.22,1,.36,1)` — smooth deceleration (travel/settle).
- `--ease-spring` `cubic-bezier(.34,1.45,.5,1)` — slight overshoot (taps/pops).

Philosophy: **flow, not cuts.** Screens and elements arrive on a curve; nothing
hard-swaps. The ambient layer keeps a gentle sense of flight at all times.

---

## The golden rule (read this before changing anything)

> **Never gate a screen's visibility behind an opacity fade.**

If an always-running animation starts at `opacity:0` and the animation timeline
is ever throttled (background tab, some screenshot/render pipelines, low-power
mode), the element can freeze at frame 0 — invisible. That's why:

- **`va-screenIn`** (the per-screen enter) animates **transform only**. Worst
  case it's offset 20px but always visible.
- Decorative reveals that *do* fade (`va-shuffleIn`, `va-cardPop`, `va-riseSoft`)
  are only ever used on **non-critical** elements (chips, pairing pills) whose
  parent screen is already visible, and they fill `both` so they end opaque.

When in doubt: critical content = transform-only; sugar = may fade.

---

## 1. Ambient — the canvas "flight"

**`va-drift` / `va-driftB`** — three radial-gradient glows drift on long, offset
loops (20s / 26s / 32s) so the dark canvas never feels static. Component:
`<GlowField/>` (render once inside the relative/overflow shell).

```
<div style="position:relative; min-height:100vh; overflow:hidden; background:var(--color-canvas)">
  <GlowField/>            // the three drifting glows
  …your screen…
</div>
```

*Extend:* add more glows with low-opacity radial gradients; vary size, position,
and loop duration (keep them prime-ish so they don't visually sync). Keep total
opacity low — cards must stay legible.

---

## 2. Navigation — screen enter

**`va-screenIn`** (transform: `translateY(20px) scale(.992)` → none, `.55s glide`).
Apply via `<Screen>` / `.va-screen`. Give the wrapper a **`key` that changes per
route** so React remounts it and the animation re-runs on every navigation.

```tsx
<Screen key={activeTab} maxWidth={620}> … </Screen>
```

---

## 3. The switcher indicator

A yellow pill slides under the active tab with `transform: translateX(index * 134px)`
and `transition: transform .55s var(--ease-spring)` (note the spring → it
overshoots a hair and settles). Component: `<Switcher>`. The `134px` is the tab
width — if you change tab width, change both the button width and the multiplier.

---

## 4. Micro-interactions

| Effect | How | Where |
|---|---|---|
| Button tap | `transform:translateY(-1/-2px)` + `filter:brightness(1.05)` on hover, `.3s spring` | `<Button>` |
| Card hover-lift | `transform:translateY(-3px)`, `.45s spring` | `<Surface hoverLift>` |
| "Validando" pulse | `va-pulseDot 1.6s glide infinite` on a status dot | `<PhaseDot phase="validating">` |
| Live-validation dot | same `va-pulseDot` on the green dot in the "validación en vivo" pill | Input header |
| Progress arc fill | animate `stroke-dashoffset` with `.8s glide` when the ready count changes | `<ProgressArc>` |
| "Revisar → passed" | swap the active inset for the passed inset; the new card enters with `va-rise .5s spring` | Input prompt row |

**Arc math:** `r=40` → circumference `≈251`; `strokeDashoffset = 251 * (1 - value/total)`.
Because it's a CSS transition on `stroke-dashoffset`, the arc *sweeps* whenever
`value` updates — no keyframe needed.

---

## 5. The hero set-piece — Handoff shuffle (`<HandoffShuffle>`)

This is the redistribution moment: answers "fly" to new owners and reassemble
into new personas with new pairings. Three layered animations, staggered:

1. **Pairing pills** fade up — `va-riseSoft .6s glide`, delays `1.2s, 1.35s, 1.5s`
   (they land *after* the cards, confirming the result).
2. **Persona cards** pop in — `va-cardPop .7s spring`, delays `.05s, .18s, .31s`.
3. **Word chips** fly in from scattered offsets — `va-shuffleIn .85s spring`,
   delays staggered per card+chip (`~.15s → ~.85s`).

The chips' scatter is driven by **inline CSS custom properties** the keyframe
reads:

```tsx
<span style={{ '--sx':'-160px', '--sy':'-120px', '--sr':'-16deg',
               animation:'va-shuffleIn .85s var(--ease-spring) both' }}>la playa</span>
```
```css
@keyframes va-shuffleIn {
  0%   { opacity:0; transform: translate(var(--sx), var(--sy)) rotate(var(--sr)) scale(.65); }
  55%  { opacity:1; }
  100% { opacity:1; transform: translate(0,0) rotate(0) scale(1); }
}
```

**Replay:** the component takes a `playKey`; bump it to remount and replay. Use
the `useReplay()` helper:

```tsx
const [key, replay] = useReplay()
…
<HandoffShuffle personas={newPersonas} pairings={pairs} playKey={key} />
<Button variant="ghost" onClick={replay}>↻ Repetir</Button>
<Button onClick={goToConversation}>Ir a la conversación →</Button>
```

*Extend with real data:* map your post-redistribution state into
`NewPersona[] = { dotColor, title, chips }` and the new `pairings: string[]`.
Keep the **total sequence under ~1s of perceived motion** (stagger, not delay) so
it reads as snappy redistribution, not a loading screen. For large classes, cap
visible chips per card (e.g. 5) and let the rest settle without animation.

---

## 6. Reduced motion

`code/theme.css` ends with a `prefers-reduced-motion: reduce` block that sets all
animation/transition durations to ~0. Every animation resolves to its **end**
state, so reduced-motion users see the final layout instantly — including the
handoff result (chips appear placed, no flight). Nothing depends on motion to
become visible. Don't add motion that conveys information without a static
equivalent.
