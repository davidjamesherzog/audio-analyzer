import { computed, onBeforeUnmount, ref } from 'vue'

import { analyzeDecodedAudio, type AudioAnalysisSummary } from 'src/utils/audio-analysis'

export interface StatItem {
  label: string
  value: string
}

type WebkitWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

const numberFormatter = new Intl.NumberFormat('en-US')

export function useAudioAnalyzer() {
  const selectedFile = ref<File | null>(null)
  const analysis = ref<AudioAnalysisSummary | null>(null)
  const previewUrl = ref<string | null>(null)
  const errorMessage = ref('')
  const isAnalyzing = ref(false)

  const fileStats = computed<StatItem[]>(() => {
    if (!selectedFile.value) {
      return []
    }

    const file = selectedFile.value

    return [
      { label: 'File name', value: file.name },
      { label: 'Type', value: file.type || detectExtension(file.name) || 'Unknown' },
      { label: 'Size', value: formatBytes(file.size) },
      { label: 'Last modified', value: new Date(file.lastModified).toLocaleString() },
    ]
  })

  const overallAnalysisStats = computed<StatItem[]>(() => {
    if (!analysis.value) {
      return []
    }

    return [
      { label: 'Duration', value: formatDuration(analysis.value.durationSeconds) },
      { label: 'Sample rate', value: `${numberFormatter.format(analysis.value.sampleRate)} Hz` },
      {
        label: 'Channels',
        value: `${analysis.value.numberOfChannels} (${channelLayoutLabel(analysis.value.numberOfChannels)})`,
      },
      { label: 'Frames', value: numberFormatter.format(analysis.value.frameCount) },
      { label: 'Decoded samples', value: numberFormatter.format(analysis.value.sampleCount) },
      { label: 'Peak level', value: formatDbfs(analysis.value.peakDbfs) },
      { label: 'Peak amplitude', value: formatAmplitude(analysis.value.peakAmplitude) },
      { label: 'RMS level', value: formatDbfs(analysis.value.rmsDbfs) },
    ]
  })

  async function analyzeFile(nextFile: File) {
    selectedFile.value = nextFile
    errorMessage.value = ''
    analysis.value = null
    setPreviewUrl(URL.createObjectURL(nextFile))
    isAnalyzing.value = true

    try {
      const arrayBuffer = await nextFile.arrayBuffer()
      const audioContext = createAudioContext()

      try {
        const decodedAudio = await audioContext.decodeAudioData(arrayBuffer.slice(0))
        analysis.value = analyzeDecodedAudio(decodedAudio)
      } finally {
        await audioContext.close()
      }
    } catch (error) {
      analysis.value = null
      errorMessage.value =
        error instanceof Error
          ? error.message
          : 'The selected file could not be decoded by the browser audio engine.'
    } finally {
      isAnalyzing.value = false
    }
  }

  function setPreviewUrl(nextUrl: string | null) {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
    }

    previewUrl.value = nextUrl
  }

  onBeforeUnmount(() => {
    setPreviewUrl(null)
  })

  return {
    analysis,
    analyzeFile,
    errorMessage,
    fileStats,
    isAnalyzing,
    overallAnalysisStats,
    previewUrl,
    selectedFile,
  }
}

function createAudioContext(): AudioContext {
  const AudioContextConstructor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext

  if (!AudioContextConstructor) {
    throw new Error('This browser does not support the Web Audio API needed for analysis.')
  }

  return new AudioContextConstructor()
}

function formatBytes(size: number): string {
  if (size === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  const value = size / 1024 ** unitIndex

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDuration(durationSeconds: number): string {
  const hours = Math.floor(durationSeconds / 3600)
  const minutes = Math.floor((durationSeconds % 3600) / 60)
  const seconds = durationSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`
  }

  return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`
}

function formatDbfs(value: number | null): string {
  return value === null ? 'Silence' : `${value.toFixed(2)} dBFS`
}

function formatAmplitude(value: number): string {
  return value.toFixed(4)
}

function detectExtension(fileName: string): string | null {
  const parts = fileName.split('.')
  const extension = parts.at(-1)

  return extension ? extension.toUpperCase() : null
}

function channelLayoutLabel(channelCount: number): string {
  if (channelCount === 1) {
    return 'Mono'
  }

  if (channelCount === 2) {
    return 'Stereo'
  }

  return 'Multichannel'
}
