// ============================================================================
// PartyKit server — the REAL transport backend (one "party" per room code, a
// Cloudflare Durable Object holding authoritative RoomState). Mirrors the logic
// of GodModeTransport, but here every outbound snapshot is scoped per viewer via
// projectStateFor so a student never receives another student's answers.
//
// Wire protocol (client <-> server), all JSON:
//   client -> { type:'init', config }                  teacher creates the room
//           | { type:'join', name }                    student joins
//           | { type:'patch', partial }
//           | { type:'submitInput', studentId, promptId, value }
//           | { type:'setPhase', studentId, phase }
//           | { type:'hold', studentId } | { type:'release', studentId }
//           | { type:'submitAnswers', studentId, answers }
//   server -> { type:'state', state }                  scoped snapshot (push)
//           | { type:'joined', studentId }             reply to join
// ============================================================================
import type * as Party from 'partykit/server'
import { projectStateFor, type Viewer } from '../src/transport/projectState'
import type {
  LessonConfig, RecordedAnswers, RoomState, Student, StudentId, StudentPhase,
} from '../src/types'

const LAUNCH_WINDOW_MS = 1500

export default class RoomServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  // in-memory authoritative state (lives as long as the Durable Object is warm)
  private state: RoomState | null = null
  private seq = 0
  private viewers = new Map<string, Viewer>() // connection id -> who they are

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const role = new URL(ctx.request.url).searchParams.get('role')
    if (role === 'teacher') this.viewers.set(conn.id, { role: 'teacher' })
    // students are assigned an identity on 'join'; until then they see nothing.
    this.sendStateTo(conn)
  }

  onClose(conn: Party.Connection) {
    this.viewers.delete(conn.id)
  }

  onMessage(raw: string, sender: Party.Connection) {
    let msg: any
    try { msg = JSON.parse(raw) } catch { return }

    switch (msg.type) {
      case 'init':
        this.state = this.initRoom(msg.config as LessonConfig)
        break
      case 'join': {
        if (!this.state) break
        const student = this.makeStudent(String(msg.name ?? ''))
        this.state.students[student.id] = student
        this.state.inputs[student.id] = { name: { value: student.name, status: 'passed' } }
        this.viewers.set(sender.id, { role: 'student', id: student.id })
        sender.send(JSON.stringify({ type: 'joined', studentId: student.id }))
        break
      }
      case 'patch':
        if (this.state) this.state = { ...this.state, ...msg.partial }
        break
      case 'submitInput': {
        if (!this.state) break
        const cells = this.state.inputs[msg.studentId] ?? {}
        cells[msg.promptId] = { value: msg.value, status: 'passed' }
        this.state.inputs[msg.studentId] = cells
        break
      }
      case 'setPhase': {
        if (!this.state) break
        const s = this.state.students[msg.studentId]
        if (s) this.state.students[msg.studentId] = { ...s, phase: msg.phase as StudentPhase }
        break
      }
      case 'hold': {
        if (!this.state) break
        this.state.holds = { ...this.state.holds, [msg.studentId]: Date.now() }
        this.evaluateLaunches()
        break
      }
      case 'release': {
        if (!this.state) break
        this.state.holds = { ...this.state.holds, [msg.studentId]: 0 }
        break
      }
      case 'submitAnswers': {
        if (!this.state) break
        this.state.recorded = { ...this.state.recorded, [msg.studentId]: msg.answers as RecordedAnswers }
        const s = this.state.students[msg.studentId]
        if (s) this.state.students[msg.studentId] = { ...s, phase: 'submitted' }
        break
      }
      default:
        return
    }
    this.broadcast()
  }

  // ---- helpers ----
  private initRoom(config: LessonConfig): RoomState {
    return {
      code: this.room.id, // the party id IS the room code
      config,
      activity: 'LOBBY',
      students: {},
      inputs: {},
      personas: {},
      groups: [],
      holds: {},
      launched: {},
      recorded: {},
    }
  }

  private makeStudent(name: string): Student {
    this.seq += 1
    return {
      id: `s${this.seq}`,
      name,
      phase: 'joined',
      joinedAt: Date.now(),
      markedOut: false,
      feedback: { appropriacyFails: 0, reenters: 0, correctionLoops: 0 },
    }
  }

  // launch a group once every member is holding within the window (§6)
  private evaluateLaunches() {
    if (!this.state) return
    const now = Date.now()
    for (const g of this.state.groups) {
      if (this.state.launched[g.id]) continue
      const allHolding = g.members.every((m) => {
        const t = this.state!.holds[m] ?? 0
        return t > 0 && now - t <= LAUNCH_WINDOW_MS
      })
      if (allHolding) {
        this.state.launched = { ...this.state.launched, [g.id]: true }
        for (const m of g.members) {
          const s = this.state.students[m]
          if (s) this.state.students[m] = { ...s, phase: 'conversing' }
        }
      }
    }
  }

  private sendStateTo(conn: Party.Connection) {
    if (!this.state) return
    const viewer = this.viewers.get(conn.id) ?? { role: 'student', id: '__pending__' }
    conn.send(JSON.stringify({ type: 'state', state: projectStateFor(this.state, viewer) }))
  }

  private broadcast() {
    for (const conn of this.room.getConnections()) this.sendStateTo(conn)
  }
}
