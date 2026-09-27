import type { DemucsProcessor as DemucsProcessorType } from 'demucs-web'
import standardWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'

import type { SeparationProgress, StemBlobs } from './demucs-separation'
import { encodeStereoWav } from './vocal-extraction'

interface SeparationRequest {
  type: 'separate'
  requestId: number
  left: Float32Array
  right: Float32Array
  sampleRate: number
}

let processorPromise: Promise<DemucsProcessorType> | null = null
let activeRequestId = 0

self.addEventListener('message', (event: MessageEvent<SeparationRequest>) => {
  if (event.data.type === 'separate') {
    void separate(event.data)
  }
})

async function separate(request: SeparationRequest) {
  activeRequestId = request.requestId
  report({ phase: 'model', progress: null, message: 'Preparing the separation model…' })

  try {
    const demucs = await import('demucs-web')
    const processor = await getProcessor()
    const left = resampleLinear(request.left, request.sampleRate, demucs.CONSTANTS.SAMPLE_RATE)
    const right = resampleLinear(request.right, request.sampleRate, demucs.CONSTANTS.SAMPLE_RATE)

    report({ phase: 'separation', progress: 0, message: 'Separating audio stems…' })
    const result = await processor.separate(left, right)
    const stems: StemBlobs = {
      bass: encodeStereoWav(result.bass.left, result.bass.right, demucs.CONSTANTS.SAMPLE_RATE),
      drums: encodeStereoWav(result.drums.left, result.drums.right, demucs.CONSTANTS.SAMPLE_RATE),
      other: encodeStereoWav(result.other.left, result.other.right, demucs.CONSTANTS.SAMPLE_RATE),
      vocals: encodeStereoWav(
        result.vocals.left,
        result.vocals.right,
        demucs.CONSTANTS.SAMPLE_RATE,
      ),
    }

    self.postMessage({ type: 'result', requestId: request.requestId, stems })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The audio stems could not be created.'
    self.postMessage({ type: 'error', requestId: request.requestId, message })
  }
}

async function createProcessor(): Promise<DemucsProcessorType> {
  const [ort, demucs] = await Promise.all([import('onnxruntime-web/wasm'), import('demucs-web')])
  ort.env.wasm.numThreads = crossOriginIsolated
    ? Math.min(navigator.hardwareConcurrency || 1, 4)
    : 1
  ort.env.wasm.wasmPaths = {
    wasm: new URL(standardWasmUrl, self.location.href).href,
  }

  const processor = new demucs.DemucsProcessor({
    ort,
    sessionOptions: {
      enableCpuMemArena: false,
      enableMemPattern: false,
      executionProviders: ['wasm'],
    },
    onDownloadProgress(loaded, total) {
      const progress = total > 0 ? loaded / total : null
      report({
        phase: 'model',
        progress,
        message:
          progress === 1 ? 'Initializing the Demucs model…' : 'Downloading the Demucs model…',
      })
    },
    onProgress(info) {
      report({
        phase: 'separation',
        progress: info.progress,
        message: `Separating audio stems (${info.currentSegment}/${info.totalSegments})…`,
      })
    },
  })

  await processor.loadModel(demucs.CONSTANTS.DEFAULT_MODEL_URL)
  return processor
}

function getProcessor(): Promise<DemucsProcessorType> {
  if (!processorPromise) {
    processorPromise = createProcessor().catch((error: unknown) => {
      processorPromise = null
      throw error
    })
  }

  return processorPromise
}

function report(progress: SeparationProgress) {
  self.postMessage({ type: 'progress', requestId: activeRequestId, progress })
}

function resampleLinear(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) {
    return input
  }

  const outputLength = Math.max(1, Math.round((input.length * targetRate) / sourceRate))
  const output = new Float32Array(outputLength)
  const rateRatio = sourceRate / targetRate

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * rateRatio
    const lowerIndex = Math.min(Math.floor(sourcePosition), input.length - 1)
    const upperIndex = Math.min(lowerIndex + 1, input.length - 1)
    const fraction = sourcePosition - lowerIndex
    output[index] = (input[lowerIndex] ?? 0) * (1 - fraction) + (input[upperIndex] ?? 0) * fraction
  }

  return output
}
