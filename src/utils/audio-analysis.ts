export interface DecodedAudioLike {
  duration: number
  sampleRate: number
  numberOfChannels: number
  length: number
  getChannelData(channel: number): Float32Array
}

export interface ChannelAnalysis {
  channelNumber: number
  peakAmplitude: number
  peakDbfs: number | null
  rmsAmplitude: number
  rmsDbfs: number | null
}

export interface AudioAnalysisSummary {
  durationSeconds: number
  sampleRate: number
  numberOfChannels: number
  frameCount: number
  sampleCount: number
  peakAmplitude: number
  peakDbfs: number | null
  rmsAmplitude: number
  rmsDbfs: number | null
  channelAnalyses: ChannelAnalysis[]
}

export function amplitudeToDbfs(amplitude: number): number | null {
  if (amplitude <= 0) {
    return null
  }

  return 20 * Math.log10(amplitude)
}

function calculatePeakAmplitude(samples: Float32Array): number {
  let peak = 0

  for (const sample of samples) {
    const absoluteValue = Math.abs(sample)

    if (absoluteValue > peak) {
      peak = absoluteValue
    }
  }

  return peak
}

function calculateRmsAmplitude(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0
  }

  let sumOfSquares = 0

  for (const sample of samples) {
    sumOfSquares += sample * sample
  }

  return Math.sqrt(sumOfSquares / samples.length)
}

export function analyzeDecodedAudio(decodedAudio: DecodedAudioLike): AudioAnalysisSummary {
  const channelAnalyses: ChannelAnalysis[] = []
  let peakAmplitude = 0
  let totalSquareSum = 0
  let sampleCount = 0

  for (let channelIndex = 0; channelIndex < decodedAudio.numberOfChannels; channelIndex += 1) {
    const channelData = decodedAudio.getChannelData(channelIndex)
    const channelPeak = calculatePeakAmplitude(channelData)
    const channelRms = calculateRmsAmplitude(channelData)

    peakAmplitude = Math.max(peakAmplitude, channelPeak)
    sampleCount += channelData.length
    totalSquareSum += channelRms * channelRms * channelData.length

    channelAnalyses.push({
      channelNumber: channelIndex + 1,
      peakAmplitude: channelPeak,
      peakDbfs: amplitudeToDbfs(channelPeak),
      rmsAmplitude: channelRms,
      rmsDbfs: amplitudeToDbfs(channelRms),
    })
  }

  const rmsAmplitude = sampleCount === 0 ? 0 : Math.sqrt(totalSquareSum / sampleCount)

  return {
    durationSeconds: decodedAudio.duration,
    sampleRate: decodedAudio.sampleRate,
    numberOfChannels: decodedAudio.numberOfChannels,
    frameCount: decodedAudio.length,
    sampleCount,
    peakAmplitude,
    peakDbfs: amplitudeToDbfs(peakAmplitude),
    rmsAmplitude,
    rmsDbfs: amplitudeToDbfs(rmsAmplitude),
    channelAnalyses,
  }
}
