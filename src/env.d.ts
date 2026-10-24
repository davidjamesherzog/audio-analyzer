declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string
    VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined
    VUE_ROUTER_BASE: string | undefined
  }
}

interface SixStemPocResult {
  canceled: boolean
  error?: string
  outputDirectory?: string
}

interface Window {
  sixStemPoc?: {
    run: () => Promise<SixStemPocResult>
  }
}
