import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { GodModeTransport } from './transport/GodModeTransport'
import type { Transport } from './transport/Transport'
import { SAMPLE_LESSON } from './lesson/sampleLesson'
import type { RoomState } from './types'

interface RoomContextValue {
  transport: Transport
  state: RoomState | null
}

const RoomContext = createContext<RoomContextValue | null>(null)

// Single transport instance for the prototype. Swap GodModeTransport for a
// SupabaseTransport here and nothing else changes (§3).
export function RoomProvider({ children }: { children: ReactNode }) {
  const transport = useMemo(() => new GodModeTransport(), [])
  const [state, setState] = useState<RoomState | null>(null)

  useEffect(() => {
    let unsub = () => {}
    transport.createRoom(SAMPLE_LESSON).then(() => {
      unsub = transport.subscribe(setState)
    })
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
