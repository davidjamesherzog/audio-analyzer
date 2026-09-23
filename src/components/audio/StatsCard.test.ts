// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'

import type { StatItem } from 'src/composables/useAudioAnalyzer'

import StatsCard from './StatsCard.vue'

function mountStats(items: StatItem[] = []) {
  return mount(StatsCard, {
    props: {
      title: 'File details',
      description: 'Properties of the selected audio file.',
      items,
    },
    global: {
      stubs: {
        QCard: { template: '<section class="q-card"><slot /></section>' },
        QCardSection: { template: '<div class="q-card-section"><slot /></div>' },
      },
    },
  })
}

describe('StatsCard', () => {
  test('renders its title and description inside the card', () => {
    const wrapper = mountStats()

    expect(wrapper.find('[data-testid="stats-card"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="stats-title"]').text()).toBe('File details')
    expect(wrapper.get('[data-testid="stats-description"]').text()).toBe(
      'Properties of the selected audio file.',
    )
  })

  test('renders each statistic as a label and value pair in order', () => {
    const wrapper = mountStats([
      { label: 'Duration', value: '3:42.15' },
      { label: 'Sample rate', value: '48,000 Hz' },
      { label: 'Channels', value: '2 (Stereo)' },
    ])
    const tiles = wrapper.findAll('[data-testid="stat-item"]')

    expect(tiles).toHaveLength(3)
    expect(
      tiles.map((tile) => [
        tile.get('[data-testid="stat-label"]').text(),
        tile.get('[data-testid="stat-value"]').text(),
      ]),
    ).toEqual([
      ['Duration', '3:42.15'],
      ['Sample rate', '48,000 Hz'],
      ['Channels', '2 (Stereo)'],
    ])
  })

  test('renders an empty definition list when there are no statistics', () => {
    const wrapper = mountStats()

    expect(wrapper.find('[data-testid="stats-list"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="stat-item"]')).toHaveLength(0)
  })

  test('updates its content when props change', async () => {
    const wrapper = mountStats([{ label: 'Size', value: '1.0 MB' }])

    await wrapper.setProps({
      title: 'Analysis',
      description: 'Decoded audio measurements.',
      items: [{ label: 'Peak level', value: '-1.25 dBFS' }],
    })

    expect(wrapper.get('[data-testid="stats-title"]').text()).toBe('Analysis')
    expect(wrapper.get('[data-testid="stats-description"]').text()).toBe(
      'Decoded audio measurements.',
    )
    expect(wrapper.get('[data-testid="stat-label"]').text()).toBe('Peak level')
    expect(wrapper.get('[data-testid="stat-value"]').text()).toBe('-1.25 dBFS')
  })
})
