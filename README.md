# VuelaAbuela 👵✈️

Classroom web app for teaching a foreign language through paired, redistributed
conversation. Communal Mad Lib: every student contributes inputs, inputs are
shuffled into "personas," paired students interview each other about the persona
they hold. Spanish first; **language is a parameter**.

This repo is the **polished single-screen prototype** from the build spec: right
look/feel, all core logic genuinely working, multi-user faked via **god-mode**.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run typecheck
```

## God-mode (the dev harness)

The dark bar at the top is **god-mode** — an isolated harness (single flag
`GOD_MODE` in `src/godmode/godmode.ts`, removable in one place). It fakes
multi-device by letting one operator switch between every student screen and the
teacher dashboard against one shared in-memory transport.

Quick tour:
1. **spawn 5** → five students self-join.
2. **auto-fill & pass all** → fills every student's inputs from the sample
   examples and passes validation (fast-forward).
3. Switch to **🧑‍🏫 Teacher** → **Open prompts** → **Redistribute & pair**
   (odd counts show the absorb / force-trio resolver).
4. Switch to a student → press-and-hold the emoji to launch ("Despegar") →
   conversation → **Submit to teacher**.
5. Teacher → **End & review** → side-by-side persona vs. recorded answers.

## Validation (REAL)

A single bundled call per submission checks appropriateness (weighted first),
fit, and grammar, returning `pass | block | reenter | correct`. Grammar uses
**point-then-reveal**: point at the error first, reveal the corrected form only
after a failed retry — the student always retypes.

- **In a Claude artifact**, it calls `window.claude.complete` live
  (`claude-sonnet-4-6`, `max_tokens: 1000`, no API key passed) — see
  `src/validation/validator.ts`.
- **In plain local dev** (no artifact runtime) a labeled heuristic fallback runs
  so god-mode stays demoable. The seam is identical either way; the UI shows
  which mode is active.

## Architecture & seams

Everything is one state machine over a shared `LessonConfig` with a swappable
`Transport`. Each stub is a labeled seam, not a missing feature.

| Seam | REAL impl | STUB / future | Where |
|---|---|---|---|
| `Transport` | `GodModeTransport` (in-memory pub/sub) | Supabase Realtime | `src/transport/` |
| `QuestionSource` | `GlobalQuestionSource` | AI-derived questions | `src/seams.ts` |
| `PersonaTransform` | `IdentityPersonaTransform` | story-parse | `src/seams.ts` |
| `PairingStrategy` | `FixedPairsStrategy` (size 2) | rotation / trios | `src/seams.ts` |
| `Exporter` | on-screen review | CSV / gradebook | `src/seams.ts` |
| `Group` | size 2 + interviewGraph | size 3 + `partnerTag` | `src/types.ts` |
| Identity | self-join | SSO / Google Classroom | `src/seams.ts` |
| Lesson authoring | read-only sample | editing UI | `src/teacher/AuthoringView.tsx` |
| Holding game | ready-counter (real) | YDKJ-style game | `src/screens/HoldingScreen.tsx` |
| Mobile | responsive shell | designed layout | — |

Swapping `GodModeTransport` for a `SupabaseTransport` in `src/RoomContext.tsx`
touches no components.

## State machine

`LOBBY → INPUT → READY_GATE → HANDOFF → ACTIVATION → CONVERSATION → SUBMITTED → REVIEW`

## Theming — "Despegue"

The art identity is the **Despegue** direction: deep forest-green canvas
(`#03361E`), crisp geometric type (Space Grotesk + Hanken Grotesk), soft
green-gray "surface" cards with pure-white inset boxes, golden-yellow accent
(`#FFDD00`, never as text), and abstract flight motion (drift / glide / spring —
no literal icons; the old 👵✈️ brandmark is retired for a text wordmark).

- Design tokens (color, type, radius, motion) live in `src/index.css` under
  `@theme`; all components read them.
- The reusable visual kit is `src/components/despegue.tsx` — `CanvasShell`,
  `Surface`/`SurfaceInset`, `Button`, `Pill`, `PhaseDot`, `ProgressArc`,
  `HandoffShuffle`, `Wordmark`, plus motion helpers. It's the visual source of
  truth; screens compose from it.
- The redistribution moment has its own screen, **Reparto**
  (`src/screens/RepartoScreen.tsx`), the `HANDOFF` activity state — answers fly
  in and reassemble into new personas with new pairings.
- Full design docs, the clickable prototype, and reference screenshots are in
  `handoff/` (start with `handoff/README.md`).

Nothing in the redesign touches the state machine, transport, or validation —
it's purely the theming layer (§12).
