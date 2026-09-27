export function encodeStereoWav(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): Blob {
  const frameCount = Math.min(left.length, right.length)
  const channelCount = 2
  const bytesPerSample = 2
  const blockAlign = channelCount * bytesPerSample
  const headerSize = 44
  const dataSize = frameCount * blockAlign
  const buffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  for (let frame = 0; frame < frameCount; frame += 1) {
    writePcm16(view, headerSize + frame * blockAlign, left[frame] ?? 0)
    writePcm16(view, headerSize + frame * blockAlign + bytesPerSample, right[frame] ?? 0)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writePcm16(view: DataView, offset: number, value: number) {
  const sample = clampSample(value)
  const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  view.setInt16(offset, Math.round(pcm), true)
}

function clampSample(sample: number): number {
  return Math.max(-1, Math.min(1, sample))
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}
