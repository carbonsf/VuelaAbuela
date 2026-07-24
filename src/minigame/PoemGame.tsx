import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRoom } from '../RoomContext'
import { GOD_MODE } from '../godmode/godmode'
import { Screen, Surface, Button, Pill, T } from '../components/despegue'
import { validateInput } from '../validation/validator'
import { generatePoem, defineWordEN, deaccent, wordStem } from './poem'
import type { Prompt, PoemLevel, StudentId } from '../types'

// Communal waiting-game poem (§10). Words are COLLECTED over a window and the
// whole poem is re-woven once per batch (one Sonnet call), so we don't generate
// a poem per word. The new batch is hard-required in the poem; earlier words are
// suggested. Every weave is kept, so students can browse the history.
//
// ── Dial this in ──────────────────────────────────────────────────────────────
const COLLECTION_MS = 20000 // how long to collect words before weaving
// ─────────────────────────────────────────────────────────────────────────────
//
// The window ends early the moment every active student has used their slots.
// STUB seam → server-authoritative batching: today one client (pool[0], or the
// mounted device in god-mode) drives the timer. The real version arms a Durable
// Object alarm so the server weaves once, authoritatively.

const SPANISH_ARTICLES = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']

const POEM_PROMPT: Prompt = {
  id: 'poem-word',
  labelL1: 'A single Spanish word for a class poem — optionally with its article (e.g. "el mar"); any kind of word is fine',
  source: 'phase1',
  complexity: 'word',
  example: 'el mar',
}

const LEVEL_LABEL: Record<PoemLevel, string> = {
  principiante: 'Español 1–2', intermedio: 'Español 2–3', avanzado: 'Español 3–4',
}

type Feedback =
  | { kind: 'idle' } | { kind: 'working' } | { kind: 'added' }
  | { kind: 'block'; msg: string } | { kind: 'reenter'; msg: string }
  | { kind: 'point'; msg: string } | { kind: 'reveal'; msg: string; answer?: string }

function entryFormatOk(raw: string): boolean {
  const toks = raw.trim().split(/\s+/)
  if (toks.length === 1) return toks[0].length > 0
  if (toks.length === 2) return SPANISH_ARTICLES.includes(toks[0].toLowerCase())
  return false
}

