import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRoom } from '../RoomContext'
import { Screen, Surface, Button, Pill, ProgressArc, T } from '../components/despegue'
import { validateInput } from '../validation/validator'
import { generatePoemLine } from './poem'
import type { Prompt, PoemLevel, StudentId } from '../types'

// The communal waiting-game poem (§10). Each student adds ONE word; the model
// weaves it into the next line. Everyone sees the poem grow and who added what.
// Built to fill dead air with motion — the first student may wait a while.

const POEM_PROMPT: Prompt = {
  id: 'poem-word',
  labelL1: 'A single evocative Spanish word for the class poem (any word: a noun, verb, feeling…)',
  source: 'phase1',
  complexity: 'word',
  example: 'luna',
}

const LEVEL_LABEL: Record<PoemLevel, string> = {
  principiante: 'principiante', intermedio: 'intermedio', avanzado: 'avanzado',
}

type Feedback =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'block'; msg: string }
  | { kind: 'reenter'; msg: string }
  | { kind: 'point'; msg: string }
  | { kind: 'reveal'; msg: string; answer?: string }

export function PoemGame({ studentId }: { studentId: StudentId }) {
  const { transport, state } = useRoom()
  const config = state!.config
  const level: PoemLevel = config.poemLevel ?? 'principiante'
  const poem = state!.poem
  const me = state!.students[studentId]

  const mine = useMemo(() => poem.find((e) => e.byStudentId === studentId), [poem, studentId])
  const [draft, setDraft] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [fb, setFb] = useState<Feedback>({ kind: 'idle' })

  // readiness signal (real): how many pilots are waiting together
  const active = Object.values(state!.students).filter((s) => !s.markedOut)
  const readyCount = active.filter((s) =>
    ['passed', 'waiting', 'activating', 'conversing', 'submitted'].includes(s.phase)).length

  async function add() {
    const word = draft.trim()
    if (!word) return
    if (/\s/.test(word)) { setFb({ kind: 'reenter', msg: 'Solo una palabra, por favor.' }); return }
    setFb({ kind: 'working' })
    const res = await validateInput({ prompt: POEM_PROMPT, value: word, config, grammarAttempt: attempt })
    if (res.action === 'block') { setFb({ kind: 'block', msg: res.reason }); return }
    if (res.action === 'reenter') { setFb({ kind: 'reenter', msg: res.reason }); return }
    if (res.action === 'correct') {
      if (attempt === 0) { setAttempt(1); setFb({ kind: 'point', msg: res.hint }) }
      else { setAttempt((a) => a + 1); setFb({ kind: 'reveal', msg: res.hint, answer: res.answer }) }
      return
    }
    // pass -> weave a line and append
    const line = await generatePoemLine(poem, word, level, config.language)
    await transport.addPoemEntry({ word, byStudentId: studentId, byName: me?.name ?? '—', line })
    setDraft(''); setAttempt(0); setFb({ kind: 'idle' })
  }

  return (
    <Screen key="poemgame" maxWidth={620} style={{ paddingTop: 18 }}>
      <FloatField count={poem.length} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: T.bg, lineHeight: 1 }}>
              El poema de la clase
            </div>
            <p style={{ margin: '7px 0 0', fontSize: 13.5, color: T.onDarkMuted }}>
              Mientras despegan los demás, escríbanlo juntos — una palabra cada quien.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Pill tone="onDark">nivel {LEVEL_LABEL[level]}</Pill>
            <Pill tone="brand">{poem.length} {poem.length === 1 ? 'verso' : 'versos'}</Pill>
          </div>
        </div>

        {/* the growing poem */}
        <Surface style={{ marginTop: 18, padding: '24px 26px', minHeight: 150 }}>
          {poem.length === 0 ? (
            <EmptyPoem mineYet={!!mine} />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {poem.map((e, i) => (
                <PoemLine key={i} index={i} line={e.line} word={e.word} name={e.byName}
                  mine={e.byStudentId === studentId} newest={i === poem.length - 1} />
              ))}
            </div>
          )}
        </Surface>

        {/* word pool — who added what */}
        {poem.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {poem.map((e, i) => (
              <span key={i} title={`${e.word} · ${e.byName}`}
                style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '5px 11px',
                  borderRadius: 999, fontSize: 13, background: 'rgba(250,251,248,.08)',
                  border: `1px solid ${e.byStudentId === studentId ? 'rgba(255,221,0,.5)' : 'rgba(255,255,255,.14)'}`,
                  color: T.onDarkSoft, animation: 'va-cardPop .45s var(--ease-spring) both',
                  animationDelay: `${0.04 * i}s` }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: T.bg }}>{e.word}</span>
                <span style={{ fontSize: 11, color: T.onDarkMuted }}>· {e.byName}</span>
              </span>
            ))}
          </div>
        )}

        {/* your turn / contributed */}
        <div style={{ marginTop: 20 }}>
          {mine ? (
            <div style={{ textAlign: 'center', animation: 'va-rise .5s var(--ease-spring) both' }}>
              <p style={{ margin: 0, fontSize: 14, color: T.onDarkSoft }}>
                Tu palabra <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: T.yellow }}>
                  {mine.word}</span> ya vuela en el poema. <Pill tone="ok">añadida ✓</Pill>
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 12.5, color: T.onDarkMuted }}>
                Mira cómo crece mientras llegan los demás…
              </p>
            </div>
          ) : (
            <YourTurn
              draft={draft} setDraft={(v) => { setDraft(v); if (fb.kind !== 'idle' && fb.kind !== 'working') setFb({ kind: 'idle' }) }}
              onAdd={add} fb={fb} />
          )}
        </div>

        {/* real readiness signal */}
        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
          <ProgressArc value={readyCount} total={active.length} size={72} label="listos" />
          <p style={{ margin: 0, fontSize: 13, color: T.onDarkMuted, maxWidth: 240 }}>
            Esperando a que tu profe lance el reparto. El poema sigue mientras tanto.
          </p>
        </div>
      </div>
    </Screen>
  )
}

