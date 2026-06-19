// ============================================================================
// Transport — the big seam (§3). God-mode (in-memory pub/sub) now, Supabase
// Realtime later. All shared state is accessed ONLY through this interface, so
// swapping in Supabase touches no components.
// ============================================================================
import type {
  LessonConfig,
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
}
