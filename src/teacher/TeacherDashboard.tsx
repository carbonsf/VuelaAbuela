import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useRoom } from '../RoomContext'
import {
  Screen, Surface, Button, Pill, PhaseDot, HeroInline, Eyebrow, StubBadge, T,
} from '../components/despegue'
import { AuthoringView } from './AuthoringView'
import { ReviewView } from './ReviewView'
import { RepartoScreen } from '../screens/RepartoScreen'
import { runHandoff } from './handoff'
import type { RoomState, Student } from '../types'

type Tab = 'monitor' | 'authoring'

function isReady(state: RoomState, student: Student): boolean {
  const phase1 = state.config.prompts.filter((p) => p.source === 'phase1')
  const cells = state.inputs[student.id] ?? {}
  return phase1.every((p) => cells[p.id]?.status === 'passed')
}

function isStuck(s: Student): boolean {
  return s.feedback.appropriacyFails >= 2 || s.feedback.correctionLoops >= 2
}

const darkPanel: CSSProperties = {
  background: 'rgba(250,251,248,.06)', border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 'var(--radius-card)', padding: '18px 20px',
}

export function TeacherDashboard() {
  const { transport, state } = useRoom()
  const [tab, setTab] = useState<Tab>('monitor')
  if (!state) return null
  const activity = state.activity

  // The redistribution set-piece owns the whole screen while HANDOFF is active.
  if (activity === 'HANDOFF') {
    return <RepartoScreen onContinue={() => transport.patch({ activity: 'ACTIVATION' })} />
  }

  const active = Object.values(state.students).filter((s) => !s.markedOut)
  const phaseLabel: Record<string, string> = {
    LOBBY: 'vestíbulo', INPUT: 'entrada', READY_GATE: 'sala de espera',
    ACTIVATION: 'despegue', CONVERSATION: 'conversación', SUBMITTED: 'enviado', REVIEW: 'revisión',
  }

  return (
    <Screen key="tablero" maxWidth={1020} style={{ paddingTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <HeroInline pre="Monitor" accent="en vivo" />
          <p style={{ color: T.onDarkMuted, maxWidth: 540, margin: '12px 0 0', fontSize: 14.5 }}>
            Los nombres aparecen al unirse · los puntos muestran la fase · las señales marcan a quien se atasca.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Pill tone="brand">Fase: {phaseLabel[activity] ?? activity}</Pill>
          <Pill tone="onDark">{active.length} unidos</Pill>
        </div>
      </div>

      {/* tab toggle */}
      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <Button variant={tab === 'monitor' ? 'primary' : 'ghost'} onClick={() => setTab('monitor')}
          style={{ padding: '9px 18px', minHeight: 0 }}>Monitor en vivo</Button>
        <Button variant={tab === 'authoring' ? 'primary' : 'ghost'} onClick={() => setTab('authoring')}
          style={{ padding: '9px 18px', minHeight: 0 }}>Autoría</Button>
      </div>

      {activity === 'LOBBY' && tab === 'monitor' && <BigRoomCode code={state.code} />}

      <div style={{ marginTop: 18 }}>
        {tab === 'authoring' ? (
          <AuthoringView />
        ) : activity === 'REVIEW' || activity === 'SUBMITTED' ? (
          <>
            <ActivityControls />
            <div style={{ marginTop: 18 }}><ReviewView /></div>
          </>
        ) : (
          <>
            <ActivityControls />
            <div style={{ marginTop: 18 }}><RosterBoard /></div>
          </>
        )}
      </div>
    </Screen>
  )
}

function ActivityControls() {
  const { transport, state } = useRoom()
  const config = state!.config
  const activity = state!.activity
  const [fallback, setFallback] = useState<'absorb' | 'force-trio'>(config.groupFallback)
  const [working, setWorking] = useState(false)

  const active = Object.values(state!.students).filter((s) => !s.markedOut)
  const readyCount = active.filter((s) => isReady(state!, s)).length
  const allReady = active.length > 0 && readyCount === active.length
  const oddCount = active.length % 2 === 1

  const launchedCount = state!.groups.filter((g) => state!.launched[g.id]).length
  const submittedCount = Object.values(state!.students).filter((s) => s.phase === 'submitted').length

  async function handoff() {
    setWorking(true)
    await runHandoff(transport, state!, { fallback })
    setWorking(false)
  }

  const resolveChip = (selected: boolean): CSSProperties => ({
    border: 'none', cursor: 'pointer', borderRadius: 999, padding: '6px 13px', fontSize: 13, fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    background: selected ? T.canvas : 'rgba(255,255,255,.7)', color: selected ? T.bg : T.ink,
  })

  return (
    <div style={darkPanel}>
      {activity === 'LOBBY' && (
        <Row
          title="Vestíbulo"
          sub={`${active.length} en la sala. Abre las entradas cuando estés listo.`}
          cta={<Button onClick={() => transport.patch({ activity: 'INPUT' })} disabled={active.length === 0}>Abrir las entradas →</Button>}
        />
      )}

      {(activity === 'INPUT' || activity === 'READY_GATE') && (
        <div>
          <Row
            title="Fase de entrada"
            sub={<><span style={{ color: T.yellow, fontWeight: 700 }}>{readyCount}</span> de {active.length} han pasado · en clase el reparto espera a todos.</>}
            cta={<Button onClick={handoff} disabled={!allReady || working}>{working ? 'Barajando…' : 'Redistribuir y emparejar →'}</Button>}
          />
          {!allReady && (
            <p style={{ marginTop: 8, fontSize: 12, color: T.onDarkMuted }}>
              El reparto se desbloquea cuando cada alumno activo ha pasado.
            </p>
          )}
          {oddCount && (
            <div style={{ marginTop: 14, borderRadius: 12, background: 'rgba(255,221,0,.1)',
              border: '1px solid rgba(255,221,0,.3)', padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.yellow }}>⚠︎ Número impar de jugadores ({active.length})</div>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setFallback('absorb')} style={resolveChip(fallback === 'absorb')}>Absorber — yo juego</button>
                <button onClick={() => setFallback('force-trio')} style={resolveChip(fallback === 'force-trio')}>Forzar un trío</button>
                <StubBadge label="trío" />
                <span style={{ fontSize: 12, color: T.onDarkMuted }}>se resuelve al repartir</span>
              </div>
            </div>
          )}
        </div>
      )}

      {(activity === 'ACTIVATION' || activity === 'CONVERSATION') && (
        <Row
          title="Conversaciones en vivo"
          sub={`${launchedCount}/${state!.groups.length} parejas despegadas · ${submittedCount} enviadas`}
          cta={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Button variant="ghost" disabled title="no conectado">Emparejado manual <StubBadge /></Button>
              <Button onClick={() => transport.patch({ activity: 'REVIEW' })} disabled={submittedCount === 0}>Terminar y revisar →</Button>
            </div>
          }
        />
      )}

      {(activity === 'REVIEW' || activity === 'SUBMITTED') && (
        <Row
          title="Revisión"
          sub={`${Object.keys(state!.recorded).length} entrevistas recibidas.`}
          cta={<Pill tone="ok">actividad completa</Pill>}
        />
      )}
    </div>
  )
}

// Big, central room code for the lobby so the teacher can read it out and the
// class can join. Each glyph in its own tile; tap-to-copy the whole code.
function BigRoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }).catch(() => {})
  }
  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', animation: 'va-rise .5s var(--ease-spring) both' }}>
      <Eyebrow onDark>Código de sala — compártelo con tu clase</Eyebrow>
      <button onClick={copy} title="Copiar código"
        style={{ marginTop: 12, display: 'flex', gap: 10, background: 'none', border: 'none',
          cursor: 'pointer', padding: 0 }}>
        {code.split('').map((ch, i) => (
          <span key={i} style={{ fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 'clamp(46px, 12vw, 88px)', lineHeight: 1, color: T.canvas,
            background: 'var(--color-yellow-500)', borderRadius: 16, padding: '10px 18px',
            minWidth: '0.7em', boxShadow: '0 14px 34px -16px rgba(255,221,0,.7)',
            animation: `va-cardPop .5s var(--ease-spring) both`, animationDelay: `${0.06 * i}s` }}>
            {ch}
          </span>
        ))}
      </button>
      <p style={{ marginTop: 14, fontSize: 13.5, color: T.onDarkMuted }}>
        En sus dispositivos: <span style={{ color: T.bg, fontWeight: 600 }}>vuela-abuela.vercel.app/?real</span>
        {' '}→ <span style={{ color: T.bg, fontWeight: 600 }}>Soy alumno</span> · {copied ? '¡copiado! ✓' : 'toca el código para copiar'}
      </p>
    </div>
  )
}

