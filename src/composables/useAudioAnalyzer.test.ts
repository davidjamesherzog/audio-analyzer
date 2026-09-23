import type * as VueModule from 'vue'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const lifecycle = vi.hoisted(() => ({
  unmount: undefined as (() => void) | undefined,
}))

vi.mock('vue', async (importOriginal) => {
  const vue = await importOriginal<typeof VueModule>()

  return {
    ...vue,
    onBeforeUnmount(callback: () => void) {
      lifecycle.unmount = callback
    },
  }
})

import { useAudioAnalyzer } from './useAudioAnalyzer'

const revokeObjectURL = vi.fn()

interface TestFileOptions {
  name?: string
  size?: number
  type?: string
  lastModified?: number
  arrayBuffer?: () => Promise<ArrayBuffer>
}

function createFile(options: TestFileOptions = {}): File {
  return {
    name: options.name ?? 'sample.wav',
    size: options.size ?? 1_536,
    type: options.type ?? '',
    lastModified: options.lastModified ?? Date.UTC(2026, 0, 2, 3, 4, 5),
    arrayBuffer: options.arrayBuffer ?? (() => Promise.resolve(new ArrayBuffer(8))),
  } as File
}

function createDecodedAudio(): AudioBuffer {
  const channels = [new Float32Array([0, 0.5, -1, 0.25]), new Float32Array([0, -0.5, 0.75, 0.25])]

  return {
    duration: 2,
    sampleRate: 2,
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    getChannelData(channel: number) {
      return channels[channel] ?? new Float32Array()
    },
  } as AudioBuffer
}

function installAudioContext(decodedAudio = createDecodedAudio()) {
  const decodeAudioData = vi.fn().mockResolvedValue(decodedAudio)
  const close = vi.fn().mockResolvedValue(undefined)
  const AudioContextMock = vi.fn(function () {
    return { decodeAudioData, close }
  })

  vi.stubGlobal('window', { AudioContext: AudioContextMock })

  return { AudioContextMock, close, decodeAudioData }
}

beforeEach(() => {
  lifecycle.unmount = undefined
  revokeObjectURL.mockReset()
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((file: File) => `blob:${file.name}`),
    revokeObjectURL,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useAudioAnalyzer', () => {
  test('starts with empty analyzer state', () => {
    const analyzer = useAudioAnalyzer()

    expect(analyzer.selectedFile.value).toBeNull()
    expect(analyzer.analysis.value).toBeNull()
    expect(analyzer.previewUrl.value).toBeNull()
    expect(analyzer.errorMessage.value).toBe('')
    expect(analyzer.isAnalyzing.value).toBe(false)
    expect(analyzer.fileStats.value).toEqual([])
    expect(analyzer.overallAnalysisStats.value).toEqual([])
  })

  test('decodes a file and exposes formatted file and analysis statistics', async () => {
    const { AudioContextMock, close, decodeAudioData } = installAudioContext()
    const analyzer = useAudioAnalyzer()
    const file = createFile()

    await analyzer.analyzeFile(file)

    expect(analyzer.selectedFile.value?.name).toBe(file.name)
    expect(analyzer.previewUrl.value).toBe('blob:sample.wav')
    expect(analyzer.errorMessage.value).toBe('')
    expect(analyzer.isAnalyzing.value).toBe(false)
    expect(AudioContextMock).toHaveBeenCalledOnce()
    expect(decodeAudioData).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
    expect(analyzer.fileStats.value).toEqual(
      expect.arrayContaining([
        { label: 'File name', value: 'sample.wav' },
        { label: 'Type', value: 'WAV' },
        { label: 'Size', value: '1.5 KB' },
      ]),
    )
    expect(analyzer.overallAnalysisStats.value).toEqual(
      expect.arrayContaining([
        { label: 'Duration', value: '0:02.00' },
        { label: 'Sample rate', value: '2 Hz' },
        { label: 'Channels', value: '2 (Stereo)' },
        { label: 'Frames', value: '4' },
        { label: 'Decoded samples', value: '8' },
        { label: 'Peak level', value: '0.00 dBFS' },
        { label: 'Peak amplitude', value: '1.0000' },
      ]),
    )
  })

  test('reports decoding failures and still closes the audio context', async () => {
    const decodeError = new Error('Unsupported audio data')
    const close = vi.fn().mockResolvedValue(undefined)
    const decodeAudioData = vi.fn().mockRejectedValue(decodeError)
    const AudioContextMock = vi.fn(function () {
      return { decodeAudioData, close }
    })
    vi.stubGlobal('window', { AudioContext: AudioContextMock })
    const analyzer = useAudioAnalyzer()

    await analyzer.analyzeFile(createFile())

    expect(analyzer.analysis.value).toBeNull()
    expect(analyzer.errorMessage.value).toBe('Unsupported audio data')
    expect(analyzer.isAnalyzing.value).toBe(false)
    expect(close).toHaveBeenCalledOnce()
  })

  test('reports when Web Audio is unavailable', async () => {
    vi.stubGlobal('window', {})
    const analyzer = useAudioAnalyzer()

    await analyzer.analyzeFile(createFile())

    expect(analyzer.analysis.value).toBeNull()
    expect(analyzer.errorMessage.value).toBe(
      'This browser does not support the Web Audio API needed for analysis.',
    )
    expect(analyzer.isAnalyzing.value).toBe(false)
  })

  test('revokes old preview URLs when files change and when the owner unmounts', async () => {
    installAudioContext()
    const analyzer = useAudioAnalyzer()

    await analyzer.analyzeFile(createFile({ name: 'first.wav' }))
    await analyzer.analyzeFile(createFile({ name: 'second.wav' }))

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first.wav')

    lifecycle.unmount?.()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:second.wav')
    expect(analyzer.previewUrl.value).toBeNull()
  })
})