function YourTurn({ draft, setDraft, onAdd, fb }: {
  draft: string; setDraft: (v: string) => void; onAdd: () => void; fb: Feedback
}) {
  const busy = fb.kind === 'working'
  const tone =
    fb.kind === 'block' ? T.errorText : fb.kind === 'reenter' ? T.amberText
      : fb.kind === 'point' || fb.kind === 'reveal' ? T.amberText : T.onDarkMuted

  return (
    <div style={{ animation: 'va-rise .5s var(--ease-spring) both' }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && onAdd()}
          placeholder="tu palabra…"
          maxLength={24}
          autoFocus
          style={{ width: 220, background: '#fff', border: `1.5px solid ${T.border}`,
            borderRadius: 'var(--radius-box)', padding: '13px 16px', fontFamily: 'var(--font-display)',
            fontWeight: 600, fontSize: 18, color: T.ink, outline: 'none', textAlign: 'center' }}
        />
        <Button onClick={onAdd} disabled={busy || !draft.trim()} style={{ fontSize: 16, padding: '13px 22px' }}>
          {busy ? 'Tejiendo…' : 'Añadir mi palabra ✈'}
        </Button>
      </div>
      <div aria-live="polite" style={{ minHeight: 22, marginTop: 10, textAlign: 'center',
        fontSize: 13.5, fontWeight: 600, color: tone }}>
        {fb.kind === 'block' && <>🚫 {fb.msg}</>}
        {fb.kind === 'reenter' && <>↻ {fb.msg}</>}
        {fb.kind === 'point' && <>✎ {fb.msg}</>}
        {fb.kind === 'reveal' && <>✎ {fb.msg}{fb.answer ? <> → <span style={{ color: T.bg }}>{fb.answer}</span></> : null}</>}
      </div>
    </div>
  )
}

function PoemLine({ index, line, word, name, mine, newest }: {
  index: number; line: string; word: string; name: string; mine: boolean; newest: boolean
}) {
  // highlight the contributed word within the line (first case-insensitive hit)
  const parts = splitOnWord(line, word)
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline',
      animation: `va-fadeUp .55s var(--ease-glide) both`, animationDelay: `${newest ? 0 : Math.min(index * 0.04, 0.3)}s` }}>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: T.green100,
        opacity: 0.7, minWidth: 22, textAlign: 'right' }}>{index + 1}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: newest ? 21 : 19, lineHeight: 1.35,
        color: T.ink, fontStyle: 'italic' }}>
        {parts ? (
          <>{parts[0]}<mark style={{ background: 'linear-gradient(transparent 60%, var(--color-yellow-500) 60%)',
            color: 'inherit', padding: '0 1px' }}>{parts[1]}</mark>{parts[2]}</>
        ) : line}
        <span style={{ marginLeft: 8, fontSize: 11, fontStyle: 'normal', fontWeight: 600,
          color: mine ? T.amberText : T.muted, opacity: 0.8 }}>— {name}</span>
      </span>
    </div>
  )
}

function EmptyPoem({ mineYet }: { mineYet: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '14px 6px' }}>
      <div style={{ fontSize: 30, animation: 'va-breathe 4s var(--ease-glide) infinite' }}>✦</div>
      <div style={{ marginTop: 8, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: T.ink }}>
        {mineYet ? 'El poema empieza en un momento…' : 'Sé quien enciende el primer verso'}
      </div>
      <p style={{ margin: '6px auto 0', maxWidth: 360, fontSize: 13.5, color: T.muted }}>
        Tu palabra se convertirá en el primer verso del poema de toda la clase.
      </p>
    </div>
  )
}

// ambient drifting motes — keeps the screen alive while waiting
function FloatField({ count }: { count: number }) {
  const motes = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    left: (i * 53) % 100,
    top: (i * 37) % 100,
    size: 4 + ((i * 7) % 9),
    dur: 7 + ((i * 5) % 9),
    delay: -(i * 1.3),
    yellow: i % 4 === 0,
  })), [])
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {motes.map((m, i) => (
        <span key={i} style={{
          position: 'absolute', left: `${m.left}%`, top: `${m.top}%`,
          width: m.size, height: m.size, borderRadius: '50%',
          background: m.yellow ? 'var(--color-yellow-500)' : 'rgba(197,221,206,.5)',
          opacity: m.yellow ? 0.5 : 0.28, filter: 'blur(.4px)',
          animation: `${i % 2 ? 'va-drift' : 'va-driftB'} ${m.dur}s var(--ease-glide) ${m.delay}s infinite`,
        } as CSSProperties} />
      ))}
      {/* a soft glow that brightens as the poem grows */}
      <div style={{ position: 'absolute', left: '50%', top: 120, transform: 'translateX(-50%)',
        width: 360, height: 360, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(255,221,0,.10) 0%, transparent 70%)',
        opacity: Math.min(0.25 + count * 0.06, 0.9), transition: 'opacity 1s var(--ease-glide)' }} />
    </div>
  )
}

// split a line into [before, match, after] on the first case-insensitive,
// accent-loose hit of `word`; null if not found (line still renders plain).
function splitOnWord(line: string, word: string): [string, string, string] | null {
  if (!word) return null
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const nLine = norm(line)
  const nWord = norm(word)
  const at = nLine.indexOf(nWord)
  if (at < 0) return null
  return [line.slice(0, at), line.slice(at, at + word.length), line.slice(at + word.length)]
}
