// Shapes the post-redistribution RoomState into the view model the Reparto
// shuffle set-piece consumes (NewPersona[] + pairing strings). Pure selector —
// no logic change; just presentation mapping for the §10 handoff moment.
import type { NewPersona } from './components/despegue'
import { SAMPLE_DOTS } from './components/despegue'
import type { RoomState } from './types'

export interface RepartoView {
  personas: NewPersona[]
  pairings: string[]
}

const ARROW = '↔'

export function buildRepartoView(state: RoomState): RepartoView {
  const name = (id: string) => state.students[id]?.name ?? id

  // one card per redistributed persona; chips = its slot values (capped for big classes)
  const personas: NewPersona[] = Object.values(state.personas).map((p, i) => {
    const order = state.config.prompts.map((pr) => pr.id)
    const chips = order
      .filter((slot) => p.slots[slot])
      .slice(0, 5)
      .map((slot) => p.slots[slot])
    return {
      dotColor: SAMPLE_DOTS[i % SAMPLE_DOTS.length],
      title: `Para ${name(p.studentId)}`,
      chips,
    }
  })

  // pairings from the interview groups (pair: A ↔ B; trio: A → B → C)
  const pairings = state.groups.map((g) =>
    g.members.length === 3
      ? g.members.map(name).join(' → ')
      : g.members.map(name).join(` ${ARROW} `),
  )

  return { personas, pairings }
}
