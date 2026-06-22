// ============================================================================
// Data shapes (§4) + the shared RoomState that flows through Transport (§3).
// ============================================================================

export type RoomCode = string
export type StudentId = string
export type Unsubscribe = () => void

export type Perspective = 'first-person' | 'neighbor' | 'third-person'

export interface Prompt {
  id: string
  labelL1: string // English shown to student
  labelL2?: string // target-language label (optional)
  source: 'join' | 'phase1' // 'join' => name, pre-filled
  complexity: 'word' | 'phrase' | 'clause'
  example?: string
}

export interface Question {
  id: string
  text: string // target language, about PARTNER's persona
  targetSlotId: string // which persona slot it probes
  grammarTag?: 'preterite' | 'imperfect' | string
  partnerTag?: string // STUB: for trio per-partner-tagged questions
}

// Difficulty of the communal waiting-game poem (set in authoring).
export type PoemLevel = 'principiante' | 'intermedio' | 'avanzado'

export interface LessonConfig {
  language: string // 'es'
  grammarTarget: string // 'preterite-imperfect'
  perspective: Perspective // sample: 'third-person'
  correctionMode: 'point-then-reveal' // §5
  prompts: Prompt[] // includes the name prompt (source:'join')
  questions: Question[] // global set; partner-facing
  groupFallback: 'absorb' | 'force-trio' // odd count; default 'absorb'
  poemLevel?: PoemLevel // waiting-game poem difficulty; default 'principiante'
}

// One contribution to the communal waiting-game poem: a student's word and the
// Spanish line the model wove around it. Communal (not privacy-scoped).
export interface PoemEntry {
  word: string
  byStudentId: StudentId
  byName: string
  line: string
}

// slotId -> value
export interface Persona {
  studentId: StudentId
  slots: Record<string, string>
}

export type EmojiToken = string

export interface Group {
  id: string
  members: StudentId[] // size 2 (REAL) or 3 (STUB)
  token: EmojiToken // shared activation token (emoji shown; word is teaching reveal)
  tokenWord: string // Spanish word behind the emoji — retained for later reveal (§6)
  interviewGraph: [from: StudentId, to: StudentId][] // pair: A<->B; trio: directed cycle
}

export interface RecordedAnswers {
  aboutStudent: StudentId
  byStudent: StudentId
  answers: Record<string, string>
}

export interface ReviewRow {
  persona: Persona
  recorded: RecordedAnswers
}

// ----------------------------------------------------------------------------
// Validation return contract (§5)
// ----------------------------------------------------------------------------
export type ValidationResult =
  | { action: 'pass' }
  | { action: 'block'; reason: string } // appropriateness fail -> hard gate
  | { action: 'reenter'; reason: string } // doesn't fit prompt
  | { action: 'correct'; hint: string; answer?: string } // grammar; point-then-reveal

// ----------------------------------------------------------------------------
// State machine (§7)
// ----------------------------------------------------------------------------
export type ActivityState =
  | 'LOBBY'
  | 'INPUT'
  | 'READY_GATE'
  | 'HANDOFF'
  | 'ACTIVATION'
  | 'CONVERSATION'
  | 'SUBMITTED'
  | 'REVIEW'

export type StudentPhase =
  | 'joined'
  | 'filling'
  | 'validating'
  | 'passed'
  | 'waiting'
  | 'activating'
  | 'conversing'
  | 'submitted'

export interface InputCell {
  value: string
  status: 'empty' | 'pending' | 'passed'
}

// Signals surfaced to the teacher monitor / stuck-signal (§9).
export interface FeedbackStat {
  appropriacyFails: number
  reenters: number
  correctionLoops: number
}

export interface Student {
  id: StudentId
  name: string
  phase: StudentPhase
  joinedAt: number
  markedOut: boolean
  feedback: FeedbackStat
}

export interface RoomState {
  code: RoomCode
  config: LessonConfig
  activity: ActivityState
  students: Record<StudentId, Student>
  // submitted phase-1 inputs: studentId -> promptId -> cell
  inputs: Record<StudentId, Record<string, InputCell>>
  personas: Record<StudentId, Persona>
  groups: Group[]
  holds: Record<StudentId, number> // studentId -> timestamp of current press-and-hold (0 = released)
  launched: Record<string, boolean> // groupId -> has launched
  recorded: Record<StudentId, RecordedAnswers> // byStudent -> recorded answers
  poem: PoemEntry[] // communal waiting-game poem, in contribution order
}
