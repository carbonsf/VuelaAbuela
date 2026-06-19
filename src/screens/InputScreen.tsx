import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRoom } from '../RoomContext'
import {
  Screen, Surface, Button, Pill, ProgressArc, HeroTitle, StubBadge, T,
} from '../components/despegue'
import { validateInput, isLiveValidation, VALIDATION_MODEL } from '../validation/validator'
import type { Prompt, StudentId, ValidationResult } from '../types'

type RowFeedback =
  | { kind: 'idle' }
  | { kind: 'validating' }
  | { kind: 'block'; reason: string }
  | { kind: 'reenter'; reason: string }
  | { kind: 'point'; hint: string }
  | { kind: 'reveal'; hint: string; answer?: string }
  | { kind: 'pass' }

interface RowState {
  draft: string
  grammarAttempt: number
  feedback: RowFeedback
}

// INPUT (§7): "Construye tu persona secreta". Live validation loop — single
// bundled call per submission (§5); appropriateness-first; point-then-reveal.
export function InputScreen({ studentId }: { studentId: StudentId }) {
  const { transport, state } = useRoom()
  const config = state!.config
  const cells = state!.inputs[studentId] ?? {}

  const phase1 = useMemo(() => config.prompts.filter((p) => p.source === 'phase1'), [config])

  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {}
    for (const p of phase1) {
      init[p.id] = {
        draft: cells[p.id]?.value ?? '',
        grammarAttempt: 0,
        feedback: cells[p.id]?.status === 'passed' ? { kind: 'pass' } : { kind: 'idle' },
      }
    }
    return init
  })

  const passedCount = phase1.filter((p) => cells[p.id]?.status === 'passed').length
  const allPassed = passedCount === phase1.length

  useEffect(() => {
    const me = state!.students[studentId]
    if (!me) return
    const next = allPassed ? 'passed' : 'filling'
    if (me.phase !== next && ['joined', 'filling', 'passed', 'validating'].includes(me.phase)) {
      transport.setStudentPhase(studentId, next)
    }
  }, [allPassed, state, studentId, transport])

  function setRow(id: string, patch: Partial<RowState>) {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }))
  }

  function bumpFeedback(kind: 'appropriacyFails' | 'reenters' | 'correctionLoops') {
    const me = state!.students[studentId]
    if (!me) return
    transport.patch({
      students: { ...state!.students, [studentId]: { ...me, feedback: { ...me.feedback, [kind]: me.feedback[kind] + 1 } } },
    })
  }

  async function check(p: Prompt) {
    const row = rows[p.id]
    const value = row.draft.trim()
    if (!value) {
      setRow(p.id, { feedback: { kind: 'reenter', reason: 'Escribe algo, por favor.' } })
      return
    }
    setRow(p.id, { feedback: { kind: 'validating' } })
    transport.setStudentPhase(studentId, 'validating')
    const result = await validateInput({ prompt: p, value, config, grammarAttempt: row.grammarAttempt })
    applyResult(p, value, result)
  }

  function applyResult(p: Prompt, value: string, result: ValidationResult) {
    switch (result.action) {
      case 'pass':
        transport.submitInput(studentId, p.id, value)
        setRow(p.id, { feedback: { kind: 'pass' } })
        break
      case 'block':
        bumpFeedback('appropriacyFails')
        setRow(p.id, { feedback: { kind: 'block', reason: result.reason } })
        break
      case 'reenter':
        bumpFeedback('reenters')
        setRow(p.id, { feedback: { kind: 'reenter', reason: result.reason } })
        break
      case 'correct': {
        const attempt = rows[p.id].grammarAttempt
        if (attempt === 0) {
          setRow(p.id, { grammarAttempt: 1, feedback: { kind: 'point', hint: result.hint } })
        } else {
          bumpFeedback('correctionLoops')
          setRow(p.id, { grammarAttempt: attempt + 1, feedback: { kind: 'reveal', hint: result.hint, answer: result.answer } })
        }
        break
      }
    }
  }

  return (
    <Screen key="construir" maxWidth={640} style={{ paddingTop: 6 }}>
      {/* hero + progress arc */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <HeroTitle lines={['Construye', 'tu persona', 'secreta']} size={40} />
        <ProgressArc value={passedCount} total={phase1.length} label="listas" />
      </div>

      <p style={{ margin: '14px 0 0', color: T.onDarkSoft, fontSize: 14.5, maxWidth: 480 }}>
        Cada respuesta se baraja en la persona de otro/a. Escribe en <strong style={{ color: T.bg }}>español</strong>.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Pill tone="brand">el presente</Pill>
        <Pill tone="onDark">3.ª persona</Pill>
        {isLiveValidation() ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
            color: T.onDarkSoft, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)',
            borderRadius: 999, padding: '4px 11px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.success,
              animation: 'va-pulseDot 1.6s var(--ease-glide) infinite' }} />
            validación en vivo
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <StubBadge label="heurística" />
            <span style={{ fontSize: 11.5, color: T.onDarkMuted }}>(sin artifact — la real usa {VALIDATION_MODEL})</span>
          </span>
        )}
      </div>

      {/* name — pre-filled from join, locked (§2.2): dark translucent card */}
      <div style={{ marginTop: 18, borderRadius: 'var(--radius-card)', background: 'rgba(250,251,248,.06)',
        border: '1px solid rgba(255,255,255,.12)', padding: '14px 18px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.onDarkMuted }}>Nombre</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: T.bg, marginTop: 2 }}>{cells.name?.value}</div>
        </div>
        <Pill tone="brand">fijo ✓</Pill>
      </div>

      {/* prompt rows */}
      <div style={{ display: 'grid', gap: 13, marginTop: 13 }}>
        {phase1.map((p) => (
          <PromptRow
            key={p.id}
            prompt={p}
            row={rows[p.id]}
            onChange={(draft) => setRow(p.id, { draft, feedback: rows[p.id].feedback.kind === 'pass' ? { kind: 'idle' } : rows[p.id].feedback })}
            onCheck={() => check(p)}
          />
        ))}
      </div>

      {allPassed && (
        <Surface style={{ marginTop: 18, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: T.ink }}>¡Listo! Tus respuestas están en el bote.</div>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: T.muted }}>Espera a que tu profe lance el reparto.</p>
        </Surface>
      )}
    </Screen>
  )
}

