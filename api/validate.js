// Vercel serverless function — the real §5 validator path for web deployments.
// The browser has no `window.claude` outside Anthropic's artifact runtime, so
// the client POSTs the already-built validator prompt here and we call the
// Anthropic API server-side with a secret key. Returns the model's raw text;
// the client parses it with the same parseResult() it uses everywhere.
//
// Requires env ANTHROPIC_API_KEY (set in Vercel project settings).
//   GET  -> { ready: <bool> }   health probe for the "live validation" badge
//   POST { prompt } -> { text }  one validation call

const MODEL = 'claude-sonnet-5'
const DEFAULT_MAX_TOKENS = 1000
const TOKEN_CEILING = 4096 // hard cap regardless of requested budget
const MAX_PROMPT_CHARS = 16000 // cap payload — this is an open endpoint

// Same-origin guard: a POST must come from a page served by this same host
// (the app itself). Blocks casual off-site curling of the relay without any
// per-IP throttling — which would wrongly punish a whole class behind one
// school NAT. Origin/Referer are set by browsers and not forgeable from page JS.
function sameOrigin(req) {
  const host = req.headers.host
  const src = req.headers.origin || req.headers.referer
  if (!host || !src) return false
  try { return new URL(src).host === host } catch { return false }
}

export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY

  if (req.method === 'GET') {
    res.status(200).json({ ready: !!key })
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!sameOrigin(req)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  if (!key) {
    res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' })
    return
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  const prompt = body && typeof body.prompt === 'string' ? body.prompt : ''
  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt' })
    return
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    res.status(413).json({ error: 'Prompt too large' })
    return
  }
  const requested = Number(body && body.maxTokens)
  const maxTokens = Number.isFinite(requested)
    ? Math.min(Math.max(1, Math.floor(requested)), TOKEN_CEILING)
    : DEFAULT_MAX_TOKENS
  // optional model override (must be an Anthropic model id); defaults to MODEL
  const model = body && typeof body.model === 'string' && /^claude-[a-z0-9-]+$/.test(body.model)
    ? body.model
    : MODEL

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!upstream.ok) {
      const detail = await upstream.text()
      res.status(502).json({ error: 'Upstream error', status: upstream.status, detail })
      return
    }
    const data = await upstream.json()
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
    res.status(200).json({ text })
  } catch (e) {
    res.status(502).json({ error: 'Request failed', detail: String(e) })
  }
}