export function PoemGame({ studentId }: { studentId: StudentId }) {
  const { transport, state } = useRoom()
  const config = state!.config
  const level: PoemLevel = config.poemLevel ?? 'intermedio'
  const me = state!.students[studentId]
  // Tolerate a room created by an older server build (pre-`versions`), so a
  // client deploy that lands before the worker redeploy degrades instead of
  // crashing. Once the worker ships the new shape these defaults never apply.
  const raw = state!.poem
  const poem = useMemo(() => ({
    ...raw,
    pool: raw.pool ?? [],
    words: raw.words ?? [],
    versions: raw.versions ?? [],
    startCache: raw.startCache ?? [],
    committed: raw.committed ?? 0,
    windowStartedAt: raw.windowStartedAt ?? null,
  }), [raw])

  useEffect(() => { transport.joinPoemPool(studentId) }, [transport, studentId])

  // ---- pyramid allowance
  const poolIdx = poem.pool.indexOf(studentId)
  const allowance = poolIdx < 0 ? 0 : poem.pool.length - poolIdx
  const myUsed = poem.words.filter((w) => w.byStudentId === studentId).length
  const remaining = Math.max(0, allowance - myUsed)

  // ---- batch state
  const pendingWords = poem.words.slice(poem.committed)
  const pending = pendingWords.length
  const submittedCount = poem.pool.filter((id, i) => {
    const used = poem.words.filter((w) => w.byStudentId === id).length
    return used >= poem.pool.length - i
  }).length
  const allSubmitted = poem.pool.length > 0 && submittedCount === poem.pool.length

  // ---- poem history / viewing
  const versions = poem.versions
  const latestIdx = versions.length - 1
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null) // null = follow latest
  const viewIdx = pinnedIdx ?? latestIdx
  const shown = versions[viewIdx]
  const hasNewer = pinnedIdx !== null && pinnedIdx < latestIdx

  const [draft, setDraft] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [fb, setFb] = useState<Feedback>({ kind: 'idle' })
  const [def, setDef] = useState<{ word: string; en: string | null } | null>(null)
  const defCache = useRef<Map<string, string>>(new Map())

  // attribution covers EVERY word ever submitted, including older rounds
  const attribution = useMemo(() => {
    const m = new Map<string, string>()
    for (const w of poem.words) m.set(wordStem(w.word), w.byName)
    return m
  }, [poem.words])

  // ---- batched weave: absolute deadline in shared state, so every client agrees
  const amRegenerator = GOD_MODE || poem.pool[0] === studentId
  const poemRef = useRef(poem); poemRef.current = poem

  async function fireRegen() {
    const cur = poemRef.current
    if (cur.regenerating || cur.words.length <= cur.committed) return
    const covered = cur.words.length
    const hard = cur.words.slice(cur.committed).map((w) => w.word) // this batch: required
    const soft = cur.words.slice(0, cur.committed).map((w) => w.word) // older: suggested
    await transport.setPoemRegenerating(true)
    try {
      const { text, start } = await generatePoem(hard, soft, level, config.language, cur.startCache)
      await transport.commitPoem(text, start, covered)
    } catch {
      await transport.setPoemRegenerating(false)
    }
  }

  useEffect(() => {
    if (!amRegenerator || pending <= 0 || poem.regenerating) return
    if (allSubmitted) { void fireRegen(); return } // everyone's in — jump the queue
    const started = poem.windowStartedAt ?? Date.now()
    const wait = Math.max(0, COLLECTION_MS - (Date.now() - started))
    const t = window.setTimeout(() => void fireRegen(), wait)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, poem.regenerating, allSubmitted, poem.windowStartedAt, amRegenerator])

  // tick the visible countdown
  const [, tick] = useState(0)
  useEffect(() => {
    if (pending <= 0 || poem.regenerating) return
    const i = window.setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(i)
  }, [pending, poem.regenerating])

  const elapsed = poem.windowStartedAt ? Date.now() - poem.windowStartedAt : 0
  const secondsLeft = Math.max(0, Math.ceil((COLLECTION_MS - elapsed) / 1000))
  const windowProgress = Math.min(1, elapsed / COLLECTION_MS)

  const busy = fb.kind === 'working'

  async function add() {
    const entry = draft.trim()
    if (!entry) return
    if (!entryFormatOk(entry)) { setFb({ kind: 'reenter', msg: 'Una palabra (o artículo + sustantivo, p. ej. «el mar»).' }); return }
    setFb({ kind: 'working' })
    const res = await validateInput({ prompt: POEM_PROMPT, value: entry, config, grammarAttempt: attempt })
    if (res.action === 'block') { setFb({ kind: 'block', msg: res.reason }); return }
    if (res.action === 'reenter') { setFb({ kind: 'reenter', msg: res.reason }); return }
    if (res.action === 'correct') {
      if (attempt === 0) { setAttempt(1); setFb({ kind: 'point', msg: res.hint }) }
      else { setAttempt((a) => a + 1); setFb({ kind: 'reveal', msg: res.hint, answer: res.answer }) }
      return
    }
    await transport.addPoemWord({ word: entry, byStudentId: studentId, byName: me?.name ?? '—' })
    setDraft(''); setAttempt(0); setFb({ kind: 'added' })
    window.setTimeout(() => setFb((f) => (f.kind === 'added' ? { kind: 'idle' } : f)), 2200)
  }

  async function openDef(word: string) {
    const clean = word.replace(/[^\p{L}'-]/gu, '')
    if (!clean) return
    setDef({ word: clean, en: defCache.current.get(clean.toLowerCase()) ?? null })
    if (!defCache.current.has(clean.toLowerCase())) {
      const en = await defineWordEN(clean, config.language)
      defCache.current.set(clean.toLowerCase(), en)
      setDef((d) => (d && d.word === clean ? { ...d, en } : d))
    }
  }

  return (
    <Screen key="poemgame" maxWidth={660} style={{ paddingTop: 18 }}>
      <FloatField count={poem.words.length} weaving={poem.regenerating} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: T.bg, lineHeight: 1 }}>
              El poema de la clase
            </div>
            <p style={{ margin: '7px 0 0', fontSize: 13.5, color: T.onDarkMuted }}>
              Aporta palabras — cada poco se teje un poema nuevo con todas. Toca cualquier palabra para su significado.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Pill tone="onDark">{LEVEL_LABEL[level]}</Pill>
            <Pill tone="brand">{poem.words.length} {poem.words.length === 1 ? 'palabra' : 'palabras'}</Pill>
          </div>
        </div>

        {/* history nav */}
        {versions.length > 1 && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <NavBtn label="←" disabled={viewIdx <= 0} onClick={() => setPinnedIdx(Math.max(0, viewIdx - 1))} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.onDarkMuted, minWidth: 108, textAlign: 'center' }}>
              Poema {viewIdx + 1} de {versions.length}
              {viewIdx < latestIdx && <span style={{ color: T.amberText }}> · anterior</span>}
            </span>
            <NavBtn label="→" disabled={viewIdx >= latestIdx} onClick={() => {
              const next = viewIdx + 1
              setPinnedIdx(next >= latestIdx ? null : next) // reaching the end resumes following
            }} />
          </div>
        )}

        {/* the poem */}
        <Surface style={{ marginTop: 12, padding: '28px 30px', minHeight: 170, position: 'relative', overflow: 'hidden' }}>
          {poem.regenerating && <WeavingVeil />}
          {shown ? (
            <PoemView key={viewIdx} text={shown.text} attribution={attribution} onWord={openDef} />
          ) : (
            <EmptyPoem mineYet={myUsed > 0} weaving={poem.regenerating} />
          )}
        </Surface>

        {/* a new poem exists but you're reading an older one — nudge, don't yank */}
        {hasNewer && (
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => setPinnedIdx(null)} style={{ cursor: 'pointer', borderRadius: 999,
              padding: '7px 15px', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700,
              color: T.canvas, background: 'var(--color-yellow-500)', border: 'none',
              boxShadow: '0 8px 22px -10px rgba(255,221,0,.8)', animation: 'va-cardPop .4s var(--ease-spring) both' }}>
              ✨ Hay un poema nuevo — verlo
            </button>
          </div>
        )}

        {/* next weave: countdown + early-exit signal */}
        {pending > 0 && (
          <NextWeave
            regenerating={poem.regenerating} allSubmitted={allSubmitted}
            secondsLeft={secondsLeft} progress={windowProgress}
            submittedCount={submittedCount} poolSize={poem.pool.length}
            pendingWords={pendingWords} mine={studentId}
          />
        )}

        {/* your turn */}
        <div style={{ marginTop: 18 }}>
          {remaining > 0 ? (
            <YourTurn draft={draft} busy={busy} remaining={remaining} fb={fb}
              setDraft={(v) => { setDraft(v); if (fb.kind !== 'idle' && fb.kind !== 'working') setFb({ kind: 'idle' }) }}
              onAdd={add} />
          ) : (
            <div style={{ textAlign: 'center', animation: 'va-rise .5s var(--ease-spring) both' }}>
              <p style={{ margin: 0, fontSize: 13.5, color: T.onDarkSoft }}>
                {myUsed > 0
                  ? <>Tus palabras ya vuelan en el poema. <Pill tone="ok">+{myUsed}</Pill></>
                  : 'Espera un momento…'}
              </p>
              <p style={{ margin: '7px 0 0', fontSize: 12.5, color: T.onDarkMuted }}>
                Cuando entre alguien nuevo, ganarás otra palabra. ✨
              </p>
            </div>
          )}
        </div>
      </div>

      {def && <DefinitionModal word={def.word} en={def.en} onClose={() => setDef(null)} />}
    </Screen>
  )
}

