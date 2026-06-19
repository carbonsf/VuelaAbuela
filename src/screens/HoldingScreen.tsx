import { useRoom } from '../RoomContext'
import { Screen, ProgressArc, Pill, Wordmark, StubBadge, T } from '../components/despegue'

// Holding / early-finisher screen (§10). Fills dead air between passing
// validation and handoff (and post-submit). REAL "x of y ready" arc; STUB game.
export function HoldingScreen({ context = 'ready' }: { context?: 'ready' | 'submitted' }) {
  const { state } = useRoom()
  const students = Object.values(state!.students).filter((s) => !s.markedOut)
  const total = students.length

  const readyCount =
    context === 'ready'
      ? students.filter((s) => ['passed', 'waiting', 'activating', 'conversing', 'submitted'].includes(s.phase)).length
      : students.filter((s) => s.phase === 'submitted').length

  return (
    <Screen key="holding" maxWidth={520} style={{ paddingTop: 36, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
        <Wordmark size={22} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <ProgressArc value={readyCount} total={total} size={132}
          label={context === 'ready' ? 'listos' : 'enviados'} />
      </div>
      <p style={{ marginTop: 6, color: T.onDarkSoft, fontWeight: 600 }}>
        {context === 'ready' ? 'pilotos listos para despegar' : 'entrevistas enviadas'}
      </p>

      {/* STUB: the holding game lives here (§10) */}
      <div style={{ position: 'relative', marginTop: 22, borderRadius: 'var(--radius-card)',
        border: '1px dashed rgba(255,221,0,.4)', background: 'rgba(250,251,248,.05)', padding: 26 }}>
        <div style={{ position: 'absolute', top: 12, right: 12 }}><StubBadge label="juego de espera" /></div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: T.bg }}>Sala de espera</div>
        <p style={{ margin: '8px auto 0', maxWidth: 360, fontSize: 13.5, color: T.onDarkMuted }}>
          Futuro: un juego comunal y rápido de palabras que arma un poema de la clase y llena un medidor.
          Por ahora, el contador de arriba es la señal real.
        </p>
        <div style={{ margin: '16px auto 0', height: 8, width: '66%', borderRadius: 999, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: 'var(--color-yellow-500)',
            width: `${total ? (readyCount / total) * 100 : 0}%`, transition: 'width .6s var(--ease-glide)' }} />
        </div>
      </div>

      <p style={{ marginTop: 18, fontSize: 13.5, color: T.onDarkMuted }}>
        {context === 'ready' ? (
          'Esperando a que tu profe lance el reparto…'
        ) : (
          <>Buen trabajo — tu entrevista está enviada. <Pill tone="ok">enviado ✓</Pill></>
        )}
      </p>
    </Screen>
  )
}
