# Validator eval

Pressure-tests the §5 validator against a labeled corpus of messy student
Spanish. It runs each case through the app's **real** `buildPrompt` + `parseResult`
(imported from `src/validation/validator.ts`), calling the model through your
local, logged-in `claude` CLI — no API key needed.

```bash
npm run eval:validator                      # full corpus, model claude-sonnet-4-6
CLAUDE_MODEL=claude-opus-4-8 npm run eval:validator
node eval/run.ts block reenter              # only ids starting with block/reenter
EVAL_CONCURRENCY=1 npm run eval:validator   # serialize the model calls
```

You must be logged in (`claude` interactively once) — the runner shells out to
`claude -p` and inherits that session.

## Reading the output

- **SCORECARD** — pass rate per expected action (`block` / `reenter` / `correct` / `pass`).
- **MISMATCHES** — every case the model got "wrong", with the value, the note, and
  the model's raw reply. These are your tuning targets.
- **hard vs. edge misses** — `edge: true` cases (in `corpus.ts`) are judgment calls
  a defensible validator could differ on; the process exits non-zero only on **hard**
  misses, so this is CI-able.

## Tuning loop

1. Run the eval. 2. Look at hard mismatches. 3. Edit the system prompt in
`src/validation/validator.ts` (`buildPrompt`). 4. Re-run. Adjust `corpus.ts` as
you discover new failure modes from real classroom use — the corpus is the asset.
