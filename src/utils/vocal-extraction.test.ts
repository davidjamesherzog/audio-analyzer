import { describe, expect, test } from 'vitest'

import { encodeStereoWav } from './vocal-extraction'

describe('extractCenteredVocals', () => {
  test('encodes separate left and right channels as stereo PCM', async () => {
    const wav = new DataView(
      await encodeStereoWav(new Float32Array([1, -1]), new Float32Array([0.5, -0.5]), 44_100).arrayBuffer(),
    )

    expect(wav.getUint16(22, true)).toBe(2)
    expect(readAscii(wav, 0, 4)).toBe('RIFF')
    expect(readAscii(wav, 8, 4)).toBe('WAVE')
    expect(wav.getUint32(24, true)).toBe(44_100)
    expect(wav.getUint16(32, true)).toBe(4)
    expect(wav.getInt16(44, true)).toBe(32_767)
    expect(wav.getInt16(46, true)).toBe(16_384)
    expect(wav.getInt16(48, true)).toBe(-32_768)
    expect(wav.getInt16(50, true)).toBe(-16_384)
  })

  test('uses the shortest channel and clamps samples outside the PCM range', async () => {
    const wav = new DataView(
      await encodeStereoWav(
        new Float32Array([2, 0.25, 0.75]),
        new Float32Array([-2, -0.25]),
        48_000,
      ).arrayBuffer(),
    )

    expect(wav.getUint32(40, true)).toBe(8)
    expect(wav.getInt16(44, true)).toBe(32_767)
    expect(wav.getInt16(46, true)).toBe(-32_768)
    expect(wav.getInt16(48, true)).toBe(8_192)
    expect(wav.getInt16(50, true)).toBe(-8_192)
  })

  test('defensively encodes missing channel samples as silence', async () => {
    const missingSampleChannel = { length: 1 } as Float32Array
    const wav = new DataView(
      await encodeStereoWav(missingSampleChannel, missingSampleChannel, 8_000).arrayBuffer(),
    )

    expect(wav.getUint32(40, true)).toBe(4)
    expect(wav.getInt16(44, true)).toBe(0)
    expect(wav.getInt16(46, true)).toBe(0)
  })
})

function readAscii(view: DataView, offset: number, length: number): string {
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join(
    '',
  )
}
