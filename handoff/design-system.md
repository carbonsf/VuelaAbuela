# Despegue — Design System Reference

The complete token set behind the redesign, with the reasoning a developer needs
to make new decisions consistently. All tokens live in `code/theme.css`. Hex
values are the brand color handoff verbatim, extended with two dark-canvas tokens.

---

## 1. Color

### Roles (use these first)

| Where | Token | Value |
|---|---|---|
| Page background (the "canvas") | `--color-canvas` | `#03361E` |
| Light text on canvas | `--color-neutral-bg` | `#FAFBF8` |
| Secondary text on canvas | `--color-on-dark-soft` | `#C5DDCE` |
| Muted labels on canvas | `--color-on-dark-muted` | `#9CC3AC` |
| Card surface | `.va-surface` gradient | `#F4F7F2 → #E9EFE9` |
| Inset box (value/input) | `#fff` + `--color-neutral-border` | `#fff` / `#DDE3DA` |
| Heading / body text on cards | `--color-neutral-text-body` | `#1B2620` |
| Muted text on cards | `--color-neutral-text-muted` | `#5C6B61` |
| Primary action | `--color-yellow-500` (dark text on it) | `#FFDD00` |
| Secondary/structural action | `--color-green-500` (white text on it) | `#086B3C` |
| Pressed/hover of green | `--color-green-700` | `#054F2C` |

### The full scale
Green `50 #E8F1EB · 100 #C5DDCE · 500 #086B3C · 700 #054F2C · 900 #03361E`
Yellow/amber `soft #FFF6CC · 500 #FFDD00 · amber-mid #E0A800 · amber-text #946C00`
Blue `50 #E6F0F8 · 500 #2D7DC4 · 700 #1C5A93`
Status `success #2E8B57/text #21724A · warning #E08A00/#8A5400 · error #D64545/#B83333`

### Three rules that keep it on-brand
1. **60 / 30 / 10.** Canvas + neutrals carry ~60%, green structures ~30%, yellow
   is the ~10% spotlight (the arc, the active tab, one CTA). If yellow is
   everywhere it signals nothing.
2. **Yellow never holds text.** `#FFDD00` on white is ~1.35:1 (invisible). When
   you need readable "yellow," use `--color-amber-text` on white, or **dark text
   on a yellow fill** (11.6:1 — that's why primary buttons are ink-on-yellow).
3. **Cards are never flat white.** Always the `.va-surface` green-gray gradient
   with white insets on top. Flat `#fff` panels read clinical — that was the
   specific note that drove this revision.

### Contrast (WCAG AA) — key pairings used
`#FAFBF8` on `#03361E` → ~13:1 ✓ · `#9CC3AC` on `#03361E` → ~6.3:1 ✓ ·
`#1B2620` on surface → ~14:1 ✓ · dark text on `#FFDD00` → 11.6:1 ✓ ·
`#054F2C` (inset values) on white → ~8:1 ✓. Re-check any NEW pairing before
shipping; status base colors (`#2E8B57`, `#D64545`) are for dots/borders, use
the `-text` variants for small text.

---

## 2. Typography

Two families, both geometric/crisp (the chosen personality), loaded from Google
Fonts via `index-head.html`.

| Family | Token | Used for | Weights |
|---|---|---|---|
| **Space Grotesk** | `--font-display` | Headings, the wordmark, all numerals (arc, counts) | 400–700 |
| **Hanken Grotesk** | `--font-sans` | Body, labels, buttons, inputs | 400–800 |

### Scale (prototype values)
- Screen H1: **38–44px**, weight 600, `letter-spacing:-.03em`, `line-height:1.02–1.04`. Often stacked across 3 lines with the last word in `--color-yellow-500`.
- Card title: 16px / 600 (Space Grotesk).
- Body: 14–15px / 400–500 (Hanken).
- Labels / eyebrows: 10.5–12px, 600–700, `letter-spacing .08–.16em`, uppercase, muted.
- Minimum readable size in UI: 12px (labels only); body stays ≥14px.

**Highlight mark** (the on-brand "marker" under a word):
`background: linear-gradient(transparent 62%, #FFDD00 62%)` behind dark text.

---

## 3. Spacing, radius, elevation

- **Radius:** cards `16px` (`--radius-card`), inset boxes `10px` (`--radius-box`), pills/buttons `999px`/`11px`.
- **Card padding:** 16–20px. **Stack gap between cards:** 13–14px.
- **Elevation:** cards use a *combined* shadow — an inner top highlight
  (`inset 0 1px 0 rgba(255,255,255,.7)`) for the crafted edge **plus** a soft
  ambient drop (`0 16px 40px -22px rgba(0,0,0,.6)`). The inset highlight is what
  makes the surface feel rich rather than flat.
- **Hit targets:** interactive controls are **≥44px** tall (`minHeight:44` on buttons).
- **Focus:** `button:focus-visible { outline:3px solid var(--color-yellow-500); outline-offset:3px }`.

---

## 4. Motion tokens

| Token | Curve | Use |
|---|---|---|
| `--ease-glide` | `cubic-bezier(.22,1,.36,1)` | Travel & settle — transitions, drifts, the arc fill |
| `--ease-spring` | `cubic-bezier(.34,1.45,.5,1)` | Taps, pops, card hover-lift, the switcher indicator (slight overshoot) |

Full keyframe catalog and usage in **`animation-cookbook.md`**.

---

## 5. Layout widths (prototype)
- Student screens (Construir / Conversar): `max-width: 620–660px`, centered.
- Teacher / Handoff: `max-width: 1020px`, 3-column card grid.
- Top bar: `max-width: 1080px`. Switcher tab width: `134px` (drives the indicator math).

---

## 6. Accessibility checklist (already wired in the kit)
- [x] AA contrast on all text pairings (see §1).
- [x] ≥44px hit targets, visible keyboard focus rings.
- [x] `prefers-reduced-motion` collapses all motion to ~instant (content stays at its end state — never stranded mid-fade).
- [x] `role="tablist"`/`role="tab"`/`aria-selected` on the switcher.
- [x] Yellow never used as text; status uses `-text` variants for small copy.
- [ ] **You add:** real `<input>`/`<label>` associations and `aria-live` on validation feedback when wiring to logic (the prototype shows static states).
