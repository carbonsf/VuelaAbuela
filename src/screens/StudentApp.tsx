import { useRoom } from '../RoomContext'
import { Screen, Wordmark, T } from '../components/despegue'
import { InputScreen } from './InputScreen'
import { HoldingScreen } from './HoldingScreen'
import { PoemGame } from '../minigame/PoemGame'
import { ActivationScreen } from './ActivationScreen'
import { ConversationScreen } from './ConversationScreen'
import { RepartoScreen } from './RepartoScreen'
import type { StudentId } from '../types'

// Routes a single student device to the right screen from activity + phase (§7).
export function StudentApp({ studentId }: { studentId: StudentId }) {
  const { state } = useRoom()
  const student = state!.students[studentId]
  if (!student) return <Centered>Reconectando…</Centered>

  if (student.markedOut) {
    return (
      <Centered>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, color: T.bg }}>
          Estás fuera de esta ronda.
        </div>
        <p style={{ marginTop: 6, fontSize: 13.5, color: T.onDarkMuted }}>Tu profe rodeó la actividad sin ti.</p>
      </Centered>
    )
  }

  const { activity } = state!

  switch (activity) {
    case 'LOBBY':
      return (
        <Centered>
          <Wordmark size={24} />
          <p style={{ marginTop: 16, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: T.bg }}>
            ¡Bienvenida, {student.name}!
          </p>
          <p style={{ marginTop: 2, fontSize: 13.5, color: T.onDarkMuted }}>Esperando a que tu profe empiece la actividad…</p>
        </Centered>
      )

    case 'INPUT':
      // early finishers play the communal poem waiting-game while others fill in
      return student.phase === 'passed' ? <PoemGame studentId={studentId} /> : <InputScreen studentId={studentId} />

    case 'READY_GATE':
      return <PoemGame studentId={studentId} />

    case 'HANDOFF':
      // students watch the redistribution set-piece; the teacher advances
      return <RepartoScreen />

    case 'ACTIVATION':
    case 'CONVERSATION':
    case 'SUBMITTED':
    case 'REVIEW':
    default:
      if (student.phase === 'submitted') return <HoldingScreen context="submitted" />
      if (student.phase === 'conversing') return <ConversationScreen studentId={studentId} />
      return <ActivationScreen studentId={studentId} />
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Screen key="centered" maxWidth={440} style={{ paddingTop: 70, textAlign: 'center' }}>
      {children}
    </Screen>
  )
}