// ---- next-weave panel: ticking countdown + "everyone's in ⇒ it jumps" --------
function NextWeave({ regenerating, allSubmitted, secondsLeft, progress, submittedCount, poolSize, pendingWords, mine }: {
  regenerating: boolean; allSubmitted: boolean; secondsLeft: number; progress: number
  submittedCount: number; poolSize: number; pendingWords: { word: string; byStudentId: string; byName: string }[]; mine: string
}) {
  const R = 15
  const C = 2 * Math.PI * R
  return (
    <div style={{ marginTop: 14, borderRadius: 'var(--radius-card)', background: 'rgba(250,251,248,.05)',
      border: '1px solid rgba(255,221,0,.22)', padding: '12px 16px', animation: 'va-rise .4s var(--ease-glide) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {regenerating ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: T.yellow }}>✧ Tejiendo el poema nuevo…</span>
        ) : allSubmitted ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: T.yellow }}>✧ ¡Todos han enviado! Tejiendo ahora…</span>
        ) : (
          <>
            {/* depleting ring — the wait is visible, not mysterious */}
            <span style={{ position: 'relative', width: 38, height: 38, flexShrink: 0 }}>
              <svg width="38" height="38" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="19" cy="19" r={R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="3" />
                <circle cx="19" cy="19" r={R} fill="none" stroke="var(--color-yellow-500)" strokeWidth="3"
                  strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * progress}
                  style={{ transition: 'stroke-dashoffset .25s linear' }} />
              </svg>
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: T.bg }}>
                {secondsLeft}
              </span>
            </span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.bg }}>Poema nuevo en {secondsLeft} s</div>
              <div style={{ fontSize: 11.5, color: T.onDarkMuted }}>
                o en cuanto envíen todos — <span style={{ color: T.yellow, fontWeight: 700 }}>{submittedCount}/{poolSize}</span> listos
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
        {pendingWords.map((w, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, padding: '4px 10px',
            borderRadius: 999, fontSize: 12.5, background: 'rgba(255,221,0,.12)',
            border: `1px solid ${w.byStudentId === mine ? 'rgba(255,221,0,.7)' : 'rgba(255,221,0,.35)'}`,
            color: T.onDarkSoft, animation: 'va-cardPop .5s var(--ease-spring) both', animationDelay: `${0.05 * i}s` }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: T.bg }}>{w.word}</span>
            <span style={{ fontSize: 10.5, color: T.onDarkMuted }}>· {w.byName}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function NavBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label === '←' ? 'Poema anterior' : 'Poema siguiente'}
      style={{ width: 30, height: 30, borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
        border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.06)',
        color: disabled ? 'rgba(255,255,255,.2)' : T.bg, fontSize: 14, lineHeight: 1 }}>
      {label}
    </button>
  )
}

