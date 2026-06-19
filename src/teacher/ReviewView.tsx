import { useRoom } from '../RoomContext'
import { Surface, Button, Pill, StubBadge, HeroInline, T } from '../components/despegue'
import { StubExporter } from '../seams'
import type { ReviewRow } from '../types'

// End review (§9B): condensed side-by-side persona vs recorded, full scroll.
// Built-in comprehension check — recorded answers beside the actual persona.
export function ReviewView() {
  const { state } = useRoom()
  const config = state!.config

  const rows: ReviewRow[] = Object.values(state!.recorded)
    .map((rec) => {
      const persona = state!.personas[rec.aboutStudent]
      return persona ? { persona, recorded: rec } : null
    })
    .filter((r): r is ReviewRow => r !== null)

  const slotLabel = (slotId: string) => config.prompts.find((p) => p.id === slotId)?.labelL1 ?? slotId

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <HeroInline pre="Revisión de" accent="comprensión" size={30} />
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: T.onDarkMuted }}>
            respuestas anotadas junto a la persona real
          </p>
        </div>
        <Button variant="ghost" onClick={() => StubExporter.export(rows)}>
          Exportar&nbsp; <StubBadge label="Exporter" />
        </Button>
      </div>

      {rows.length === 0 && (
        <div style={{ background: 'rgba(250,251,248,.06)', border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 'var(--radius-card)', padding: 28, textAlign: 'center', color: T.onDarkMuted }}>
          Aún no se han enviado entrevistas.
        </div>
      )}

      {rows.map((row) => {
        const interviewer = state!.students[row.recorded.byStudent]?.name ?? row.recorded.byStudent
        const subject = state!.students[row.recorded.aboutStudent]?.name ?? row.recorded.aboutStudent
        const slotIds = config.questions.map((q) => q.targetSlotId)
        return (
          <Surface key={row.recorded.byStudent}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: T.ink }}>{interviewer}</span>
              <span style={{ color: T.muted, fontSize: 13.5 }}>entendió</span>
              <Pill tone="info">persona de {subject}</Pill>
            </div>
            <div style={{ overflow: 'hidden', borderRadius: 10, border: `1px solid ${T.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: '#fff' }}>
                    {['campo', 'persona real', 'anotado', ''].map((h, i) => (
                      <th key={i} style={{ padding: '8px 12px', fontSize: 11, textTransform: 'uppercase',
                        letterSpacing: '.06em', color: T.muted, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slotIds.map((slotId) => {
                    const actual = row.persona.slots[slotId] ?? '—'
                    const recorded = row.recorded.answers[slotId] ?? ''
                    const match = recorded.trim().toLowerCase() === actual.trim().toLowerCase() && recorded.trim() !== ''
                    return (
                      <tr key={slotId} style={{ borderTop: `1px solid ${T.border}`, background: '#fff' }}>
                        <td style={{ padding: '8px 12px', fontSize: 11, textTransform: 'uppercase',
                          letterSpacing: '.06em', color: T.muted, fontWeight: 700 }}>{slotLabel(slotId)}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: T.green700 }}>{actual}</td>
                        <td style={{ padding: '8px 12px', color: T.ink }}>{recorded || <span style={{ color: T.muted }}>—</span>}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {recorded.trim() === '' ? null : match ? '✅' : '↔︎'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Surface>
        )
      })}
    </div>
  )
}
