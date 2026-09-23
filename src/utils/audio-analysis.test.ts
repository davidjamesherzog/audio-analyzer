import { describe, expect, test } from 'vitest'

import { amplitudeToDbfs, analyzeDecodedAudio, type DecodedAudioLike } from './audio-analysis'

function createDecodedAudio(channels: number[][], sampleRate = 48_000): DecodedAudioLike {
  return {
    duration: channels[0] ? channels[0].length / sampleRate : 0,
    sampleRate,
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    getChannelData(channel: number) {
      return new Float32Array(channels[channel] ?? [])
    },
  }
}

describe('audio-analysis', () => {
  test('converts amplitudes to dBFS', () => {
    expect(amplitudeToDbfs(1)).toBe(0)
    expect(amplitudeToDbfs(0)).toBeNull()
    expect(amplitudeToDbfs(0.5)).toBeCloseTo(-6.0206, 4)
  })

  test('summarizes decoded audio across channels', () => {
    const decodedAudio = createDecodedAudio([
      [0, 0.5, -0.5, 1],
      [0.25, -0.25, 0.75, -0.75],
    ])

    const summary = analyzeDecodedAudio(decodedAudio)

    expect(summary.durationSeconds).toBeCloseTo(4 / 48_000)
    expect(summary.sampleRate).toBe(48_000)
    expect(summary.numberOfChannels).toBe(2)
    expect(summary.frameCount).toBe(4)
    expect(summary.sampleCount).toBe(8)
    expect(summary.peakAmplitude).toBe(1)
    expect(summary.peakDbfs).toBe(0)
    expect(summary.rmsAmplitude).toBeCloseTo(0.5863, 4)
    expect(summary.rmsDbfs).toBeCloseTo(-4.6376, 4)
    expect(summary.channelAnalyses).toHaveLength(2)
    expect(summary.channelAnalyses[0]?.peakAmplitude).toBe(1)
    expect(summary.channelAnalyses[0]?.rmsAmplitude).toBeCloseTo(0.6124, 4)
    expect(summary.channelAnalyses[1]?.peakAmplitude).toBe(0.75)
    expect(summary.channelAnalyses[1]?.rmsAmplitude).toBeCloseTo(0.559, 3)
  })
})
