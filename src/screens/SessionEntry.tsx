import { useState } from 'react'
import { Screen, Surface, Button, Wordmark, HeroTitle, T } from '../components/despegue'

// Real-mode entry (§7 LOBBY, non-god). One physical device is one identity:
// the teacher creates a room, or a student joins one. The god-mode harness
// (operator switches between every screen) is the other path.
export function SessionEntry({ onTeacher, onStudent }: {
  onTeacher: () => void | Promise<void>
  onStudent: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function teacher() {
    setBusy(true)
    await onTeacher()
    // parent swaps the view on success; leave busy true to avoid a flash
  }

  return (
    <Screen key="entry" maxWidth={460} style={{ paddingTop: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <Wordmark size={26} />
      </div>
      <Surface style={{ padding: 26 }}>
        <HeroTitle lines={['¿Profe', 'o alumno?']} size={34} onLight />
        <p style={{ margin: '12px 0 0', color: T.muted, fontSize: 14.5 }}>
          Crea una sala para tu clase, o únete a una con el código que te dio tu profe.
        </p>

        <div style={{ marginTop: 22, display: 'grid', gap: 12 }}>
          <Button onClick={teacher} disabled={busy} style={{ width: '100%', fontSize: 16, padding: '14px 22px' }}>
            {busy ? 'Creando sala…' : 'Soy profe — crear sala'}
          </Button>
          <Button onClick={onStudent} disabled={busy} variant="solid"
            style={{ width: '100%', fontSize: 16, padding: '14px 22px' }}>
            Soy alumno — unirme
          </Button>
        </div>
      </Surface>
    </Screen>
  )
}
