import { useEffect, useState } from 'react'
import { useRoom } from '../RoomContext'
import { Screen, Surface, Button, Wordmark, HeroTitle, Eyebrow, T } from '../components/despegue'

// LOBBY (§7): self-join with party code + name. Name IS a distributable item
// (§2.2) — collected here, shown static after, never re-asked.
export function JoinScreen({ onJoined }: { onJoined: (studentId: string) => void }) {
  const { transport, state } = useRoom()
  const [code, setCode] = useState('')
  const [touchedCode, setTouchedCode] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const roomCode = state?.code ?? ''

  // The room is created async, so state is null at mount. Once it arrives,
  // prefill the code for convenience — unless the student has started typing.
  useEffect(() => {
    if (roomCode && !touchedCode && code === '') setCode(roomCode)
  }, [roomCode, touchedCode, code])

  async function submit() {
    setError('')
    if (code.trim().toUpperCase() !== roomCode) {
      setError('Ese código no coincide con ninguna sala.')
      return
    }
    if (name.trim().length < 1) {
      setError('Escribe tu nombre.')
      return
    }
    setBusy(true)
    const id = await transport.joinRoom(roomCode, name.trim())
    setBusy(false)
    onJoined(id)
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const, background: '#fff',
    border: `1.5px solid ${T.border}`, borderRadius: 'var(--radius-box)', padding: '12px 14px',
    fontFamily: 'var(--font-sans)', fontSize: 16, color: T.ink, outline: 'none', marginTop: 6,
  }

  return (
    <Screen key="join" maxWidth={460} style={{ paddingTop: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <Wordmark size={26} />
      </div>
      <Surface style={{ padding: 26 }}>
        <HeroTitle lines={['Únete', 'y despega']} size={34} />
        <p style={{ margin: '12px 0 0', color: T.muted, fontSize: 14.5 }}>
          Entra en la clase y conoce a un desconocido que inventarán juntos.
        </p>

        <div style={{ marginTop: 22, display: 'grid', gap: 16, textAlign: 'left' }}>
          <label>
            <Eyebrow>Código de sala</Eyebrow>
            <input
              value={code}
              onChange={(e) => { setTouchedCode(true); setCode(e.target.value.toUpperCase()) }}
              placeholder="ABCD" maxLength={6}
              style={{ ...inputStyle, fontFamily: 'var(--font-display)', fontWeight: 700,
                letterSpacing: '.3em', textTransform: 'uppercase' }}
            />
          </label>
          <label>
            <Eyebrow>Tu nombre</Eyebrow>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="p. ej. Marisol"
              style={inputStyle}
            />
          </label>
          {error && <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: T.errorText }}>{error}</p>}
          <Button onClick={submit} disabled={busy} style={{ width: '100%', fontSize: 16, padding: '14px 22px' }}>
            {busy ? 'Uniéndose…' : 'Despegar — Unirse'}
          </Button>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 12, color: T.muted }}>
            Sala <span style={{ fontWeight: 700, color: T.green700 }}>{roomCode}</span> · auto-registro (SSO después)
          </p>
        </div>
      </Surface>
    </Screen>
  )
}