// ---- the rendered poem: cohesive text, embedded attributions, clickable -----
function PoemView({ text, attribution, onWord }: {
  text: string; attribution: Map<string, string>; onWord: (w: string) => void
}) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  let wordIndex = 0
  return (
    <div style={{ animation: 'va-poemIn .7s var(--ease-glide) both' }}>
      {lines.map((line, li) => {
        const tokens = line.match(/(\p{L}[\p{L}'-]*)|([^\p{L}]+)/gu) ?? [line]
        return (
          <div key={li} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
            justifyContent: 'center', lineHeight: 1.5, marginBottom: 11 }}>
            {tokens.map((tok, ti) => {
              if (!/\p{L}/u.test(tok)) {
                return <span key={ti} style={{ whiteSpace: 'pre', fontFamily: 'var(--font-display)',
                  fontStyle: 'italic', fontSize: 21, color: T.ink }}>{tok}</span>
              }
              const folded = deaccent(tok)
              let name: string | undefined
              for (const [stem, n] of attribution) {
                if (stem.length >= 3 && folded.startsWith(stem)) { name = n; break }
              }
              const idx = wordIndex++
              return <WordToken key={ti} word={tok} name={name} index={idx} onClick={() => onWord(tok)} />
            })}
          </div>
        )
      })}
    </div>
  )
}

function WordToken({ word, name, index, onClick }: {
  word: string; name?: string; index: number; onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap',
      animation: `va-wordFloat ${5 + (index % 5)}s var(--ease-glide) ${(index % 7) * -0.6}s infinite` }}>
      <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', lineHeight: 1,
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 21,
          color: name ? T.green700 : T.ink,
          borderBottom: `2px solid ${hover ? T.amberMid : name ? 'rgba(255,221,0,.55)' : 'transparent'}`,
          transition: 'border-color .2s var(--ease-glide)' }}>
        {word}
      </button>
      {name && (
        <span style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 0,
          textAlign: 'center', fontFamily: 'var(--font-sans)', fontStyle: 'normal', lineHeight: 1,
          fontSize: 9, fontWeight: 600, letterSpacing: '.02em', color: T.amberText, opacity: 0.85,
          pointerEvents: 'none' }}>
          {name}
        </span>
      )}
    </span>
  )
}

function YourTurn({ draft, setDraft, onAdd, fb, busy, remaining }: {
  draft: string; setDraft: (v: string) => void; onAdd: () => void; fb: Feedback; busy: boolean; remaining: number
}) {
  const tone = fb.kind === 'block' ? T.errorText
    : fb.kind === 'reenter' || fb.kind === 'point' || fb.kind === 'reveal' ? T.amberText
      : fb.kind === 'added' ? T.successText : T.onDarkMuted
  return (
    <div style={{ animation: 'va-rise .5s var(--ease-spring) both' }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && onAdd()}
          placeholder="tu palabra…  (o «el mar»)" maxLength={28} autoFocus
          style={{ width: 250, background: '#fff', border: `1.5px solid ${T.border}`,
            borderRadius: 'var(--radius-box)', padding: '13px 16px', fontFamily: 'var(--font-display)',
            fontWeight: 600, fontSize: 18, color: T.ink, outline: 'none', textAlign: 'center' }} />
        <Button onClick={onAdd} disabled={busy || !draft.trim()} style={{ fontSize: 16, padding: '13px 22px' }}>
          {fb.kind === 'working' ? 'Revisando…' : 'Añadir ✈'}
        </Button>
      </div>
      <div aria-live="polite" style={{ minHeight: 20, marginTop: 9, textAlign: 'center',
        fontSize: 13, fontWeight: 600, color: tone }}>
        {fb.kind === 'block' && <>🚫 {fb.msg}</>}
        {fb.kind === 'reenter' && <>↻ {fb.msg}</>}
        {fb.kind === 'point' && <>✎ {fb.msg}</>}
        {fb.kind === 'reveal' && <>✎ {fb.msg}{fb.answer ? <> → <span style={{ color: T.bg }}>{fb.answer}</span></> : null}</>}
        {fb.kind === 'added' && <>✓ ¡añadida! entrará en el próximo poema.</>}
        {fb.kind === 'idle' && <span style={{ color: T.onDarkMuted, fontWeight: 500 }}>
          Te queda{remaining === 1 ? '' : 'n'} {remaining} palabra{remaining === 1 ? '' : 's'} por añadir.</span>}
      </div>
    </div>
  )
}

