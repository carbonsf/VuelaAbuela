import type { LessonConfig } from '../types'

// Sample lesson (§8). Hardcoded here — this is the data the authoring view (§9A)
// will eventually edit. Grammar target: preterite vs. imperfect. Perspective: third-person.
export const SAMPLE_LESSON: LessonConfig = {
  language: 'es',
  grammarTarget: 'preterite-imperfect',
  perspective: 'third-person',
  correctionMode: 'point-then-reveal',
  groupFallback: 'absorb',
  poemLevel: 'principiante',
  prompts: [
    { id: 'name', labelL1: 'Your name', source: 'join', complexity: 'word', example: '(from join)' },
    { id: 'occupation', labelL1: 'An occupation', source: 'phase1', complexity: 'word', example: 'profesora' },
    { id: 'commute', labelL1: 'How they travel to work', source: 'phase1', complexity: 'phrase', example: 'en metro' },
    { id: 'money', labelL1: 'How much money they carry now', source: 'phase1', complexity: 'word', example: 'veinte dólares' },
    { id: 'summer', labelL1: 'Something they did last summer', source: 'phase1', complexity: 'clause', example: 'viajó a México' },
    { id: 'childhood', labelL1: 'Something they used to do as a child', source: 'phase1', complexity: 'clause', example: 'jugaba al fútbol' },
    { id: 'food', labelL1: 'A favorite food', source: 'phase1', complexity: 'word', example: 'las empanadas' },
    { id: 'place', labelL1: 'A place they visited', source: 'phase1', complexity: 'phrase', example: 'la playa' },
    { id: 'weekend', labelL1: 'A weekend activity', source: 'phase1', complexity: 'phrase', example: 'ir al cine' },
    { id: 'object', labelL1: 'An object they always carry', source: 'phase1', complexity: 'word', example: 'un paraguas' },
  ],
  // Global question set (§8). targetSlotId probes a persona slot; grammarTag drives
  // the preterite/imperfect contrast.
  questions: [
    { id: 'q-name', text: '¿Cómo se llama?', targetSlotId: 'name' },
    { id: 'q-occupation', text: '¿Cuál era su ocupación?', targetSlotId: 'occupation', grammarTag: 'imperfect' },
    { id: 'q-commute', text: '¿Cómo viajaba al trabajo?', targetSlotId: 'commute', grammarTag: 'imperfect' },
    { id: 'q-money', text: '¿Cuánto dinero llevaba?', targetSlotId: 'money', grammarTag: 'imperfect' },
    { id: 'q-summer', text: '¿Qué hizo el verano pasado?', targetSlotId: 'summer', grammarTag: 'preterite' },
    { id: 'q-childhood', text: '¿Qué hacía cuando era niño/a?', targetSlotId: 'childhood', grammarTag: 'imperfect' },
    { id: 'q-place', text: '¿Qué visitó? / ¿Adónde fue?', targetSlotId: 'place', grammarTag: 'preterite' },
    { id: 'q-weekend', text: '¿Qué hizo el fin de semana?', targetSlotId: 'weekend', grammarTag: 'preterite' },
  ],
}
