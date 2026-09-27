export interface SeparationProgress {
  phase: 'model' | 'separation'
  progress: number | null
  message: string
}

type ProgressCallback = (progress: SeparationProgress) => void

type WorkerResponse =
  | { type: 'progress'; requestId: number; progress: SeparationProgress }
  | { type: 'result'; requestId: number; blob: Blob }
  | { type: 'error'; requestId: number; message: string }

interface PendingRequest {
  onProgress: ProgressCallback
  reject: (reason: Error) => void
  resolve: (blob: Blob) => void
}

let worker: Worker | null = null
let nextRequestId = 0
const pendingRequests = new Map<number, PendingRequest>()

/** Runs HTDemucs in a worker and returns its stereo vocal stem as a WAV. */
export function separateVocalStem(
  audio: AudioBuffer,
  onProgress: ProgressCallback = () => undefined,
): Promise<Blob> {
  const requestId = ++nextRequestId
  const left = audio.getChannelData(0).slice()
  const right = (
    audio.numberOfChannels > 1 ? audio.getChannelData(1) : audio.getChannelData(0)
  ).slice()

  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { onProgress, reject, resolve })
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
    rejectAllRequests(new Error(event.message || 'The vocal separation worker stopped unexpectedly.'))
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
    pending.onProgress(message.progress)
    return
  }

  pendingRequests.delete(message.requestId)

  if (message.type === 'result') {
    pending.resolve(message.blob)
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
