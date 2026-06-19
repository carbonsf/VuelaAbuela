import { useRoom } from '../RoomContext'
import { buildRepartoView } from '../reparto'
import {
  Screen, HandoffShuffle, Button, HeroInline, useReplay, T,
} from '../components/despegue'

// Reparto — the HANDOFF activity state (§7, §10). The redistribution moment:
// answers "fly" to new owners and reassemble into new personas with new pairings.
// Teacher variant carries the "Ir a la conversación" advance; students watch.
export function RepartoScreen({ onContinue }: { onContinue?: () => void }) {
  const { state } = useRoom()
  const [key, replay] = useReplay()
  const { personas, pairings } = buildRepartoView(state!)

  return (
    <Screen key="reparto" maxWidth={1020} style={{ paddingTop: 8 }}>
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <HeroInline pre="Barajando las" accent="respuestas" />
        <p style={{ color: T.onDarkMuted, maxWidth: 520, margin: '12px auto 0', fontSize: 15 }}>
          Cada respuesta vuela hacia una persona nueva. Parejas nuevas para entrevistar.
        </p>
      </div>

      <HandoffShuffle personas={personas} pairings={pairings} playKey={key} />

      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 28 }}>
        <Button variant="ghost" onClick={replay}>↻ Repetir</Button>
        {onContinue ? (
          <Button onClick={onContinue}>Ir a la conversación →</Button>
        ) : (
          <span style={{ alignSelf: 'center', fontSize: 13, color: T.onDarkMuted }}>
            Esperando al profe para empezar…
          </span>
        )}
      </div>
    </Screen>
  )
}