function Row({ title, sub, cta }: { title: string; sub: React.ReactNode; cta: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: T.bg, margin: 0 }}>{title}</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: T.onDarkSoft, maxWidth: 560 }}>{sub}</p>
      </div>
      <div>{cta}</div>
    </div>
  )
}

function RosterBoard() {
  const { transport, state } = useRoom()
  const students = Object.values(state!.students)

  function toggleOut(id: string) {
    const s = state!.students[id]
    transport.patch({ students: { ...state!.students, [id]: { ...s, markedOut: !s.markedOut } } })
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}><Eyebrow onDark>Roster &amp; progreso</Eyebrow></div>
      {students.length === 0 ? (
        <div style={{ ...darkPanel, textAlign: 'center', color: T.onDarkMuted }}>
          Aún no hay alumnos — comparte el código de sala.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {students.map((s) => (
            <StudentCard key={s.id} student={s} ready={isReady(state!, s)} onToggleOut={() => toggleOut(s.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function StudentCard({ student, ready, onToggleOut }:
  { student: Student; ready: boolean; onToggleOut: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const stuck = isStuck(student)
  const f = student.feedback

  const stuckShadow = '0 0 0 2px rgba(214,69,69,.5), inset 0 1px 0 rgba(255,255,255,.7), 0 14px 36px -22px rgba(0,0,0,.6)'

  return (
    <Surface hoverLift style={{ opacity: student.markedOut ? 0.5 : 1, ...(stuck ? { boxShadow: stuckShadow } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: T.ink }}>{student.name}</div>
          <div style={{ marginTop: 5 }}><PhaseDot phase={student.markedOut ? 'out' : student.phase} /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {ready && !student.markedOut && <Pill tone="ok">lista</Pill>}
          {stuck && (
            <span style={{ fontSize: 11, fontWeight: 700, color: T.errorText, background: '#FBE8E8',
              borderRadius: 999, padding: '3px 9px' }}>atascada</span>
          )}
          {student.markedOut && <Pill tone="neutral">fuera</Pill>}
        </div>
      </div>

      {/* STUB chip that EXPANDS into per-student feedback detail (§9B) */}
      <button onClick={() => setExpanded((e) => !e)} style={{
        marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        border: '1px dashed rgba(224,168,0,.5)', background: 'rgba(224,168,0,.1)', borderRadius: 10,
        padding: '7px 10px', cursor: 'pointer', color: T.amberHint, fontSize: 11.5, fontWeight: 600 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><StubBadge label="feedback" /> detalle</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div style={{ marginTop: 8, fontSize: 12, color: T.muted, display: 'grid', gap: 3 }}>
          <div style={{ color: f.appropriacyFails >= 2 ? T.errorText : T.muted, fontWeight: f.appropriacyFails >= 2 ? 700 : 400 }}>
            bloqueos de adecuación: {f.appropriacyFails}
          </div>
          <div>reintentos: {f.reenters}</div>
          <div style={{ color: f.correctionLoops >= 2 ? T.errorText : T.muted, fontWeight: f.correctionLoops >= 2 ? 700 : 400 }}>
            bucles de corrección: {f.correctionLoops}
          </div>
          {stuck && <div style={{ color: T.errorText, fontWeight: 700 }}>⟶ orientar a este alumno</div>}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button onClick={onToggleOut} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: 12, fontWeight: 500, color: T.muted, textDecoration: 'underline' }}>
          {student.markedOut ? 'reincorporar' : 'marcar fuera (rodear)'}
        </button>
      </div>
    </Surface>
  )
}
