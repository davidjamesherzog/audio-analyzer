import type * as VueModule from 'vue'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { AudioAnalysisSummary } from 'src/utils/audio-analysis'

const lifecycle = vi.hoisted(() => ({
  unmount: undefined as (() => void) | undefined,
}))

const separateAudioStems = vi.hoisted(() =>
  vi.fn((_audio: AudioBuffer, onProgress?: (value: unknown) => void) => {
    onProgress?.({ phase: 'separation', progress: 1, message: 'Separating audio stems (1/1)…' })
    return Promise.resolve({
      bass: new Blob(['bass wav'], { type: 'audio/wav' }),
      drums: new Blob(['drums wav'], { type: 'audio/wav' }),
      other: new Blob(['other wav'], { type: 'audio/wav' }),
      vocals: new Blob(['vocal wav'], { type: 'audio/wav' }),
    })
  }),
)

vi.mock('src/utils/demucs-separation', () => ({ separateAudioStems }))

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
let stemUrlIndex = 0

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
  separateAudioStems.mockClear()
  revokeObjectURL.mockReset()
  stemUrlIndex = 0
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((value: Blob) => {
      return 'name' in value ? `blob:${String(value.name)}` : `blob:stem-${++stemUrlIndex}`
    }),
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
    expect(analyzer.isSeparatingStems.value).toBe(false)
    expect(analyzer.stemPreviews.value).toEqual([])
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

  test('extracts downloadable WAVs for all stems and replaces their previous URLs', async () => {
    installAudioContext()
    const analyzer = useAudioAnalyzer()

    await analyzer.analyzeFile(createFile({ name: 'my.song.mp3' }))
    await analyzer.extractStems()

    expect(analyzer.stemPreviews.value).toEqual([
      {
        downloadName: 'my.song-vocals.wav',
        label: 'Vocals',
        name: 'vocals',
        source: 'blob:stem-4',
      },
      {
        downloadName: 'my.song-drums.wav',
        label: 'Drums',
        name: 'drums',
        source: 'blob:stem-2',
      },
      {
        downloadName: 'my.song-bass.wav',
        label: 'Bass',
        name: 'bass',
        source: 'blob:stem-1',
      },
      {
        downloadName: 'my.song-other.wav',
        label: 'Other instruments',
        name: 'other',
        source: 'blob:stem-3',
      },
    ])
    expect(analyzer.isSeparatingStems.value).toBe(false)
    expect(analyzer.stemSeparationProgress.value).toBe(1)
    expect(analyzer.stemSeparationStatus.value).toBe('Audio stems ready.')
    expect(separateAudioStems).toHaveBeenCalledOnce()

    analyzer.selectedFile.value = createFile({ name: 'recording' })
    expect(analyzer.stemPreviews.value[0]?.downloadName).toBe('recording-vocals.wav')
    analyzer.selectedFile.value = null
    expect(analyzer.stemPreviews.value[0]?.downloadName).toBe('audio-vocals.wav')

    await analyzer.analyzeFile(createFile({ name: 'next.wav' }))

    expect(revokeObjectURL).toHaveBeenCalledTimes(5)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stem-4')
    expect(analyzer.stemPreviews.value).toEqual([])
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

  test('formats file metadata across size, type, and file-name boundaries', () => {
    const analyzer = useAudioAnalyzer()

    analyzer.selectedFile.value = createFile({ name: 'recording', size: 0, type: 'audio/custom' })
    expect(analyzer.fileStats.value).toEqual(
      expect.arrayContaining([
        { label: 'Type', value: 'audio/custom' },
        { label: 'Size', value: '0 B' },
      ]),
    )

    analyzer.selectedFile.value = createFile({ name: '', size: 512 })
    expect(analyzer.fileStats.value).toEqual(
      expect.arrayContaining([
        { label: 'Type', value: 'Unknown' },
        { label: 'Size', value: '512 B' },
      ]),
    )

    analyzer.selectedFile.value = createFile({ name: '.hidden', size: 10 * 1024 })
    expect(analyzer.fileStats.value).toEqual(
      expect.arrayContaining([
        { label: 'Type', value: 'HIDDEN' },
        { label: 'Size', value: '10 KB' },
      ]),
    )

    analyzer.selectedFile.value = createFile({ size: 5 * 1024 ** 4 })
    expect(analyzer.fileStats.value).toEqual(
      expect.arrayContaining([{ label: 'Size', value: '5120 GB' }]),
    )
  })

  test('formats long silent mono and multichannel analysis summaries', () => {
    const analyzer = useAudioAnalyzer()
    const baseAnalysis: AudioAnalysisSummary = {
      durationSeconds: 3_661.25,
      sampleRate: 48_000,
      numberOfChannels: 1,
      frameCount: 0,
      sampleCount: 0,
      peakAmplitude: 0,
      peakDbfs: null,
      rmsAmplitude: 0,
      rmsDbfs: null,
      channelAnalyses: [],
    }

    analyzer.analysis.value = baseAnalysis
    expect(analyzer.overallAnalysisStats.value).toEqual(
      expect.arrayContaining([
        { label: 'Duration', value: '1:01:01.25' },
        { label: 'Channels', value: '1 (Mono)' },
        { label: 'Peak level', value: 'Silence' },
        { label: 'RMS level', value: 'Silence' },
      ]),
    )

    analyzer.analysis.value = { ...baseAnalysis, numberOfChannels: 6 }
    expect(analyzer.overallAnalysisStats.value).toEqual(
      expect.arrayContaining([{ label: 'Channels', value: '6 (Multichannel)' }]),
    )
  })

  test('uses webkitAudioContext when the standard constructor is unavailable', async () => {
    const decodedAudio = createDecodedAudio()
    const decodeAudioData = vi.fn().mockResolvedValue(decodedAudio)
    const close = vi.fn().mockResolvedValue(undefined)
    const WebkitAudioContextMock = vi.fn(function () {
      return { decodeAudioData, close }
    })
    vi.stubGlobal('window', { webkitAudioContext: WebkitAudioContextMock })
    const analyzer = useAudioAnalyzer()

    await analyzer.analyzeFile(createFile())

    expect(WebkitAudioContextMock).toHaveBeenCalledOnce()
    expect(analyzer.analysis.value).not.toBeNull()
  })

  test('uses the generic decoding message for non-Error failures', async () => {
    const analyzer = useAudioAnalyzer()

    await analyzer.analyzeFile(
      // Deliberately exercise the defensive branch for third-party APIs that reject with non-Errors.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      createFile({ arrayBuffer: () => Promise.reject('unstructured decoding failure') }),
    )

    expect(analyzer.errorMessage.value).toBe(
      'The selected file could not be decoded by the browser audio engine.',
    )
  })

  test('requires decoded audio before separating stems', async () => {
    const analyzer = useAudioAnalyzer()

    await analyzer.extractStems()

    expect(analyzer.errorMessage.value).toBe(
      'Choose and decode an audio file before separating stems.',
    )
    expect(separateAudioStems).not.toHaveBeenCalled()
  })

  test.each([
    [new Error('Separation failed'), 'Separation failed'],
    ['unstructured extraction failure', 'The audio stems could not be created.'],
  ])('cleans up after stem separation failure %#', async (failure, expectedMessage) => {
    installAudioContext()
    const analyzer = useAudioAnalyzer()
    await analyzer.analyzeFile(createFile())
    await analyzer.extractStems()
    separateAudioStems.mockRejectedValueOnce(failure)

    await analyzer.extractStems()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stem-4')
    expect(analyzer.stemPreviews.value).toEqual([])
    expect(analyzer.errorMessage.value).toBe(expectedMessage)
    expect(analyzer.isSeparatingStems.value).toBe(false)
  })

  test('revokes all stem preview URLs when the owner unmounts', async () => {
    installAudioContext()
    const analyzer = useAudioAnalyzer()
    await analyzer.analyzeFile(createFile())
    await analyzer.extractStems()

    lifecycle.unmount?.()

    expect(revokeObjectURL).toHaveBeenCalledTimes(5)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stem-1')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stem-4')
    expect(analyzer.stemPreviews.value).toEqual([])
  })
})
