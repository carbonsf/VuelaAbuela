import type { CSSProperties } from 'react'
import type { Device } from '../App'
import { useRoom } from '../RoomContext'
import { T } from '../components/despegue'
import { autofillAndPass, jumpAllToPoem, resetRoom } from './godmode'

// God-mode control bar (§1). Switch viewer across all student screens + the
// teacher dashboard; spawn fake students; fast-forward. Visually fenced off (a
// near-black strip) so it reads as a dev harness, not product UI.
export function GodModeBar({
  devices,
  activeId,
  setActiveId,
  addStudentDevice,
  spawnStudents,
}: {
  devices: Device[]
  activeId: string
  setActiveId: (id: string) => void
  addStudentDevice: (studentId?: string) => void
  spawnStudents: (n: number) => void
}) {
  const { transport, state } = useRoom()

  function nameFor(d: Device): string {
    if (d.kind === 'teacher') return 'Tablero'
    if (!d.studentId) return '+ uniéndose…'
    return state?.students[d.studentId]?.name ?? d.studentId
  }

  const chip = (active: boolean): CSSProperties => ({
    border: 'none', cursor: 'pointer', borderRadius: 999, padding: '5px 12px',
    fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
    background: active ? T.yellow : 'rgba(255,255,255,.1)',
    color: active ? T.canvas : 'rgba(250,251,248,.8)',
  })
  const action: CSSProperties = {
    border: 'none', cursor: 'pointer', borderRadius: 999, padding: '5px 12px',
    fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
    background: 'rgba(255,255,255,.1)', color: 'rgba(250,251,248,.85)',
  }
  // poem-tinted action so the minigame shortcuts stand out
  const poemAction: CSSProperties = { ...action, background: 'rgba(255,221,0,.16)', color: T.yellow }

  const PASSED = ['passed', 'waiting', 'activating', 'conversing', 'submitted']

  // Push ONE more student into the poem game and switch to their device so it
  // mounts (joins the pool). Lets you build the pyramid one student at a time.
  function poemNext() {
    if (!state) return
    if (state.activity === 'LOBBY') transport.patch({ activity: 'INPUT' })
    const cand = devices.find((d) => d.kind === 'student' && d.studentId
      && state.students[d.studentId] && !state.students[d.studentId].markedOut
      && !PASSED.includes(state.students[d.studentId].phase))
    if (!cand || cand.kind !== 'student' || !cand.studentId) return
    transport.setStudentPhase(cand.studentId, 'passed')
    setActiveId(cand.id)
  }

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0f0c',
      borderBottom: '1px solid rgba(255,221,0,.18)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap',
        alignItems: 'center', gap: 8, padding: '8px 24px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
          letterSpacing: '.1em', color: T.yellow, marginRight: 2 }}>⚙︎ GOD MODE</span>
        <span style={{ fontSize: 11, color: 'rgba(250,251,248,.4)', marginRight: 6 }}>
          arnés de un solo flag
        </span>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {devices.map((d) => (
            <button key={d.id} onClick={() => setActiveId(d.id)} style={chip(activeId === d.id)}>
              {nameFor(d)}
            </button>
          ))}
        </div>

        <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,.2)', margin: '0 4px' }} />

        <button onClick={() => addStudentDevice()} style={action}>+ dispositivo</button>
        <button onClick={() => spawnStudents(6)} style={action}>+6 alumnos</button>
        <button onClick={() => state && autofillAndPass(transport, state)} style={action}
          title="rellena las entradas de cada alumno y las aprueba">
          rellenar &amp; aprobar
        </button>

        <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,.2)', margin: '0 4px' }} />

        <button onClick={poemNext} style={poemAction}
          title="pasa al siguiente alumno al poema y cambia a su pantalla (para armar la pirámide)">
          🪂 poema +1
        </button>
        <button onClick={() => state && jumpAllToPoem(transport, state)} style={poemAction}
          title="manda a todos los alumnos al minijuego del poema">
          poema: todos
        </button>
        <button onClick={() => state && resetRoom(transport, state)} style={action}
          title="reinicia la ronda y manda a todos al vestíbulo (solo god mode)">
          ↺ reiniciar
        </button>

        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(250,251,248,.4)' }}>
          sala {state?.code} · {state?.activity} · {Object.keys(state?.students ?? {}).length} alumnos
        </span>
      </div>
    </div>
  )
}
