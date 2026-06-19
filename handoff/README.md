# VuelaAbuela — "Despegue" Visual Redesign · Developer Handoff

This package contains everything needed to bring the **Despegue** direction (deep
forest-green canvas, crisp geometric type, rich green-gray cards, abstract flight
motion) into the real `VuelaAbuela` codebase — and enough context for any
developer to **reproduce, extend, or build new screens** in the same language.

> Despegue = "takeoff." The theme runs on abstract motion (drift, glide, spring)
> — **no literal icons** (the old 👵✈️ brand emoji is retired in favor of a text
> wordmark). The brand palette is the existing color handoff verbatim
> (forest green `#086B3C` + golden yellow `#FFDD00`).

---

## What's in the box

```
handoff/
├── README.md                 ← you are here (start here)
├── design-system.md          ← color, type, spacing, motion tokens + rationale
├── animation-cookbook.md     ← every animation: keyframes, easing, how to reuse/extend
├── screens.md                ← per-screen build recipes mapped to your source files
├── code/
│   ├── theme.css             ← DROP-IN token + keyframe layer for src/index.css
│   ├── index-head.html       ← font <link>s for index.html
│   └── despegue.tsx          ← reusable React+TS component kit (the visual source of truth)
├── prototype/
│   ├── VuelaAbuela-Despegue.dc.html   ← the live, clickable prototype (canonical reference)
│   └── support.js                     ← runtime the prototype needs (keep beside it)
└── screenshots/
    ├── 01-construir.png      ← Input ("build your persona")
    ├── 02-conversar.png      ← Conversation / interview
    ├── 03-reparto.png        ← Handoff shuffle (settled state)
    └── 04-tablero.png        ← Teacher live monitor
```

### The prototype
Open `prototype/VuelaAbuela-Despegue.dc.html` in a browser (keep `support.js`
next to it). It's the four-screen flow with the working switcher, the spring
"Revisar → passed" interaction, and the handoff shuffle animation. **This is the
ground truth** — when a spec and the prototype disagree, the prototype wins.

---

## Install order (≈20 min for the theme layer)

1. **Fonts** — paste the contents of `code/index-head.html` into `<head>` of
   `index.html`.
2. **Tokens + motion** — open `code/theme.css`. Replace the placeholder
   "sky/sunset" `@theme { … }` block currently in `src/index.css` with the
   `@theme` block from `theme.css`, then append everything below it (`.va-surface`,
   base body, `@keyframes va-*`, the reduced-motion query). The token *names*
   match your existing color handoff, so most Tailwind classes that read
   `--color-green-500` etc. keep working; the canvas just goes dark.
3. **Component kit** — copy `code/despegue.tsx` to `src/components/despegue.tsx`.
4. **Reskin screens** — follow `screens.md`. Start with `TeacherDashboard.tsx`
   (highest payoff, mostly cards), then `InputScreen.tsx`, then
   `ConversationScreen.tsx`. Add the new **Handoff** screen for the `HANDOFF`
   activity state.
5. **Retire the emoji brand** — replace `<BrandMark>` (👵✈️) with the text
   wordmark (`Vuela` in `--color-neutral-bg` + `Abuela` in `--color-yellow-500`,
   `--font-display`). See `screens.md`.

Nothing in this package touches your state machine, transport, or validation —
it's **purely the theming layer (§12 in your README)**, exactly where the art
identity was always meant to drop in.

---

## The 60-second mental model

| Layer | What | Token / file |
|---|---|---|
| **Canvas** | The dark world everything floats on | `--color-canvas` (#03361E) + `<GlowField/>` |
| **Surface** | Soft green-gray cards (never flat white) | `.va-surface` / `<Surface/>` |
| **Inset** | Pure-white boxes for values & inputs (the gray↔white contrast) | `.va-inset` / `<SurfaceInset/>` |
| **Accent** | Yellow — buttons, the progress arc, highlight marks. Never as text. | `--color-yellow-500` |
| **Type** | Space Grotesk (display/numerals) + Hanken Grotesk (body) | `--font-display` / `--font-sans` |
| **Motion** | Glide for travel, spring for taps; abstract flight ambient | `--ease-glide` / `--ease-spring` |

Read `design-system.md` next for the full token reference, then
`animation-cookbook.md` for the motion.
