// ============================================================================
// Strategy seams (§3). Each interface has a REAL impl now and a labeled STUB
// seam for the future swap. Swapping any of these must touch no components.
// ============================================================================
import { EMOJI_TOKENS } from './lesson/emojiTokens'
import type {
  Group,
  LessonConfig,
  Persona,
  Perspective,
  Question,
  ReviewRow,
  StudentId,
} from './types'

// ---- QuestionSource: global = REAL; ai-derived = STUB ----------------------
export interface QuestionSource {
  getQuestions(persona: Persona, config: LessonConfig): Question[]
}

export const GlobalQuestionSource: QuestionSource = {
  // REAL: the global, partner-facing question set straight from config.
  getQuestions(_persona, config) {
    return config.questions
  },
}

// STUB seam — AI-derived / AI-topped-off questions (§8). Same interface; would
// call the model to mint persona-specific questions. Not built this round.
export const AiDerivedQuestionSource: QuestionSource = {
  getQuestions(_persona, config) {
    // STUB: falls back to global set; real impl would augment via Claude.
    return config.questions
  },
}

// ---- PersonaTransform: identity = REAL; story-parse = STUB ------------------
export interface DisplayBlock {
  perspective: Perspective
  // ordered, human-readable lines describing the persona to convey
  lines: { slotId: string; label: string; value: string }[]
}

export interface PersonaTransform {
  render(persona: Persona, config: LessonConfig): DisplayBlock
}

export const IdentityPersonaTransform: PersonaTransform = {
  // REAL: render slots directly in prompt order. Perspective is carried for the
  // UI to frame the conveying instruction (sample = third-person).
  render(persona, config) {
    const lines = config.prompts
      .filter((p) => persona.slots[p.id] !== undefined)
      .map((p) => ({ slotId: p.id, label: p.labelL1, value: persona.slots[p.id] }))
    return { perspective: config.perspective, lines }
  },
}

// STUB seam — story-parse persona: turn slots into prose. Same interface.
export const StoryParsePersonaTransform: PersonaTransform = {
  render(persona, config) {
    // STUB: identity behavior for now.
    return IdentityPersonaTransform.render(persona, config)
  },
}

// ---- PairingStrategy: fixed-pairs = REAL; rotation = future ----------------
export interface PairingStrategy {
  pair(students: StudentId[]): Group[]
}

function pickTokens(n: number): { emoji: string; word: string }[] {
  const shuffled = [...EMOJI_TOKENS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

// REAL: fixed reciprocal pairs (group size 2). Odd-count handling lives upstream
// in redistribution (absorb / force-trio). The Group model already carries size
// 2|3 + a directed interviewGraph so trios (STUB) need no data-model rebuild.
export const FixedPairsStrategy: PairingStrategy = {
  pair(students) {
    const tokens = pickTokens(Math.ceil(students.length / 2))
    const groups: Group[] = []
    for (let i = 0; i < students.length; i += 2) {
      const members = students.slice(i, i + 2)
      const t = tokens[groups.length] ?? { emoji: '✈️', word: 'avión' }
      const interviewGraph: [StudentId, StudentId][] =
        members.length === 2
          ? [
              [members[0], members[1]],
              [members[1], members[0]],
            ]
          : // size 3 (STUB) — directed cycle, no data-model change required
            [
              [members[0], members[1]],
              [members[1], members[2]],
              [members[2], members[0]],
            ]
      groups.push({
        id: `g${groups.length + 1}`,
        members,
        token: t.emoji,
        tokenWord: t.word,
        interviewGraph,
      })
    }
    return groups
  },
}

// ---- Exporter: STUB seam; on-screen review is REAL -------------------------
export interface Exporter {
  export(results: ReviewRow[]): void
}

export const StubExporter: Exporter = {
  export(results) {
    // STUB: real impl would write CSV / push to gradebook. On-screen review (§9B) is the REAL path.
    // eslint-disable-next-line no-console
    console.info('[STUB Exporter] would export', results.length, 'rows')
  },
}

// ---- Identity: self-join = live; SSO/Google Classroom = future seam --------
export type Identity = { mode: 'self-join' }
export const IDENTITY: Identity = { mode: 'self-join' }
