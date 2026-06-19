import { useState } from 'react'
import { RoomProvider, useRoom } from './RoomContext'
import { GOD_MODE, SAMPLE_NAMES } from './godmode/godmode'
import { GodModeBar } from './godmode/GodModeBar'
import { CanvasShell, FullscreenButton, Pill, Wordmark, T } from './components/despegue'
import { JoinScreen } from './screens/JoinScreen'
import { StudentApp } from './screens/StudentApp'
import { LandingScreen } from './screens/LandingScreen'
import { TeacherDashboard } from './teacher/TeacherDashboard'

// A "device" is one screen the operator can switch to: the teacher dashboard or
// a student device (which begins at the join screen, then binds to a StudentId).
export type Device =
  | { id: string; kind: 'teacher' }
  | { id: string; kind: 'student'; studentId?: string }

let deviceSeq = 0
const nextDeviceId = () => `d${++deviceSeq}`

export default function App() {
  return (
    <RoomProvider>
      <Shell />
    </RoomProvider>
  )
}

function Shell() {
  const { transport, state } = useRoom()
  const [devices, setDevices] = useState<Device[]>(() => [
    { id: nextDeviceId(), kind: 'teacher' },
    { id: nextDeviceId(), kind: 'student' },
  ])
  const [activeId, setActiveId] = useState<string>(() => devices[1].id)
  const [started, setStarted] = useState(false)

  function bindStudent(deviceId: string, studentId: string) {
    setDevices((ds) => ds.map((d) => (d.id === deviceId && d.kind === 'student' ? { ...d, studentId } : d)))
  }

  function addStudentDevice(studentId?: string) {
    const id = nextDeviceId()
    setDevices((ds) => [...ds, { id, kind: 'student', studentId }])
    setActiveId(id)
  }

  async function spawnStudents(n: number) {
    const created: Device[] = []
    for (let i = 0; i < n; i++) {
      const name = SAMPLE_NAMES[(i + Math.floor(Math.random() * SAMPLE_NAMES.length)) % SAMPLE_NAMES.length]
      const studentId = await transport.joinRoom('', name)
      created.push({ id: nextDeviceId(), kind: 'student', studentId })
    }
    setDevices((ds) => [...ds, ...created])
  }

  const active = devices.find((d) => d.id === activeId) ?? devices[0]

  // Dynamic visual landing — the entry point until the user clicks to begin.
  if (!started) {
    return (
      <CanvasShell>
        <LandingScreen onBegin={() => setStarted(true)} />
        <FullscreenButton />
      </CanvasShell>
    )
  }

  if (!GOD_MODE) {
    return (
      <CanvasShell>
        <AppHeader />
        <main style={{ padding: '8px 24px 64px' }}>
          <StudentDevice device={{ id: 'solo', kind: 'student' }} onJoined={() => {}} />
        </main>
        <FullscreenButton />
      </CanvasShell>
    )
  }

  return (
    <CanvasShell>
      <GodModeBar
        devices={devices}
        activeId={activeId}
        setActiveId={setActiveId}
        addStudentDevice={addStudentDevice}
        spawnStudents={spawnStudents}
      />
      <AppHeader room={state?.code} />
      <main style={{ padding: '8px 24px 64px' }}>
        {active.kind === 'teacher' ? (
          <TeacherDashboard />
        ) : (
          <StudentDevice device={active} onJoined={(sid) => bindStudent(active.id, sid)} />
        )}
      </main>
      <FullscreenButton />
    </CanvasShell>
  )
}

function AppHeader({ room }: { room?: string }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18,
      padding: '20px 30px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Wordmark />
        <Pill tone="onDark">Escuela demo</Pill>
      </div>
      {room && (
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.16em',
          textTransform: 'uppercase', color: T.onDarkMuted }}>
          Sala <span style={{ color: T.bg }}>{room}</span>
        </span>
      )}
    </header>
  )
}

function StudentDevice({ device, onJoined }: { device: Device; onJoined: (studentId: string) => void }) {
  if (device.kind !== 'student') return null
  if (!device.studentId) return <JoinScreen onJoined={onJoined} />
  return <StudentApp studentId={device.studentId} />
}
