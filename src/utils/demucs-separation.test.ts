import { beforeEach, describe, expect, test, vi } from 'vitest'

type WorkerListener = (event: MessageEvent & { message?: string }) => void

class FakeWorker {
  readonly listeners = new Map<string, WorkerListener>()
  readonly postMessage = vi.fn()
  readonly terminate = vi.fn()

  addEventListener(type: string, listener: WorkerListener) {
    this.listeners.set(type, listener)
  }

  dispatchMessage(data: unknown) {
    this.listeners.get('message')?.({ data } as MessageEvent)
  }

  dispatchError(message = '') {
    this.listeners.get('error')?.({ message } as MessageEvent & { message: string })
  }
}

const workers: FakeWorker[] = []
const WorkerMock = vi.fn(function () {
  const worker = new FakeWorker()
  workers.push(worker)
  return worker
})

function createAudioBuffer(channels: number[][], sampleRate = 48_000): AudioBuffer {
  const channelData = channels.map((channel) => new Float32Array(channel))

  return {
    numberOfChannels: channelData.length,
    sampleRate,
    getChannelData(channel: number) {
      return channelData[channel] ?? new Float32Array()
    },
  } as AudioBuffer
}

async function loadModule() {
  return import('./demucs-separation')
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  workers.length = 0
  vi.stubGlobal('Worker', WorkerMock)
})

describe('demucs separation', () => {
  test('posts copied stereo channels and transferable buffers to a module worker', async () => {
    const { separateVocalStem } = await loadModule()
    const audio = createAudioBuffer([
      [0.1, 0.2],
      [0.3, 0.4],
    ])
    const sourceLeft = audio.getChannelData(0)
    const sourceRight = audio.getChannelData(1)
    const promise = separateVocalStem(audio)
    const worker = workers[0]

    expect(WorkerMock).toHaveBeenCalledWith(expect.any(URL), { type: 'module' })
    expect(worker).toBeDefined()
    const [message, transfer] = worker?.postMessage.mock.calls[0] ?? []
    expect(message).toMatchObject({
      type: 'separate',
      requestId: 1,
      sampleRate: 48_000,
      left: new Float32Array([0.1, 0.2]),
      right: new Float32Array([0.3, 0.4]),
    })
    expect(message.left).not.toBe(sourceLeft)
    expect(message.right).not.toBe(sourceRight)
    expect(transfer).toEqual([message.left.buffer, message.right.buffer])

    const blob = new Blob(['wav'], { type: 'audio/wav' })
    worker?.dispatchMessage({
      type: 'progress',
      requestId: 1,
      progress: { phase: 'model', progress: 1, message: 'Ready' },
    })
    worker?.dispatchMessage({ type: 'result', requestId: 1, blob })
    await expect(promise).resolves.toBe(blob)
  })

  test('duplicates mono audio, reuses the worker, and routes progress by request ID', async () => {
    const { separateVocalStem } = await loadModule()
    const onFirstProgress = vi.fn()
    const onSecondProgress = vi.fn()
    const first = separateVocalStem(createAudioBuffer([[0.25, -0.25]]), onFirstProgress)
    const second = separateVocalStem(createAudioBuffer([[0.5]], 44_100), onSecondProgress)
    const worker = workers[0]
    const firstMessage = worker?.postMessage.mock.calls[0]?.[0]
    const secondMessage = worker?.postMessage.mock.calls[1]?.[0]

    expect(workers).toHaveLength(1)
    expect(firstMessage.left).toEqual(new Float32Array([0.25, -0.25]))
    expect(firstMessage.right).toEqual(new Float32Array([0.25, -0.25]))
    expect(firstMessage.right).not.toBe(firstMessage.left)
    expect(secondMessage).toMatchObject({ requestId: 2, sampleRate: 44_100 })

    worker?.dispatchMessage({
      type: 'progress',
      requestId: 999,
      progress: { phase: 'model', progress: null, message: 'Ignored' },
    })
    worker?.dispatchMessage({
      type: 'progress',
      requestId: 2,
      progress: { phase: 'separation', progress: 0.5, message: 'Halfway' },
    })
    expect(onFirstProgress).not.toHaveBeenCalled()
    expect(onSecondProgress).toHaveBeenCalledWith({
      phase: 'separation',
      progress: 0.5,
      message: 'Halfway',
    })

    const firstBlob = new Blob(['first'])
    const secondBlob = new Blob(['second'])
    worker?.dispatchMessage({ type: 'result', requestId: 2, blob: secondBlob })
    worker?.dispatchMessage({ type: 'result', requestId: 1, blob: firstBlob })
    await expect(first).resolves.toBe(firstBlob)
    await expect(second).resolves.toBe(secondBlob)
  })

  test('rejects a request when the worker reports a separation error', async () => {
    const { separateVocalStem } = await loadModule()
    const promise = separateVocalStem(createAudioBuffer([[0]]))

    workers[0]?.dispatchMessage({ type: 'error', requestId: 1, message: 'Separation failed' })

    await expect(promise).rejects.toThrow('Separation failed')
  })

  test.each([
    ['Worker crashed', 'Worker crashed'],
    ['', 'The vocal separation worker stopped unexpectedly.'],
  ])('rejects all pending work after a worker failure with message %#', async (message, expected) => {
    const { separateVocalStem } = await loadModule()
    const first = separateVocalStem(createAudioBuffer([[0]]))
    const second = separateVocalStem(createAudioBuffer([[1]]))
    const failedWorker = workers[0]

    failedWorker?.dispatchError(message)

    await expect(first).rejects.toThrow(expected)
    await expect(second).rejects.toThrow(expected)
    expect(failedWorker?.terminate).toHaveBeenCalledOnce()

    const replacement = separateVocalStem(createAudioBuffer([[0.5]]))
    expect(workers).toHaveLength(2)
    const replacementBlob = new Blob(['replacement'])
    workers[1]?.dispatchMessage({ type: 'result', requestId: 3, blob: replacementBlob })
    await expect(replacement).resolves.toBe(replacementBlob)
  })
})
