// ============================================================================
// HANDOFF (§2.4–2.6, §7): redistribute + pair. Routes around marked-out
// students, resolves odd count (absorb default / force-trio fallback), builds
// Frankenstein personas (never own item), assigns fixed pairs with emoji tokens.
// ============================================================================
import { EMOJI_TOKENS } from '../lesson/emojiTokens'
import { buildPersonas } from '../redistribution'
import { FixedPairsStrategy } from '../seams'
import type { Transport } from '../transport/Transport'
import type { Group, InputCell, LessonConfig, RoomState, Student, StudentId } from '../types'

function shuffle<T>(a: T[]): T[] {
  const arr = [...a]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Absorb (§6): teacher joins as a player to keep clean reciprocal pairs. The
// teacher-player gets example-filled inputs so it's a valid source/recipient,
// and shows up as its own device in god-mode.
function makeTeacherPlayer(config: LessonConfig): { student: Student; inputs: Record<string, InputCell> } {
  const student: Student = {
    id: 'teacher-player',
    name: 'Profe (you)',
    phase: 'passed',
    joinedAt: Date.now(),
    markedOut: false,
    feedback: { appropriacyFails: 0, reenters: 0, correctionLoops: 0 },
  }
  const inputs: Record<string, InputCell> = {}
  for (const p of config.prompts) {
    inputs[p.id] = { value: p.id === 'name' ? 'Profe' : p.example ?? '—', status: 'passed' }
  }
  return { student, inputs }
}

export interface HandoffOptions {
  fallback: 'absorb' | 'force-trio'
}

export async function runHandoff(transport: Transport, state: RoomState, opts: HandoffOptions) {
  const config = state.config
  let students = { ...state.students }
  let inputs = { ...state.inputs }

  let active = Object.values(students)
    .filter((s) => !s.markedOut)
    .map((s) => s.id)

  let trioGroup: Group | null = null

  if (active.length % 2 === 1) {
    if (opts.fallback === 'absorb') {
      const tp = makeTeacherPlayer(config)
      students = { ...students, [tp.student.id]: tp.student }
      inputs = { ...inputs, [tp.student.id]: tp.inputs }
      active = [...active, tp.student.id]
    }
    // force-trio handled below by peeling 3 members into a trio (STUB seam)
  }

  // augmented state for persona building
  const augmented: RoomState = { ...state, students, inputs }
  const personas = buildPersonas(augmented, config)

  let pairPool = shuffle(active)
  if (active.length % 2 === 1 && opts.fallback === 'force-trio') {
    // STUB seam: peel the last 3 into a directed-cycle trio so no data-model rebuild.
    const trioMembers = pairPool.slice(-3)
    pairPool = pairPool.slice(0, -3)
    const t = EMOJI_TOKENS[Math.floor(Math.random() * EMOJI_TOKENS.length)]
    trioGroup = {
      id: 'g-trio',
      members: trioMembers,
      token: t.emoji,
      tokenWord: t.word,
      interviewGraph: [
        [trioMembers[0], trioMembers[1]],
        [trioMembers[1], trioMembers[2]],
        [trioMembers[2], trioMembers[0]],
      ],
    }
  }

  const groups = FixedPairsStrategy.pair(pairPool)
  if (trioGroup) groups.push(trioGroup)

  // route everyone in a group into ACTIVATION
  const grouped = new Set<StudentId>(groups.flatMap((g) => g.members))
  const nextStudents: Record<StudentId, Student> = { ...students }
  for (const id of grouped) {
    nextStudents[id] = { ...nextStudents[id], phase: 'activating' }
  }

  // Land in HANDOFF so the Reparto shuffle set-piece plays; the teacher then
  // advances to ACTIVATION ("Ir a la conversación").
  await transport.patch({
    students: nextStudents,
    inputs,
    personas,
    groups,
    activity: 'HANDOFF',
    holds: {},
    launched: {},
  })
}
