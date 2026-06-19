// ============================================================================
// Redistribution (§2.5): build one Frankenstein persona per student — one item
// per prompt slot, each sourced from a different random peer. A student never
// receives their own item back. Marked-out students are routed around.
// ============================================================================
import type { LessonConfig, Persona, RoomState, StudentId } from './types'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Returns active (joined, not marked-out) student ids whose inputs are complete.
 */
export function activeStudentIds(state: RoomState): StudentId[] {
  return Object.values(state.students)
    .filter((s) => !s.markedOut)
    .map((s) => s.id)
}

/**
 * Build a persona for each active student. For each slot, pick a value from a
 * peer (never self), preferring distinct peers across slots within one persona
 * so the result is genuinely Frankenstein.
 */
export function buildPersonas(
  state: RoomState,
  config: LessonConfig,
): Record<StudentId, Persona> {
  const recipients = activeStudentIds(state)
  const personas: Record<StudentId, Persona> = {}

  for (const recipient of recipients) {
    const slots: Record<string, string> = {}
    const usedSources = new Set<StudentId>()

    for (const prompt of config.prompts) {
      // candidate sources: anyone (active) who isn't the recipient and has a value
      const candidates = recipients.filter(
        (src) => src !== recipient && state.inputs[src]?.[prompt.id]?.value,
      )
      if (candidates.length === 0) continue

      // prefer a source not yet used in THIS persona for the Frankenstein effect
      const fresh = candidates.filter((src) => !usedSources.has(src))
      const pool = fresh.length > 0 ? fresh : candidates
      const source = shuffle(pool)[0]
      usedSources.add(source)
      slots[prompt.id] = state.inputs[source][prompt.id].value
    }

    personas[recipient] = { studentId: recipient, slots }
  }

  return personas
}
