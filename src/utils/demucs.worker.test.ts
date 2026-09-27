import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  constructorOptions: undefined as
    | {
        onDownloadProgress: (loaded: number, total: number) => void
        onProgress: (info: {
          progress: number
          currentSegment: number
          totalSegments: number
        }) => void
      }
    | undefined,
  loadModel: vi.fn(),
  separate: vi.fn(),
  DemucsProcessor: vi.fn(function (options) {
    mocks.constructorOptions = options
    return { loadModel: mocks.loadModel, separate: mocks.separate }
  }),
  ort: { env: { wasm: { numThreads: 0, wasmPaths: {} as { wasm?: string } } } },
}))

vi.mock('demucs-web', () => ({
  CONSTANTS: {
    DEFAULT_MODEL_URL: 'https://models.test/demucs.onnx',
    SAMPLE_RATE: 4,
  },
  DemucsProcessor: mocks.DemucsProcessor,
}))

vi.mock('onnxruntime-web/wasm', () => mocks.ort)
vi.mock('onnxruntime-web/ort-wasm-simd-threaded.wasm?url', () => ({
  default: '/assets/ort-wasm.wasm',
}))

interface SeparationRequest {
  type: 'separate'
  requestId: number
  left: Float32Array
  right: Float32Array
  sampleRate: number
}

interface WorkerHarness {
  dispatch(data: SeparationRequest | { type: 'ignored' }): void
  postMessage: ReturnType<typeof vi.fn>
}

async function loadWorker({
  isolated = true,
  hardwareConcurrency = 12,
}: { isolated?: boolean; hardwareConcurrency?: number } = {}): Promise<WorkerHarness> {
  let messageHandler: ((event: MessageEvent) => void) | undefined
  const postMessage = vi.fn()
  const workerScope = {
    location: { href: 'https://worker.test/src/utils/demucs.worker.js' },
    addEventListener: vi.fn((type: string, handler: (event: MessageEvent) => void) => {
      if (type === 'message') {
        messageHandler = handler
      }
    }),
    postMessage,
  }

  vi.stubGlobal('self', workerScope)
  vi.stubGlobal('navigator', { hardwareConcurrency })
  vi.stubGlobal('crossOriginIsolated', isolated)
  await import('./demucs.worker')

  return {
    dispatch(data) {
      messageHandler?.({ data } as MessageEvent)
    },
    postMessage,
  }
}

function request(overrides: Partial<SeparationRequest> = {}): SeparationRequest {
  return {
    type: 'separate',
    requestId: 7,
    left: new Float32Array([0, 1]),
    right: new Float32Array([1, 0]),
    sampleRate: 2,
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.constructorOptions = undefined
  mocks.ort.env.wasm.numThreads = 0
  mocks.ort.env.wasm.wasmPaths = {}
  mocks.loadModel.mockResolvedValue(undefined)
  mocks.separate.mockResolvedValue({
    vocals: {
      left: new Float32Array([0.25, -0.25]),
      right: new Float32Array([0.5, -0.5]),
    },
  })
})

describe('demucs worker', () => {
  test('ignores unrelated messages and separates resampled audio', async () => {
    const worker = await loadWorker()

    worker.dispatch({ type: 'ignored' })
    expect(worker.postMessage).not.toHaveBeenCalled()

    worker.dispatch(request())

    await vi.waitFor(() => {
      expect(worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'result', requestId: 7, blob: expect.any(Blob) }),
      )
    })
    expect(mocks.DemucsProcessor).toHaveBeenCalledOnce()
    expect(mocks.loadModel).toHaveBeenCalledWith('https://models.test/demucs.onnx')
    expect(mocks.separate).toHaveBeenCalledWith(
      new Float32Array([0, 0.5, 1, 1]),
      new Float32Array([1, 0.5, 0, 0]),
    )
    expect(mocks.ort.env.wasm.numThreads).toBe(4)
    expect(mocks.ort.env.wasm.wasmPaths).toEqual({
      wasm: 'https://worker.test/assets/ort-wasm.wasm',
    })
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'progress',
      requestId: 7,
      progress: {
        phase: 'model',
        progress: null,
        message: 'Preparing the separation model…',
      },
    })
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'progress',
      requestId: 7,
      progress: { phase: 'separation', progress: 0, message: 'Separating vocals…' },
    })
  })

  test('reports model download and separation progress and reuses the processor', async () => {
    const worker = await loadWorker({ isolated: false, hardwareConcurrency: 0 })
    worker.dispatch(request({ requestId: 1, sampleRate: 4 }))

    await vi.waitFor(() => expect(mocks.constructorOptions).toBeDefined())
    mocks.constructorOptions?.onDownloadProgress(25, 100)
    mocks.constructorOptions?.onDownloadProgress(0, 0)
    mocks.constructorOptions?.onDownloadProgress(100, 100)
    mocks.constructorOptions?.onProgress({ progress: 0.5, currentSegment: 2, totalSegments: 4 })
    await vi.waitFor(() => {
      expect(worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'result', requestId: 1 }),
      )
    })

    worker.dispatch(request({ requestId: 2, sampleRate: 4 }))
    await vi.waitFor(() => {
      expect(worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'result', requestId: 2 }),
      )
    })

    expect(mocks.DemucsProcessor).toHaveBeenCalledOnce()
    expect(mocks.ort.env.wasm.numThreads).toBe(1)
    expect(mocks.separate).toHaveBeenLastCalledWith(
      expect.objectContaining({ 0: 0, 1: 1 }),
      expect.objectContaining({ 0: 1, 1: 0 }),
    )
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'progress',
      requestId: 1,
      progress: {
        phase: 'model',
        progress: 0.25,
        message: 'Downloading the Demucs model…',
      },
    })
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'progress',
      requestId: 1,
      progress: { phase: 'model', progress: null, message: 'Downloading the Demucs model…' },
    })
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'progress',
      requestId: 1,
      progress: { phase: 'model', progress: 1, message: 'Initializing the Demucs model…' },
    })
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'progress',
      requestId: 1,
      progress: {
        phase: 'separation',
        progress: 0.5,
        message: 'Separating vocals (2/4)…',
      },
    })
  })

  test('reports failures and retries processor creation after a rejected load', async () => {
    mocks.loadModel.mockRejectedValueOnce(new Error('Model download failed'))
    const worker = await loadWorker({ hardwareConcurrency: 0 })

    worker.dispatch(request({ requestId: 10 }))
    await vi.waitFor(() => {
      expect(worker.postMessage).toHaveBeenCalledWith({
        type: 'error',
        requestId: 10,
        message: 'Model download failed',
      })
    })

    mocks.separate.mockRejectedValueOnce('unknown failure')
    worker.dispatch(
      request({
        requestId: 11,
        left: new Float32Array(),
        right: new Float32Array(),
      }),
    )
    await vi.waitFor(() => {
      expect(worker.postMessage).toHaveBeenCalledWith({
        type: 'error',
        requestId: 11,
        message: 'The vocal stem could not be created.',
      })
    })

    expect(mocks.DemucsProcessor).toHaveBeenCalledTimes(2)
    expect(mocks.loadModel).toHaveBeenCalledTimes(2)
    expect(mocks.ort.env.wasm.numThreads).toBe(1)
    expect(mocks.separate).toHaveBeenCalledWith(new Float32Array([0]), new Float32Array([0]))
  })
})
