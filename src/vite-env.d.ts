/// <reference types="vite/client" />

// Claude Artifacts runtime API (§1, §5): live validation, no API key passed.
// Present when running inside a Claude artifact; absent in plain local dev.
declare global {
  interface Window {
    claude?: {
      complete: (prompt: string) => Promise<string>
    }
  }
}

export {}
