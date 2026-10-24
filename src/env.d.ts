declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string
    VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined
    VUE_ROUTER_BASE: string | undefined
  }
}

interface SixStemSeparationResult {
  canceled: boolean
  error?: string
  outputDirectory?: string
}

interface Window {
  sixStemSeparation?: {
    run: () => Promise<SixStemSeparationResult>
  }
}
