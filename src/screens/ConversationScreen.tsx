import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRoom } from '../RoomContext'
import {
  Screen, Surface, Button, Pill, HeroInline, StubBadge, T,
} from '../components/despegue'
import { GlobalQuestionSource, IdentityPersonaTransform } from '../seams'
import type { StudentId } from '../types'

// CONVERSATION (§2.7, §7): persona to convey · questions to ask · record answers.
// In person, real time. Recorded answers NOT validated; wrong is acceptable (§2.8).
export function ConversationScreen({ studentId }: { studentId: StudentId }) {
  const { transport, state } = useRoom()
  const config = state!.config

  const group = state!.groups.find((g) => g.members.includes(studentId))
  const myPersona = state!.personas[studentId]
  const partnerId = group?.members.find((m) => m !== studentId)

  const display = useMemo(
    () => (myPersona ? IdentityPersonaTransform.render(myPersona, config) : null),
    [myPersona, config],
  )
  const questions = useMemo(
    () => (myPersona ? GlobalQuestionSource.getQuestions(myPersona, config) : []),
    [myPersona, config],
  )

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (!group || !myPersona || !partnerId || !display) {
    return (
      <Screen key="conv" maxWidth={660} style={{ paddingTop: 40 }}>
        <Surface style={{ textAlign: 'center', color: T.muted }}>Preparando la conversación…</Surface>
      </Screen>
    )
  }

  const partnerName = state!.students[partnerId]?.name ?? partnerId
  const answeredCount = questions.filter((q) => (answers[q.targetSlotId] ?? '').trim()).length

  function submit() {
    transport.submitAnswers(studentId, { aboutStudent: partnerId!, byStudent: studentId, answers })
    setSubmitted(true)
  }

  const perspectiveNote =
    display.perspective === 'third-person' ? 'Habla de ella/él en tercera persona (él/ella).'
      : display.perspective === 'first-person' ? 'Habla como esta persona (yo).'
        : 'Descríbela como tu vecino/a.'

  return (
    <Screen key="conv" maxWidth={660} style={{ paddingTop: 6 }}>
      <HeroInline pre="La" accent="conversación" />
      <p style={{ margin: '12px 0 0', color: T.onDarkSoft, fontSize: 14.5 }}>
        Emparejada con <strong style={{ color: T.bg }}>{partnerName}</strong>. Describe tu persona en voz alta; anota lo que te cuente.
        <span style={{ marginLeft: 8, color: T.onDarkMuted }}>token {group.token}</span>
      </p>

      {/* (a) persona to convey */}
      <Surface style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: T.ink, margin: 0 }}>Tu persona — descríbela</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: T.muted }}>{perspectiveNote} {partnerName} te preguntará.</p>
          </div>
          <Pill tone="info">{display.perspective === 'third-person' ? '3.ª persona' : display.perspective}</Pill>
        </div>
        <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          {display.lines.map((l) => (
            <div key={l.slotId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.muted }}>{l.label}</span>
              <span className="va-inset" style={{ padding: '6px 11px', fontWeight: 600, color: T.green700, fontSize: 14 }}>{l.value}</span>
            </div>
          ))}
        </div>
      </Surface>

      {/* (b) questions to ask + (c) record partner answers */}
      <Surface style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: T.ink, margin: 0 }}>Entrevista a {partnerName}</h3>
          <Pill tone={answeredCount === questions.length ? 'ok' : 'warn'}>{answeredCount}/{questions.length}</Pill>
        </div>
        <p style={{ margin: '3px 0 0', fontSize: 13, color: T.muted }}>
          Haz cada pregunta. Anota lo que te diga — las suposiciones valen, esto no se califica.
        </p>

        <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          {questions.map((q) => {
            const filled = (answers[q.targetSlotId] ?? '').trim() !== ''
            const isFocus = focused === q.id
            const borderColor = isFocus ? T.green500 : filled ? T.green100 : T.border
            const inputId = `q-${q.id}`
            const inputStyle: CSSProperties = {
              width: '100%', boxSizing: 'border-box', marginTop: 5, background: '#fff',
              border: `1.5px solid ${borderColor}`, borderRadius: 'var(--radius-box)', padding: '10px 13px',
              fontFamily: 'var(--font-sans)', fontSize: 14.5, color: T.green700, outline: 'none',
              boxShadow: isFocus ? '0 0 0 4px rgba(8,107,60,.1)' : 'none',
            }
            return (
              <div key={q.id}>
                <label htmlFor={inputId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>{q.text}</span>
                  {q.grammarTag && <Pill tone="info">{q.grammarTag}</Pill>}
                </label>
                <input
                  id={inputId}
                  value={answers[q.targetSlotId] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.targetSlotId]: e.target.value }))}
                  onFocus={() => setFocused(q.id)}
                  onBlur={() => setFocused(null)}
                  disabled={submitted}
                  placeholder="Su respuesta…"
                  style={inputStyle}
                />
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: T.muted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            respuestas sin validar <StubBadge label="preguntas IA" />
          </span>
          <Button onClick={submit} disabled={submitted || answeredCount === 0}>
            {submitted ? 'Enviado ✓' : 'Enviar al profesor →'}
          </Button>
        </div>
      </Surface>
    </Screen>
  )
}
