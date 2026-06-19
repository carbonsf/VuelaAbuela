import { useEffect, useState } from 'react'
import { useRoom } from '../RoomContext'
import { Screen, Pill, StubBadge, T } from '../components/despegue'
import { GOD_MODE } from '../godmode/godmode'
import type { StudentId } from '../types'

// ACTIVATION (§6): find partner, press-and-hold the shared emoji. Mutual hold
// within a window launches ("Despegar"). Co-presence faked in god-mode, real
// under Supabase. Emoji shown only — the Spanish word is a teaching reveal.
export function ActivationScreen({ studentId }: { studentId: StudentId }) {
  const { transport, state } = useRoom()
  const group = state!.groups.find((g) => g.members.includes(studentId))
  const [holding, setHolding] = useState(false)

  useEffect(() => {
    const me = state!.students[studentId]
    if (me && me.phase !== 'activating' && me.phase !== 'conversing' && me.phase !== 'submitted') {
      transport.setStudentPhase(studentId, 'activating')
    }
  }, [state, studentId, transport])

  if (!group) {
    return (
      <Screen key="activation" maxWidth={440} style={{ paddingTop: 60, textAlign: 'center' }}>
        <p style={{ color: T.onDarkMuted }}>Esperando emparejamiento…</p>
      </Screen>
    )
  }

  const partners = group.members.filter((m) => m !== studentId)
  const holds = state!.holds
  const holdingCount = group.members.filter((m) => (holds[m] ?? 0) > 0).length
  const allHolding = holdingCount >= group.members.length

  function startHold() {
    setHolding(true)
    transport.holdToken(studentId)
    if (GOD_MODE && group) {
      window.setTimeout(() => {
        for (const m of group.members) if (m !== studentId) transport.holdToken(m)
      }, 350)
    }
  }
  function endHold() {
    setHolding(false)
    transport.releaseToken(studentId)
    if (GOD_MODE && group) {
      for (const m of group.members) if (m !== studentId) transport.releaseToken(m)
    }
  }

  return (
    <Screen key="activation" maxWidth={460} style={{ paddingTop: 28, textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 32, letterSpacing: '-.02em', color: T.bg, margin: 0 }}>
        Encuentra a tu pareja
      </h2>
      <p style={{ margin: '12px auto 0', maxWidth: 380, color: T.onDarkSoft, fontSize: 14.5 }}>
        Busca a quien tenga el mismo emoji en su pantalla. Los dos <strong style={{ color: T.bg }}>mantienen pulsado</strong> para despegar.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        <Pill tone="onDark">grupo {group.id}</Pill>
        {partners.map((p) => (
          <Pill key={p} tone="onDark">pareja: {state!.students[p]?.name ?? p}</Pill>
        ))}
        {group.members.length === 3 && <StubBadge label="trío" />}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 30 }}>
        <button
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={() => holding && endHold()}
          aria-label="Mantén pulsado para despegar"
          style={{
            width: 180, height: 180, borderRadius: '50%', cursor: 'pointer', userSelect: 'none',
            fontSize: 74, lineHeight: '180px',
            border: `4px solid ${holding ? T.yellow : 'rgba(255,255,255,.18)'}`,
            background: holding ? 'rgba(255,221,0,.14)' : 'rgba(250,251,248,.06)',
            transform: holding ? 'scale(.95)' : 'none',
            transition: 'transform .3s var(--ease-spring), border-color .3s var(--ease-glide), background .3s var(--ease-glide)',
            animation: holding ? 'va-ring 1.4s ease-out infinite' : undefined,
          }}>
          {group.token}
        </button>
      </div>

      <div style={{ marginTop: 20, fontSize: 14, fontWeight: 600 }}>
        {allHolding ? (
          <span style={{ color: T.yellow }}>Los dos sujetando — ¡Despegando! 🚀</span>
        ) : holding ? (
          <span style={{ color: T.onDarkSoft }}>Sujetando… esperando a tu pareja ({holdingCount}/{group.members.length})</span>
        ) : (
          <span style={{ color: T.onDarkMuted }}>Mantén pulsado el emoji</span>
        )}
      </div>

      {GOD_MODE && (
        <p style={{ marginTop: 16, fontSize: 12, color: T.onDarkMuted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <StubBadge label="god-mode" /> co-presencia de la pareja simulada al sujetar.
        </p>
      )}
      <p style={{ marginTop: 8, fontSize: 11, color: T.onDarkMuted }}>
        palabra del token (revelación didáctica): <strong>{group.tokenWord}</strong>
      </p>
    </Screen>
  )
}
