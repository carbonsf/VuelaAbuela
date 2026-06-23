// ============================================================================
// PartyServer backend (Cloudflare Workers + Durable Objects) — the REAL
// transport. One DO instance ("Room") per room code holds authoritative
// RoomState; every outbound snapshot is scoped per viewer via projectStateFor
// so a student never receives another student's answers. Deployed to your own
// Cloudflare account with `wrangler deploy` (lands on *.workers.dev).
//
// Wire protocol (JSON), client <-> server:
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
import { Server, routePartykitRequest } from 'partyserver'
import type { Connection, ConnectionContext, WSMessage } from 'partyserver'
import { projectStateFor, type Viewer } from '../src/transport/projectState'
import type {
  LessonConfig, PoemWord, RecordedAnswers, RoomState, Student, StudentPhase,
} from '../src/types'

const LAUNCH_WINDOW_MS = 1500

interface Env {
  Room: DurableObjectNamespace<Room>
}

export class Room extends Server<Env> {
  // keep the DO warm (and in-memory state intact) while a class is in session
  static options = { hibernate: false }

  private state: RoomState | null = null
  private seq = 0
  private viewers = new Map<string, Viewer>() // connection id -> who they are

  onConnect(conn: Connection, ctx: ConnectionContext) {
    const role = new URL(ctx.request.url).searchParams.get('role')
    if (role === 'teacher') this.viewers.set(conn.id, { role: 'teacher' })
    // students get an identity on 'join'; until then they receive nothing.
    this.sendStateTo(conn)
  }

  onClose(conn: Connection) {
    this.viewers.delete(conn.id)
  }

  onMessage(conn: Connection, raw: WSMessage) {
    let msg: any
    try { msg = JSON.parse(raw as string) } catch { return }

    switch (msg.type) {
      case 'init':
        this.state = this.initRoom(msg.config as LessonConfig)
        break
      case 'join': {
        if (!this.state) break
        const student = this.makeStudent(String(msg.name ?? ''))
        this.state.students[student.id] = student
        this.state.inputs[student.id] = { name: { value: student.name, status: 'passed' } }
        this.viewers.set(conn.id, { role: 'student', id: student.id })
        conn.send(JSON.stringify({ type: 'joined', studentId: student.id }))
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
      case 'joinPoemPool': {
        if (!this.state) break
        if (!this.state.poem.pool.includes(msg.studentId)) {
          this.state.poem = { ...this.state.poem, pool: [...this.state.poem.pool, msg.studentId] }
        }
        break
      }
      case 'addPoemWord': {
        if (!this.state) break
        this.state.poem = { ...this.state.poem, words: [...this.state.poem.words, msg.word as PoemWord] }
        break
      }
      case 'setPoemRegenerating': {
        if (!this.state) break
        this.state.poem = { ...this.state.poem, regenerating: !!msg.value }
        break
      }
      case 'commitPoem': {
        if (!this.state) break
        const startCache = [...this.state.poem.startCache, String(msg.startWord)].slice(-15)
        this.state.poem = {
          ...this.state.poem, text: String(msg.text), startCache,
          gen: this.state.poem.gen + 1, committed: Number(msg.covered) || this.state.poem.words.length,
          regenerating: false,
        }
        break
      }
      default:
        return
    }
    this.broadcastState()
  }

  // ---- helpers ----
  private initRoom(config: LessonConfig): RoomState {
    return {
      code: this.name, // the DO name IS the room code
      config,
      activity: 'LOBBY',
      students: {}, inputs: {}, personas: {}, groups: [],
      holds: {}, launched: {}, recorded: {},
      poem: { pool: [], words: [], text: '', startCache: [], gen: 0, committed: 0, regenerating: false },
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

  private sendStateTo(conn: Connection) {
    if (!this.state) return
    const viewer = this.viewers.get(conn.id) ?? { role: 'student', id: '__pending__' }
    conn.send(JSON.stringify({ type: 'state', state: projectStateFor(this.state, viewer) }))
  }

  private broadcastState() {
    for (const conn of this.getConnections()) this.sendStateTo(conn)
  }
}

// Worker entry — route /parties/room/:code to the Room DO. A plain GET to the
// root just confirms the worker is alive (the app talks over /parties/... WS).
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const routed = await routePartykitRequest(request, env)
    if (routed) return routed
    if (new URL(request.url).pathname === '/') {
      return new Response('VuelaAbuela realtime backend — OK. (Connect over /parties/room/:code)', {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }
    return new Response('Not found', { status: 404 })
  },
}
