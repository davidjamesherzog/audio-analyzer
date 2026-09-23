// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'

import type { ChannelAnalysis } from 'src/utils/audio-analysis'

import ChannelLevelsCard from './ChannelLevelsCard.vue'

const stereoChannels: ChannelAnalysis[] = [
  {
    channelNumber: 1,
    peakAmplitude: 0.8,
    peakDbfs: -1.9382,
    rmsAmplitude: 0.25,
    rmsDbfs: -12.0412,
  },
  {
    channelNumber: 2,
    peakAmplitude: 0,
    peakDbfs: null,
    rmsAmplitude: 0,
    rmsDbfs: null,
  },
]

function mountLevels(channels: ChannelAnalysis[] = stereoChannels, channelCount = 2) {
  return mount(ChannelLevelsCard, {
    props: { channels, channelCount },
    global: {
      stubs: {
        QCard: { template: '<section class="q-card"><slot /></section>' },
        QCardSection: { template: '<div class="q-card-section"><slot /></div>' },
        QBadge: { template: '<span class="q-badge"><slot /></span>' },
        QLinearProgress: {
          name: 'QLinearProgress',
          props: ['value', 'color', 'size', 'rounded'],
          template: '<div class="q-linear-progress" />',
        },
      },
    },
  })
}

describe('ChannelLevelsCard', () => {
  test('renders its heading and an empty channel list when no analysis is provided', () => {
    const wrapper = mountLevels([], 0)

    expect(wrapper.find('[data-testid="channel-levels-card"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="channel-levels-title"]').text()).toBe('Per-channel levels')
    expect(wrapper.get('[data-testid="channel-levels-description"]').text()).toBe(
      'Peak and RMS measurements for each decoded audio channel.',
    )
    expect(wrapper.findAll('[data-testid="channel-card"]')).toHaveLength(0)
  })

  test('labels stereo channels as left and right', () => {
    const wrapper = mountLevels()

    expect(wrapper.findAll('[data-testid="channel-card"]')).toHaveLength(2)
    expect(
      wrapper.findAll('[data-testid="channel-title"]').map((heading) => heading.text()),
    ).toEqual(['Channel 1', 'Channel 2'])
    expect(wrapper.findAll('[data-testid="channel-label"]').map((badge) => badge.text())).toEqual([
      'Left',
      'Right',
    ])
  })

  test('formats amplitudes and dBFS values, including silent channels', () => {
    const wrapper = mountLevels()
    const cards = wrapper.findAll('[data-testid="channel-card"]')

    expect(cards[0]?.get('[data-testid="peak-amplitude"]').text()).toBe('0.8000')
    expect(cards[0]?.get('[data-testid="rms-amplitude"]').text()).toBe('0.2500')
    expect(cards[0]?.get('[data-testid="peak-dbfs"]').text()).toBe('-1.94 dBFS')
    expect(cards[0]?.get('[data-testid="rms-dbfs"]').text()).toBe('-12.04 dBFS')
    expect(cards[1]?.get('[data-testid="peak-amplitude"]').text()).toBe('0.0000')
    expect(cards[1]?.get('[data-testid="rms-amplitude"]').text()).toBe('0.0000')
    expect(cards[1]?.get('[data-testid="peak-dbfs"]').text()).toBe('Silence')
    expect(cards[1]?.get('[data-testid="rms-dbfs"]').text()).toBe('Silence')
  })

  test('passes peak and RMS amplitudes to their progress meters', () => {
    const wrapper = mountLevels([stereoChannels[0] as ChannelAnalysis], 1)
    const meters = wrapper.findAllComponents({ name: 'QLinearProgress' })

    expect(meters).toHaveLength(2)
    expect(
      meters.map((meter) => ({ value: meter.props('value'), color: meter.props('color') })),
    ).toEqual([
      { value: 0.8, color: 'primary' },
      { value: 0.25, color: 'accent' },
    ])
  })

  test('uses numbered labels for non-stereo layouts and reacts to channel-count changes', async () => {
    const wrapper = mountLevels(stereoChannels, 4)

    expect(wrapper.findAll('[data-testid="channel-label"]').map((badge) => badge.text())).toEqual([
      'Ch 1',
      'Ch 2',
    ])

    await wrapper.setProps({ channelCount: 2 })

    expect(wrapper.findAll('[data-testid="channel-label"]').map((badge) => badge.text())).toEqual([
      'Left',
      'Right',
    ])
  })
})
