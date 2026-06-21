// ============================================================================
// State projection (privacy seam). The PartyKit server holds the FULL RoomState
// but must never send one student another student's answers. projectStateFor()
// returns the slice a given viewer is allowed to receive:
//
//   teacher  -> everything (the dashboard is the only "see all answers" screen).
//   student  -> only their OWN inputs, persona, and recorded answers, plus only
//               the group they belong to. Names/phases (the roster) and the
//               activity phase are not answer data, so they stay visible.
//
// Used server-side to scope every outbound snapshot; also safe to apply
// client-side as defense-in-depth.
// ============================================================================
import type { RoomState, StudentId } from '../types'

export type Viewer = { role: 'teacher' } | { role: 'student'; id: StudentId }

export function projectStateFor(state: RoomState, viewer: Viewer): RoomState {
  if (viewer.role === 'teacher') return state

  const me = viewer.id
  const ownInputs = state.inputs[me] ? { [me]: state.inputs[me] } : {}
  const ownPersona = state.personas[me] ? { [me]: state.personas[me] } : {}
  const ownRecorded = state.recorded[me] ? { [me]: state.recorded[me] } : {}
  // only the group this student is in (don't leak the full pairing graph)
  const ownGroups = state.groups.filter((g) => g.members.includes(me))

  return {
    ...state,
    inputs: ownInputs,
    personas: ownPersona,
    recorded: ownRecorded,
    groups: ownGroups,
  }
}
