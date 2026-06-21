// ============================================================================
// GOD-MODE harness (§1) — isolated dev module, removable via this single flag.
// Fakes multi-user by letting one operator switch between every student screen
// and the teacher dashboard against one shared transport.
//
// Set GOD_MODE = false to ship a single-device build with no harness.
// ============================================================================
import type { Transport } from '../transport/Transport'
import type { RoomState } from '../types'

// Default: god-mode (single-browser harness, in-memory transport). Set
// VITE_GOD_MODE=false to run the REAL PartyKit multi-device flow (teacher
// creates a room, students join from their own devices).
export const GOD_MODE = import.meta.env.VITE_GOD_MODE !== 'false'

export const SAMPLE_NAMES = [
  'Marisol',
  'Diego',
  'Lucía',
  'Mateo',
  'Sofía',
  'Javier',
  'Camila',
  'Andrés',
  'Valentina',
  'Tomás',
]

// Fast-forward helper: fill every joined student's phase-1 inputs from the prompt
// examples and mark them passed — jumps the room to an all-ready state for demos.
export async function autofillAndPass(transport: Transport, state: RoomState) {
  const phase1 = state.config.prompts.filter((p) => p.source === 'phase1')
  for (const s of Object.values(state.students)) {
    if (s.markedOut) continue
    for (const p of phase1) {
      await transport.submitInput(s.id, p.id, p.example ?? 'algo')
    }
    await transport.setStudentPhase(s.id, 'passed')
  }
}
