export interface SeparationProgress {
  phase: 'model' | 'separation'
  progress: number | null
  message: string
}

export type StemName = 'bass' | 'drums' | 'other' | 'vocals'
export type StemBlobs = Record<StemName, Blob>

type ProgressCallback = (progress: SeparationProgress) => void

type WorkerResponse =
  | { type: 'progress'; requestId: number; progress: SeparationProgress }
  | { type: 'result'; requestId: number; stems: StemBlobs }
  | { type: 'error'; requestId: number; message: string }

interface PendingRequest {
  cancelModelTimeout: () => void
  onProgress: ProgressCallback
  reject: (reason: Error) => void
  resolve: (stems: StemBlobs) => void
}

let worker: Worker | null = null
let nextRequestId = 0
const pendingRequests = new Map<number, PendingRequest>()
const modelInitializationTimeoutMs = 5 * 60 * 1000

/** Runs HTDemucs in a worker and returns each stereo stem as a WAV. */
export function separateAudioStems(
  audio: AudioBuffer,
  onProgress: ProgressCallback = () => undefined,
): Promise<StemBlobs> {
  const requestId = ++nextRequestId
  const left = audio.getChannelData(0).slice()
  const right = (
    audio.numberOfChannels > 1 ? audio.getChannelData(1) : audio.getChannelData(0)
  ).slice()

  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      pendingRequests.delete(requestId)
      worker?.terminate()
      worker = null
      reject(
        new Error(
          'The separation model could not initialize within five minutes. Close other memory-heavy applications and try again.',
        ),
      )
    }, modelInitializationTimeoutMs)
    pendingRequests.set(requestId, {
      cancelModelTimeout() {
        globalThis.clearTimeout(timeout)
      },
      onProgress,
      reject(reason) {
        globalThis.clearTimeout(timeout)
        reject(reason)
      },
      resolve(stems) {
        globalThis.clearTimeout(timeout)
        resolve(stems)
      },
    })
    getWorker().postMessage(
      { type: 'separate', requestId, left, right, sampleRate: audio.sampleRate },
      [left.buffer, right.buffer],
    )
  })
}

function getWorker(): Worker {
  if (worker) {
    return worker
  }

  worker = new Worker(new URL('./demucs.worker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener('message', handleWorkerMessage)
  worker.addEventListener('error', (event) => {
    rejectAllRequests(
      new Error(event.message || 'The audio separation worker stopped unexpectedly.'),
    )
    worker?.terminate()
    worker = null
  })

  return worker
}

function handleWorkerMessage(event: MessageEvent<WorkerResponse>) {
  const message = event.data
  const pending = pendingRequests.get(message.requestId)

  if (!pending) {
    return
  }

  if (message.type === 'progress') {
    if (message.progress.phase === 'separation') {
      pending.cancelModelTimeout()
    }
    pending.onProgress(message.progress)
    return
  }

  pendingRequests.delete(message.requestId)

  if (message.type === 'result') {
    pending.resolve(message.stems)
  } else {
    pending.reject(new Error(message.message))
  }
}

function rejectAllRequests(error: Error) {
  for (const pending of pendingRequests.values()) {
    pending.reject(error)
  }

  pendingRequests.clear()
}
