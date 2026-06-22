import type { CSSProperties } from 'react'
import { useRoom } from '../RoomContext'
import { Surface, Pill, StubBadge, Eyebrow, T } from '../components/despegue'
import type { PoemLevel } from '../types'

const POEM_LEVELS: { id: PoemLevel; label: string; hint: string }[] = [
  { id: 'principiante', label: 'Principiante', hint: 'A1–A2 · vocabulario simple, presente' },
  { id: 'intermedio', label: 'Intermedio', hint: 'B1 · pasados, frases con metáfora' },
  { id: 'avanzado', label: 'Avanzado', hint: 'B2–C1 · lenguaje rico y figurado' },
]

// Teacher view (A) — Authoring (§9A). Hardcoded sample rendered read-only with a
// visible "design later" STUB where the editing UI will live. The waiting-poem
// level IS live and editable (it drives the §10 minigame).
export function AuthoringView() {
  const { transport, state } = useRoom()
  const config = state!.config
  const poemLevel: PoemLevel = config.poemLevel ?? 'principiante'

  function setPoemLevel(level: PoemLevel) {
    transport.patch({ config: { ...config, poemLevel: level } })
  }

  const levelChip = (selected: boolean): CSSProperties => ({
    flex: '1 1 150px', textAlign: 'left', cursor: 'pointer', borderRadius: 12, padding: '11px 14px',
    fontFamily: 'var(--font-sans)', transition: 'all .2s var(--ease-glide)',
    background: selected ? T.canvas : '#fff',
    border: `1.5px solid ${selected ? T.canvas : T.border}`,
    color: selected ? T.bg : T.ink,
  })

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Surface>
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eyebrow>Poema de espera — nivel de la clase</Eyebrow>
          <Pill tone="ok">en vivo</Pill>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: T.muted }}>
          Controla la dificultad del poema comunal que los alumnos arman mientras esperan el reparto.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {POEM_LEVELS.map((lv) => (
            <button key={lv.id} onClick={() => setPoemLevel(lv.id)} style={levelChip(poemLevel === lv.id)}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14.5 }}>{lv.label}</div>
              <div style={{ marginTop: 3, fontSize: 11.5, opacity: 0.85,
                color: poemLevel === lv.id ? T.onDarkSoft : T.muted }}>{lv.hint}</div>
            </button>
          ))}
        </div>
      </Surface>

      <div style={{ borderRadius: 'var(--radius-card)', border: '1px dashed rgba(224,168,0,.5)',
        background: 'rgba(224,168,0,.08)', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StubBadge label="diseñar después" />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.bg }}>Autoría de la lección</span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: T.onDarkSoft }}>
          La UI para editar prompts, preguntas, objetivo gramatical, perspectiva y modo de corrección irá aquí.
          En este prototipo la lección de muestra es de solo lectura.
        </p>
      </div>

      <Surface>
        <div style={{ marginBottom: 12 }}><Eyebrow>Configuración (muestra §8)</Eyebrow></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Pill tone="ok">idioma: {config.language}</Pill>
          <Pill tone="ok">gramática: {config.grammarTarget}</Pill>
          <Pill tone="ok">perspectiva: {config.perspective}</Pill>
          <Pill tone="ok">corrección: {config.correctionMode}</Pill>
          <Pill tone="ok">impar: {config.groupFallback}</Pill>
        </div>
      </Surface>

      <Surface>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: T.ink, margin: '0 0 12px' }}>
          Prompts ({config.prompts.length})
        </h3>
        <div style={{ overflow: 'hidden', borderRadius: 10, border: `1px solid ${T.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: '#fff' }}>
                {['id', 'etiqueta (L1)', 'complejidad', 'fuente', 'ejemplo'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', fontSize: 11, textTransform: 'uppercase',
                    letterSpacing: '.06em', color: T.muted, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.prompts.map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${T.border}`, background: '#fff' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font-display)', fontSize: 12, color: T.muted }}>{p.id}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: T.ink }}>{p.labelL1}</td>
                  <td style={{ padding: '8px 12px', color: T.green700 }}>{p.complexity}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {p.source === 'join' ? <Pill tone="ok">join</Pill> : <Pill tone="neutral">phase1</Pill>}
                  </td>
                  <td style={{ padding: '8px 12px', color: T.muted }}>{p.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      <Surface>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: T.ink, margin: '0 0 12px' }}>
          Preguntas globales ({config.questions.length})
        </h3>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 7 }}>
          {config.questions.map((q) => (
            <li key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
              <span style={{ fontWeight: 600, color: T.ink }}>{q.text}</span>
              <span style={{ color: T.muted }}>→ {q.targetSlotId}</span>
              {q.grammarTag && <Pill tone="info">{q.grammarTag}</Pill>}
            </li>
          ))}
        </ul>
        <p style={{ marginTop: 12, fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
          Preguntas derivadas por IA <StubBadge label="QuestionSource" /> se conectan después.
        </p>
      </Surface>
    </div>
  )
}