function DefinitionModal({ word, en, onClose }: { word: string; en: string | null; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center',
      background: 'rgba(3,54,30,.55)', backdropFilter: 'blur(2px)', animation: 'va-fadeUp .25s var(--ease-glide) both' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(340px, 86vw)', background: '#fff',
        borderRadius: 'var(--radius-card)', padding: '22px 24px', boxShadow: '0 30px 60px -24px rgba(0,0,0,.6)',
        animation: 'va-cardPop .35s var(--ease-spring) both' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: T.ink }}>{word}</div>
        <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted }}>
          en inglés
        </div>
        <div style={{ marginTop: 4, fontSize: 16, color: T.green700, fontWeight: 600, minHeight: 22 }}>
          {en === null ? <span style={{ color: T.muted, fontWeight: 400 }}>buscando…</span> : en}
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button disabled title="próximamente" style={{ flex: 1, border: `1px dashed ${T.border}`,
            background: '#F7F9F5', color: T.muted, borderRadius: 10, padding: '9px 12px', fontSize: 12.5,
            fontWeight: 600, cursor: 'not-allowed' }}>
            Ver en español ⚙︎
          </button>
          <Button variant="solid" onClick={onClose} style={{ padding: '9px 18px', minHeight: 0 }}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

function EmptyPoem({ mineYet, weaving }: { mineYet: boolean; weaving: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '18px 6px' }}>
      <div style={{ fontSize: 30, animation: 'va-breathe 4s var(--ease-glide) infinite' }}>✦</div>
      <div style={{ marginTop: 8, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: T.ink }}>
        {weaving ? 'Tejiendo el primer poema…' : mineYet ? 'El poema llega en un instante…' : 'Enciende el primer verso'}
      </div>
      <p style={{ margin: '6px auto 0', maxWidth: 380, fontSize: 13.5, color: T.muted }}>
        Tu palabra inspirará un poema entero para toda la clase.
      </p>
    </div>
  )
}

function WeavingVeil() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
      background: 'linear-gradient(105deg, transparent 30%, rgba(255,221,0,.18) 50%, transparent 70%)',
      backgroundSize: '220% 100%', animation: 'va-sweep 1.1s var(--ease-glide) infinite' }} />
  )
}

function FloatField({ count, weaving }: { count: number; weaving: boolean }) {
  const motes = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    left: (i * 53) % 100, top: (i * 37) % 100, size: 4 + ((i * 7) % 9),
    dur: 7 + ((i * 5) % 9), delay: -(i * 1.3), yellow: i % 4 === 0,
  })), [])
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {motes.map((m, i) => (
        <span key={i} style={{
          position: 'absolute', left: `${m.left}%`, top: `${m.top}%`, width: m.size, height: m.size,
          borderRadius: '50%', background: m.yellow ? 'var(--color-yellow-500)' : 'rgba(197,221,206,.5)',
          opacity: m.yellow ? 0.5 : 0.28, filter: 'blur(.4px)',
          animation: `${i % 2 ? 'va-drift' : 'va-driftB'} ${m.dur * (weaving ? 0.4 : 1)}s var(--ease-glide) ${m.delay}s infinite`,
        } as CSSProperties} />
      ))}
      <div style={{ position: 'absolute', left: '50%', top: 130, transform: 'translateX(-50%)',
        width: 380, height: 380, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(255,221,0,.10) 0%, transparent 70%)',
        opacity: Math.min(0.25 + count * 0.05, 0.9), transition: 'opacity 1s var(--ease-glide)' }} />
    </div>
  )
}
