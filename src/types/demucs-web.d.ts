declare module 'demucs-web' {
  export interface StemChannels {
    left: Float32Array
    right: Float32Array
  }

  export interface SeparationResult {
    drums: StemChannels
    bass: StemChannels
    other: StemChannels
    vocals: StemChannels
  }

  export interface ProgressInfo {
    progress: number
    currentSegment: number
    totalSegments: number
  }

  export const CONSTANTS: {
    DEFAULT_MODEL_URL: string
    SAMPLE_RATE: number
  }

  export class DemucsProcessor {
    constructor(options: {
      ort: unknown
      onDownloadProgress?: (loaded: number, total: number) => void
      onProgress?: (info: ProgressInfo) => void
      sessionOptions?: {
        enableCpuMemArena?: boolean
        enableMemPattern?: boolean
        executionProviders?: string[]
        graphOptimizationLevel?: string
      }
    })

    loadModel(pathOrBuffer?: string | ArrayBuffer): Promise<void>
    separate(left: Float32Array, right: Float32Array): Promise<SeparationResult>
  }
}
