// ============================================================================
// Validator eval runner. Feeds every corpus case through the app's REAL
// validator prompt (buildPrompt) and REAL parser (parseResult), calling the
// model via the local `claude` CLI (uses your logged-in session — no API key).
// Prints a per-category scorecard and lists every mismatch with the model's
// actual action so you can tune the prompt and re-run.
//
//   npm run eval:validator                  # full corpus, model claude-sonnet-4-6
//   CLAUDE_MODEL=claude-opus-4-8 npm run eval:validator
//   node eval/run.ts block reenter          # only cases whose id starts with…
// ============================================================================
import { spawn } from 'node:child_process'
import { buildPrompt, parseResult } from '../src/validation/validator.ts'
import { SAMPLE_LESSON } from '../src/lesson/sampleLesson.ts'
import { CORPUS, type CorpusCase, type Action } from './corpus.ts'

const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6'
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 3)
const filters = process.argv.slice(2)

function promptFor(id: string) {
  const p = SAMPLE_LESSON.prompts.find((x) => x.id === id)
  if (!p) throw new Error(`corpus references unknown promptId "${id}"`)
  return p
}

// One model call via `claude -p` (prompt on stdin). Resolves to raw stdout.
function callClaude(systemPrompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--model', MODEL], { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err || `claude exited ${code}`))))
    child.stdin.write(systemPrompt)
    child.stdin.end()
  })
}

interface Outcome {
  c: CorpusCase
  got: Action | 'unparseable' | 'error'
  revealOk: boolean // for CORRECT cases, did answer-presence match expectReveal?
  ok: boolean
  raw: string
}

async function runCase(c: CorpusCase): Promise<Outcome> {
  const sys = buildPrompt({ prompt: promptFor(c.promptId), value: c.value, config: SAMPLE_LESSON, grammarAttempt: c.grammarAttempt })
  let raw = ''
  try {
    raw = await callClaude(sys)
  } catch (e) {
    return { c, got: 'error', revealOk: false, ok: false, raw: String(e) }
  }
  const parsed = parseResult(raw)
  if (!parsed) return { c, got: 'unparseable', revealOk: false, ok: false, raw: raw.trim() }
  const actionOk = parsed.action === c.expect
  let revealOk = true
  if (c.expect === 'correct' && parsed.action === 'correct' && c.expectReveal !== undefined) {
    revealOk = !!parsed.answer === c.expectReveal
  }
  return { c, got: parsed.action, revealOk, ok: actionOk && revealOk, raw: raw.trim() }
}

// bounded-concurrency map
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
      process.stdout.write('.')
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
  process.stdout.write('\n')
  return out
}

async function main() {
  const cases = filters.length ? CORPUS.filter((c) => filters.some((f) => c.id.startsWith(f))) : CORPUS
  if (!cases.length) { console.error('no cases matched', filters); process.exit(1) }
  console.log(`Validator eval — ${cases.length} cases — model ${MODEL}\n`)

  const results = await pool(cases, CONCURRENCY, runCase)

  // category = first segment of expect; scorecard
  const byExpect = new Map<Action, { pass: number; total: number }>()
  for (const r of results) {
    const k = r.c.expect
    const cur = byExpect.get(k) ?? { pass: 0, total: 0 }
    cur.total++; if (r.ok) cur.pass++
    byExpect.set(k, cur)
  }

  const misses = results.filter((r) => !r.ok)
  if (misses.length) {
    console.log('MISMATCHES:')
    for (const m of misses) {
      const tag = m.c.edge ? ' (edge)' : ''
      const reveal = m.c.expect === 'correct' && m.c.expectReveal !== undefined ? ` reveal=${m.c.expectReveal}` : ''
      console.log(`  ✗ ${m.c.id}${tag}  expect=${m.c.expect}${reveal}  got=${m.got}`)
      console.log(`      value: ${JSON.stringify(m.c.value)}  — ${m.c.note}`)
      console.log(`      raw:   ${m.raw.replace(/\s+/g, ' ').slice(0, 160)}`)
    }
    console.log('')
  }

  console.log('SCORECARD (by expected action):')
  for (const [k, v] of byExpect) console.log(`  ${k.padEnd(8)} ${v.pass}/${v.total}`)
  const hardMiss = misses.filter((m) => !m.c.edge).length
  const edgeMiss = misses.filter((m) => m.c.edge).length
  const passN = results.filter((r) => r.ok).length
  console.log(`\n  TOTAL ${passN}/${results.length}   (hard misses: ${hardMiss}, edge misses: ${edgeMiss})`)
  process.exit(hardMiss ? 1 : 0)
}

main()
