import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // honour a harness-assigned port so the dev server never fights another
  // project already sitting on vite's default 5173 (no @types/node needed)
  server: { port: Number((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PORT) || undefined },
})
