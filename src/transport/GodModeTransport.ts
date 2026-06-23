// ============================================================================
// GodModeTransport — in-memory pub/sub implementation of Transport (§3, §1).
// Fakes multi-user: one instance, one RoomState, every view reads the same
// state. Supabase Realtime is the other impl and plugs in behind the same seam.
// ============================================================================
import type {
  LessonConfig,
  PoemWord,
  RecordedAnswers,
  RoomCode,
  RoomState,
  Student,
  StudentId,
  StudentPhase,
  Unsubscribe,
} from '../types'
import type { Transport } from './Transport'

// Window within which all members of a group must be holding for a launch (§6).
const LAUNCH_WINDOW_MS = 1500

let studentSeq = 0

function makeStudent(name: string): Student {
  studentSeq += 1
  return {
    id: `s${studentSeq}`,
    name,
    phase: 'joined',
    joinedAt: Date.now(),
    markedOut: false,
    feedback: { appropriacyFails: 0, reenters: 0, correctionLoops: 0 },
  }
}

export class GodModeTransport implements Transport {
  private state: RoomState | null = null
  private subs = new Set<(s: RoomState) => void>()

  private emit() {
    if (!this.state) return
    // hand out a shallow copy so React sees a new reference each tick
    const snapshot = { ...this.state }
    this.subs.forEach((cb) => cb(snapshot))
  }

  async createRoom(config: LessonConfig): Promise<RoomCode> {
    const code = genCode()
    this.state = {
      code,
      config,
      activity: 'LOBBY',
      students: {},
      inputs: {},
      personas: {},
      groups: [],
      holds: {},
      launched: {},
      recorded: {},
      poem: { pool: [], words: [], text: '', startCache: [], gen: 0, committed: 0, regenerating: false },
    }
    this.emit()
    return code
  }

  async joinRoom(_code: RoomCode, name: string): Promise<StudentId> {
    if (!this.state) throw new Error('no room')
    const student = makeStudent(name)
    this.state.students[student.id] = student
    // name IS a distributable item (§2.2): pre-fill the join-sourced prompt.
    this.state.inputs[student.id] = {
      name: { value: name, status: 'passed' },
    }
    this.emit()
    return student.id
  }

  subscribe(cb: (state: RoomState) => void): Unsubscribe {
    this.subs.add(cb)
    if (this.state) cb({ ...this.state })
    return () => this.subs.delete(cb)
  }

  async patch(partial: Partial<RoomState>): Promise<void> {
    if (!this.state) return
    this.state = { ...this.state, ...partial }
    this.emit()
  }

  async submitInput(studentId: StudentId, promptId: string, value: string): Promise<void> {
    if (!this.state) return
    const cells = this.state.inputs[studentId] ?? {}
    cells[promptId] = { value, status: 'passed' }
    this.state.inputs[studentId] = cells
    this.emit()
  }

  async setStudentPhase(studentId: StudentId, phase: StudentPhase): Promise<void> {
    if (!this.state) return
    const s = this.state.students[studentId]
    if (!s) return
    this.state.students[studentId] = { ...s, phase }
    this.emit()
  }

  async holdToken(studentId: StudentId): Promise<void> {
    if (!this.state) return
    this.state.holds = { ...this.state.holds, [studentId]: Date.now() }
    this.evaluateLaunches()
    this.emit()
  }

  async releaseToken(studentId: StudentId): Promise<void> {
    if (!this.state) return
    this.state.holds = { ...this.state.holds, [studentId]: 0 }
    this.emit()
  }

  async submitAnswers(studentId: StudentId, answers: RecordedAnswers): Promise<void> {
    if (!this.state) return
    this.state.recorded = { ...this.state.recorded, [studentId]: answers }
    const s = this.state.students[studentId]
    if (s) this.state.students[studentId] = { ...s, phase: 'submitted' }
    this.emit()
  }

  async joinPoemPool(studentId: StudentId): Promise<void> {
    if (!this.state) return
    if (this.state.poem.pool.includes(studentId)) return
    this.state.poem = { ...this.state.poem, pool: [...this.state.poem.pool, studentId] }
    this.emit()
  }

  async addPoemWord(word: PoemWord): Promise<void> {
    if (!this.state) return
    this.state.poem = { ...this.state.poem, words: [...this.state.poem.words, word] }
    this.emit()
  }

  async setPoemRegenerating(v: boolean): Promise<void> {
    if (!this.state) return
    this.state.poem = { ...this.state.poem, regenerating: v }
    this.emit()
  }

  async commitPoem(text: string, startWord: string, covered: number): Promise<void> {
    if (!this.state) return
    const startCache = [...this.state.poem.startCache, startWord].slice(-15)
    this.state.poem = { ...this.state.poem, text, startCache, gen: this.state.poem.gen + 1, committed: covered, regenerating: false }
    this.emit()
  }

  // ---- presence handshake: launch when all members hold within window (§6) ---
  private evaluateLaunches() {
    if (!this.state) return
    const now = Date.now()
    for (const g of this.state.groups) {
      if (this.state.launched[g.id]) continue
      const holdsForGroup = g.members.map((m) => this.state!.holds[m] ?? 0)
      const allHolding = holdsForGroup.every((t) => t > 0 && now - t <= LAUNCH_WINDOW_MS)
      if (allHolding) {
        this.state.launched = { ...this.state.launched, [g.id]: true }
        for (const m of g.members) {
          const s = this.state.students[m]
          if (s) this.state.students[m] = { ...s, phase: 'conversing' }
        }
      }
    }
  }
}

function genCode(): RoomCode {
  // teacher-friendly, unambiguous code (no O/0/I/1)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}
