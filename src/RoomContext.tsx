import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { GodModeTransport } from './transport/GodModeTransport'
import { PartyTransport } from './transport/PartyTransport'
import type { Transport } from './transport/Transport'
import { GOD_MODE } from './godmode/godmode'
import { SAMPLE_LESSON } from './lesson/sampleLesson'
import type { RoomState } from './types'

interface RoomContextValue {
  transport: Transport
  state: RoomState | null
}

const RoomContext = createContext<RoomContextValue | null>(null)

// One transport instance behind the seam (§3). God-mode uses the in-memory
// pub/sub and auto-creates the shared room; real mode uses PartyTransport and
// defers create/join to the session-entry flow (teacher creates, student joins).
export function RoomProvider({ children }: { children: ReactNode }) {
  const transport = useMemo<Transport>(() => (GOD_MODE ? new GodModeTransport() : new PartyTransport()), [])
  const [state, setState] = useState<RoomState | null>(null)

  useEffect(() => {
    const unsub = transport.subscribe(setState)
    if (GOD_MODE) transport.createRoom(SAMPLE_LESSON)
    return () => unsub()
  }, [transport])

  const value = useMemo(() => ({ transport, state }), [transport, state])
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

export function useRoom() {
  const ctx = useContext(RoomContext)
  if (!ctx) throw new Error('useRoom must be used within RoomProvider')
  return ctx
}