function PromptRow({ prompt, row, onChange, onCheck }:
  { prompt: Prompt; row: RowState; onChange: (v: string) => void; onCheck: () => void }) {
  const [focused, setFocused] = useState(false)
  const passed = row.feedback.kind === 'pass'
  const validating = row.feedback.kind === 'validating'
  const errorish = row.feedback.kind === 'block' || row.feedback.kind === 'reenter'
  const warnish = row.feedback.kind === 'point' || row.feedback.kind === 'reveal'

  const borderColor = passed ? T.green100 : errorish ? T.error : warnish ? T.amberMid : focused ? T.green500 : T.border
  const inputId = `prompt-${prompt.id}`

  const insetStyle: CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: '#fff', border: `1.5px solid ${borderColor}`,
    borderRadius: 'var(--radius-box)', padding: '11px 13px', fontFamily: 'var(--font-sans)', fontSize: 15,
    color: T.green700, outline: 'none',
    boxShadow: focused && !errorish && !warnish ? '0 0 0 4px rgba(8,107,60,.1)' : 'none',
  }

  return (
    <Surface hoverLift>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <label htmlFor={inputId} style={{ display: 'block' }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: T.ink }}>{prompt.labelL1}</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 1 }}>
            <span style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>{prompt.complexity}</span>
            {prompt.example && <span> · p. ej. “{prompt.example}”</span>}
          </div>
        </label>
        {passed && (
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: T.green500, color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flex: 'none' }}>✓</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          id={inputId}
          value={row.draft}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === 'Enter' && !validating && onCheck()}
          placeholder="Escribe en español…"
          aria-invalid={errorish}
          style={insetStyle}
        />
        <Button variant={passed ? 'solid' : 'primary'} onClick={onCheck} disabled={validating}
          style={{ flex: 'none', padding: '11px 18px', minHeight: 0 }}>
          {validating ? '…' : passed ? 'Revisar' : 'Revisar ✓'}
        </Button>
      </div>

      <Feedback row={row} />
    </Surface>
  )
}

function Feedback({ row }: { row: RowState }) {
  const f = row.feedback
  const base: CSSProperties = { margin: '9px 0 0', fontSize: 13, fontWeight: 500 }
  let node: React.ReactNode = null
  switch (f.kind) {
    case 'validating': node = <span style={{ ...base, color: T.amberText }}>Comprobando…</span>; break
    case 'block': node = <span style={{ ...base, color: T.errorText }}>🚫 {f.reason}</span>; break
    case 'reenter': node = <span style={{ ...base, color: T.errorText }}>↺ {f.reason}</span>; break
    case 'point':
      node = <span style={{ ...base, color: T.amberHint }}>✏️ Casi— {f.hint} <span style={{ color: T.muted }}>(corrige y vuelve a revisar)</span></span>
      break
    case 'reveal':
      node = (
        <span style={{ ...base, color: T.amberHint }}>✏️ {f.hint}
          {f.answer && (
            <> Prueba: <span style={{ background: T.yellowSoft, color: T.ink, borderRadius: 5, padding: '1px 6px', fontWeight: 700 }}>{f.answer}</span>
              <span style={{ color: T.muted }}> — escríbelo tú.</span></>
          )}
        </span>
      )
      break
    default: node = null
  }
  // aria-live so screen readers announce validation outcomes as they arrive
  return <div aria-live="polite">{node}</div>
}
