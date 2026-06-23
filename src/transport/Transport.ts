// ============================================================================
// Transport — the big seam (§3). God-mode (in-memory pub/sub) now, Supabase
// Realtime later. All shared state is accessed ONLY through this interface, so
// swapping in Supabase touches no components.
// ============================================================================
import type {
  LessonConfig,
  PoemWord,
  RecordedAnswers,
  RoomCode,
  RoomState,
  StudentId,
  StudentPhase,
  Unsubscribe,
} from '../types'

export interface Transport {
  // session
  createRoom(config: LessonConfig): Promise<RoomCode>
  joinRoom(code: RoomCode, name: string): Promise<StudentId>

  // state sync (god-mode: in-memory pub/sub; supabase: realtime channels)
  subscribe(cb: (state: RoomState) => void): Unsubscribe
  patch(partial: Partial<RoomState>): Promise<void>

  // student actions
  submitInput(studentId: StudentId, promptId: string, value: string): Promise<void>
  setStudentPhase(studentId: StudentId, phase: StudentPhase): Promise<void>

  // pairing activation (presence handshake; faked in god-mode)
  holdToken(studentId: StudentId): Promise<void> // press-and-hold begin
  releaseToken(studentId: StudentId): Promise<void> // both holding within window => launch
  submitAnswers(studentId: StudentId, answers: RecordedAnswers): Promise<void>

  // waiting-game (communal poem):
  joinPoemPool(studentId: StudentId): Promise<void> // record pool join order (pyramid)
  addPoemWord(word: PoemWord): Promise<void> // append-only word contribution
  setPoemRegenerating(v: boolean): Promise<void> // claim/clear the re-weave (batch window)
  commitPoem(text: string, startWord: string, covered: number): Promise<void> // set text; cache opener; mark `covered` words woven
}
