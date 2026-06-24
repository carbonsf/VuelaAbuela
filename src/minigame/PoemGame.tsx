import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRoom } from '../RoomContext'
import { GOD_MODE } from '../godmode/godmode'
import { Screen, Surface, Button, Pill, ProgressArc, T } from '../components/despegue'
import { validateInput } from '../validation/validator'
import { generatePoem, defineWordEN, deaccent, wordStem } from './poem'
import type { Prompt, PoemLevel, StudentId } from '../types'

// Communal waiting-game poem (§10). Words are collected and the WHOLE poem is
// re-woven in BATCHES on a fixed collection window (not per word), so it reads
// like a real Spanish poem without a model call on every keystroke. Words are
// embedded in the poem with a tiny contributor tag; every word is clickable for
// a definition. "Pyramid" of turns: each new pool member grants every earlier
// member another word, so allowance(student) = poolSize − theirJoinIndex.
//
// STUB seam → server-authoritative batching: today one client (pool[0], or the
// mounted device in god-mode) drives the window timer and regenerates. The real
// version arms a Durable Object alarm so the server re-weaves once, authoritatively.
const COLLECTION_MS = 15000

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
  const poem = state!.poem
  const me = state!.students[studentId]

  useEffect(() => { transport.joinPoemPool(studentId) }, [transport, studentId])

  const poolIdx = poem.pool.indexOf(studentId)
  const allowance = poolIdx < 0 ? 0 : poem.pool.length - poolIdx
  const myUsed = poem.words.filter((w) => w.byStudentId === studentId).length
  const remaining = Math.max(0, allowance - myUsed)

  const [draft, setDraft] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [fb, setFb] = useState<Feedback>({ kind: 'idle' })
  const [def, setDef] = useState<{ word: string; en: string | null } | null>(null)
  const defCache = useRef<Map<string, string>>(new Map())

  // attribution: word stem (accent-folded) -> contributor name
  const attribution = useMemo(() => {
    const m = new Map<string, string>()
    for (const w of poem.words) m.set(wordStem(w.word), w.byName)
    return m
  }, [poem.words])

  const active = Object.values(state!.students).filter((s) => !s.markedOut)
  const readyCount = active.filter((s) =>
    ['passed', 'waiting', 'activating', 'conversing', 'submitted'].includes(s.phase)).length

  const pendingWords = poem.words.slice(poem.committed)
  const pending = pendingWords.length

  // ---- batched regeneration: a single designated client drives a fixed window
  const amRegenerator = GOD_MODE || poem.pool[0] === studentId
  const poemRef = useRef(poem); poemRef.current = poem
  const timer = useRef<number | null>(null)

  async function fireRegen() {
    timer.current = null
    const cur = poemRef.current
    if (cur.regenerating || cur.words.length <= cur.committed) return
    const covered = cur.words.length
    await transport.setPoemRegenerating(true)
    try {
      const { text, start } = await generatePoem(cur.words.map((w) => w.word), level, config.language, cur.startCache)
      await transport.commitPoem(text, start, covered)
    } catch {
      await transport.setPoemRegenerating(false)
    }
  }

  useEffect(() => {
    if (!amRegenerator || pending <= 0 || poem.regenerating || timer.current != null) return
    const delay = poem.text === '' ? 0 : COLLECTION_MS // first poem is instant; then batch
    timer.current = window.setTimeout(fireRegen, delay)
    // a fixed window: do NOT reset when more words arrive mid-window
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, poem.regenerating, poem.text, amRegenerator])

  useEffect(() => () => { if (timer.current != null) clearTimeout(timer.current) }, [])

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
    // pass -> record the word (it joins the next batch); the window re-weaves it in
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
              Aporta una palabra — el poema entero se reteje cada poco. Toca cualquier palabra para su significado.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Pill tone="onDark">{LEVEL_LABEL[level]}</Pill>
            <Pill tone="brand">{poem.words.length} {poem.words.length === 1 ? 'palabra' : 'palabras'}</Pill>
          </div>
        </div>

        {/* the poem */}
        <Surface style={{ marginTop: 18, padding: '28px 30px', minHeight: 170, position: 'relative', overflow: 'hidden' }}>
          {poem.regenerating && <WeavingVeil />}
          {poem.text ? (
            <PoemView key={poem.gen} text={poem.text} gen={poem.gen} attribution={attribution} onWord={openDef} />
          ) : (
            <EmptyPoem mineYet={myUsed > 0} weaving={poem.regenerating} />
          )}
        </Surface>

        {/* pending words awaiting the next weave */}
        {pending > 0 && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', color: T.onDarkMuted, marginBottom: 7 }}>
              {poem.regenerating ? 'tejiendo…' : `por entrelazar en el próximo verso${amRegenerator ? '' : ' (~15 s)'}`}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
              {pendingWords.map((w, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, padding: '5px 11px',
                  borderRadius: 999, fontSize: 13, background: 'rgba(255,221,0,.12)', border: '1px solid rgba(255,221,0,.4)',
                  color: T.onDarkSoft, animation: 'va-cardPop .5s var(--ease-spring) both', animationDelay: `${0.05 * i}s` }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: T.bg }}>{w.word}</span>
                  <span style={{ fontSize: 11, color: T.onDarkMuted }}>· {w.byName}</span>
                </span>
              ))}
            </div>
          </div>
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

        {/* readiness */}
        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
          <ProgressArc value={readyCount} total={active.length} size={66} label="listos" />
          <p style={{ margin: 0, fontSize: 13, color: T.onDarkMuted, maxWidth: 250 }}>
            Esperando a que tu profe lance el reparto — el poema sigue creciendo mientras tanto.
          </p>
        </div>
      </div>

      {def && <DefinitionModal word={def.word} en={def.en} onClose={() => setDef(null)} />}
    </Screen>
  )
}

// ---- the rendered poem: cohesive text, embedded attributions, clickable -----
function PoemView({ text, gen, attribution, onWord }: {
  text: string; gen: number; attribution: Map<string, string>; onWord: (w: string) => void
}) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  let wordIndex = 0
  return (
    <div style={{ animation: 'va-poemIn .7s var(--ease-glide) both' }}>
      {lines.map((line, li) => {
        const tokens = line.match(/(\p{L}[\p{L}'-]*)|([^\p{L}]+)/gu) ?? [line]
        return (
          <div key={`${gen}-${li}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
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
        // absolute label so it doesn't add column height (which lifted the word)
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
        {fb.kind === 'added' && <>✓ ¡añadida! se entrelazará en el próximo verso.</>}
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
