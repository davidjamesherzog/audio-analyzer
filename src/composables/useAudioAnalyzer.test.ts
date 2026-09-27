import type * as VueModule from 'vue'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { AudioAnalysisSummary } from 'src/utils/audio-analysis'

const lifecycle = vi.hoisted(() => ({
  unmount: undefined as (() => void) | undefined,
}))

const separateVocalStem = vi.hoisted(() =>
  vi.fn((_audio: AudioBuffer, onProgress?: (value: unknown) => void) => {
    onProgress?.({ phase: 'separation', progress: 1, message: 'Separating vocals (1/1)…' })
    return Promise.resolve(new Blob(['vocal wav'], { type: 'audio/wav' }))
  }),
)

vi.mock('src/utils/demucs-separation', () => ({ separateVocalStem }))

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
  separateVocalStem.mockClear()
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
    expect(analyzer.isExtractingVocals.value).toBe(false)
    expect(analyzer.vocalPreviewUrl.value).toBeNull()
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

  test('extracts a downloadable vocal WAV and replaces its previous URL', async () => {
    installAudioContext()
    const urlMock = vi.mocked(URL)
    urlMock.createObjectURL.mockImplementation((value: Blob | MediaSource) =>
      value instanceof Blob ? 'blob:vocals' : 'blob:audio',
    )
    const analyzer = useAudioAnalyzer()

    await analyzer.analyzeFile(createFile({ name: 'my.song.mp3' }))
    await analyzer.extractVocals()

    expect(analyzer.vocalPreviewUrl.value).toBe('blob:vocals')
    expect(analyzer.vocalDownloadName.value).toBe('my.song-vocals.wav')
    expect(analyzer.isExtractingVocals.value).toBe(false)
    expect(analyzer.vocalExtractionProgress.value).toBe(1)
    expect(analyzer.vocalExtractionStatus.value).toBe('Vocal stem ready.')
    expect(separateVocalStem).toHaveBeenCalledOnce()

    await analyzer.analyzeFile(createFile({ name: 'next.wav' }))

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:vocals')
    expect(analyzer.vocalPreviewUrl.value).toBeNull()
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

    expect(analyzer.vocalDownloadName.value).toBe('audio-vocals.wav')

    analyzer.selectedFile.value = createFile({ name: 'recording', size: 0, type: 'audio/custom' })
    expect(analyzer.fileStats.value).toEqual(
      expect.arrayContaining([
        { label: 'Type', value: 'audio/custom' },
        { label: 'Size', value: '0 B' },
      ]),
    )
    expect(analyzer.vocalDownloadName.value).toBe('recording-vocals.wav')

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
    expect(analyzer.vocalDownloadName.value).toBe('.hidden-vocals.wav')

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

  test('requires decoded audio before extracting vocals', async () => {
    const analyzer = useAudioAnalyzer()

    await analyzer.extractVocals()

    expect(analyzer.errorMessage.value).toBe(
      'Choose and decode an audio file before extracting vocals.',
    )
    expect(separateVocalStem).not.toHaveBeenCalled()
  })

  test.each([
    [new Error('Separation failed'), 'Separation failed'],
    ['unstructured extraction failure', 'The vocal track could not be created.'],
  ])('cleans up after vocal extraction failure %#', async (failure, expectedMessage) => {
    installAudioContext()
    const urlMock = vi.mocked(URL)
    urlMock.createObjectURL.mockImplementation((value: Blob | MediaSource) =>
      value instanceof Blob ? 'blob:vocals' : 'blob:audio',
    )
    const analyzer = useAudioAnalyzer()
    await analyzer.analyzeFile(createFile())
    await analyzer.extractVocals()
    separateVocalStem.mockRejectedValueOnce(failure)

    await analyzer.extractVocals()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:vocals')
    expect(analyzer.vocalPreviewUrl.value).toBeNull()
    expect(analyzer.errorMessage.value).toBe(expectedMessage)
    expect(analyzer.isExtractingVocals.value).toBe(false)
  })

  test('revokes a vocal preview URL when the owner unmounts', async () => {
    installAudioContext()
    const urlMock = vi.mocked(URL)
    urlMock.createObjectURL.mockImplementation((value: Blob | MediaSource) =>
      value instanceof Blob ? 'blob:vocals' : 'blob:audio',
    )
    const analyzer = useAudioAnalyzer()
    await analyzer.analyzeFile(createFile())
    await analyzer.extractVocals()

    lifecycle.unmount?.()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:vocals')
    expect(analyzer.vocalPreviewUrl.value).toBeNull()
  })
})
