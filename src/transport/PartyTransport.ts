// ============================================================================
// PartyTransport — the REAL Transport (§3) over a PartyServer Durable Object.
// One socket per device/identity: a teacher device connects with role=teacher
// and creates the room; a student device joins and is assigned a studentId.
// Incoming state snapshots are already privacy-scoped by the server, so a
// student literally never receives another student's answers over the wire.
// ============================================================================
import { PartySocket } from 'partysocket'
import type { Transport } from './Transport'
import type {
  LessonConfig, PoemEntry, RecordedAnswers, RoomCode, RoomState, StudentId, StudentPhase, Unsubscribe,
} from '../types'

const HOST = (import.meta.env.VITE_PARTYKIT_HOST as string | undefined) ?? ''
const JOIN_TIMEOUT_MS = 6000

// teacher-friendly room code (no O/0/I/1) — matches GodModeTransport's scheme.
function genCode(): RoomCode {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

export class PartyTransport implements Transport {
  private socket: PartySocket | null = null
  private subs = new Set<(s: RoomState) => void>()
  private last: RoomState | null = null
  private pendingJoin: ((id: StudentId) => void) | null = null

  private connect(room: string, role: 'teacher' | 'student') {
    const socket = new PartySocket({ host: HOST, party: 'room', room, query: { role } })
    socket.addEventListener('message', (e) => {
      let msg: any
      try { msg = JSON.parse(e.data) } catch { return }
      if (msg.type === 'state') {
        this.last = msg.state
        this.subs.forEach((cb) => cb(msg.state))
      } else if (msg.type === 'joined') {
        this.pendingJoin?.(msg.studentId)
        this.pendingJoin = null
      }
    })
    this.socket = socket
    return socket
  }

  private waitOpen(sock: PartySocket): Promise<void> {
    return new Promise((resolve) => {
      if (sock.readyState === sock.OPEN) return resolve()
      sock.addEventListener('open', () => resolve(), { once: true })
    })
  }

  private send(obj: unknown) {
    this.socket?.send(JSON.stringify(obj))
  }

  async createRoom(config: LessonConfig): Promise<RoomCode> {
    const code = genCode()
    const sock = this.connect(code, 'teacher')
    await this.waitOpen(sock)
    this.send({ type: 'init', config })
    return code
  }

  async joinRoom(code: RoomCode, name: string): Promise<StudentId> {
    const sock = this.connect(code.toUpperCase(), 'student')
    await this.waitOpen(sock)
    const joined = new Promise<StudentId>((resolve) => { this.pendingJoin = resolve })
    this.send({ type: 'join', name })
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('join-timeout')), JOIN_TIMEOUT_MS))
    return Promise.race([joined, timeout])
  }

  subscribe(cb: (state: RoomState) => void): Unsubscribe {
    this.subs.add(cb)
    if (this.last) cb(this.last)
    return () => this.subs.delete(cb)
  }

  async patch(partial: Partial<RoomState>): Promise<void> {
    this.send({ type: 'patch', partial })
  }

  async submitInput(studentId: StudentId, promptId: string, value: string): Promise<void> {
    this.send({ type: 'submitInput', studentId, promptId, value })
  }

  async setStudentPhase(studentId: StudentId, phase: StudentPhase): Promise<void> {
    this.send({ type: 'setPhase', studentId, phase })
  }

  async holdToken(studentId: StudentId): Promise<void> {
    this.send({ type: 'hold', studentId })
  }

  async releaseToken(studentId: StudentId): Promise<void> {
    this.send({ type: 'release', studentId })
  }

  async submitAnswers(studentId: StudentId, answers: RecordedAnswers): Promise<void> {
    this.send({ type: 'submitAnswers', studentId, answers })
  }

  async addPoemEntry(entry: PoemEntry): Promise<void> {
    this.send({ type: 'addPoemEntry', entry })
  }
}
