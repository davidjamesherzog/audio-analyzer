// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'

import VocalExtractionCard from './VocalExtractionCard.vue'

const defaultProps = {
  isExtracting: false,
  progress: null,
  stems: [],
  status: '',
}

function mountCard(props: Partial<InstanceType<typeof VocalExtractionCard>['$props']> = {}) {
  return mount(VocalExtractionCard, {
    props: { ...defaultProps, ...props },
    global: {
      stubs: {
        QBanner: { template: '<aside class="q-banner"><slot /></aside>' },
        QBtn: {
          name: 'QBtn',
          props: ['disable', 'download', 'href', 'label', 'loading'],
          emits: ['click'],
          template:
            '<button class="q-btn" type="button" :disabled="disable" @click="$emit(\'click\')">{{ label }}</button>',
        },
        QCard: { template: '<section class="q-card"><slot /></section>' },
        QCardSection: { template: '<div class="q-card-section"><slot /></div>' },
        QLinearProgress: {
          name: 'QLinearProgress',
          props: ['indeterminate', 'value'],
          template: '<div class="q-linear-progress" />',
        },
      },
    },
  })
}

describe('VocalExtractionCard', () => {
  test('renders its explanation and idle extraction action', async () => {
    const wrapper = mountCard()
    const button = wrapper.getComponent({ name: 'QBtn' })

    expect(wrapper.get('h2').text()).toBe('Separated stems')
    expect(wrapper.get('.vocal-note').text()).toContain(
      'The first extraction downloads an approximately 172 MB model.',
    )
    expect(button.props()).toMatchObject({
      disable: false,
      label: 'Separate stems',
      loading: false,
    })
    expect(wrapper.find('[data-testid="vocal-progress"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="stem-results"]').exists()).toBe(false)

    await button.trigger('click')

    expect(wrapper.emitted('extract')).toEqual([[]])
  })

  test('shows indeterminate extraction progress and disables the action', () => {
    const wrapper = mountCard({
      isExtracting: true,
      status: 'Preparing the separation model…',
    })
    const button = wrapper.getComponent({ name: 'QBtn' })
    const progress = wrapper.getComponent({ name: 'QLinearProgress' })

    expect(button.props()).toMatchObject({ disable: true, loading: true })
    expect(progress.props()).toMatchObject({ indeterminate: true, value: 0 })
    expect(wrapper.get('[data-testid="vocal-progress"]').text()).toBe(
      'Preparing the separation model…',
    )
  })

  test('shows determinate progress and a status without a progress bar after extraction', async () => {
    const wrapper = mountCard({
      isExtracting: true,
      progress: 0.625,
      status: 'Separating vocals (5/8)…',
    })

    expect(wrapper.getComponent({ name: 'QLinearProgress' }).props()).toMatchObject({
      indeterminate: false,
      value: 0.625,
    })

    await wrapper.setProps({ isExtracting: false, status: 'Vocal stem ready.' })

    expect(wrapper.get('[data-testid="vocal-progress"]').text()).toBe('Vocal stem ready.')
    expect(wrapper.findComponent({ name: 'QLinearProgress' }).exists()).toBe(false)
  })

  test('renders previews and download attributes for all separated stems', () => {
    const wrapper = mountCard({
      stems: [
        {
          downloadName: 'my-song-vocals.wav',
          label: 'Vocals',
          name: 'vocals',
          source: 'blob:vocals',
        },
        {
          downloadName: 'my-song-drums.wav',
          label: 'Drums',
          name: 'drums',
          source: 'blob:drums',
        },
        {
          downloadName: 'my-song-bass.wav',
          label: 'Bass',
          name: 'bass',
          source: 'blob:bass',
        },
        {
          downloadName: 'my-song-other.wav',
          label: 'Other instruments',
          name: 'other',
          source: 'blob:other',
        },
      ],
      status: 'Vocal stem ready.',
    })
    const results = wrapper.findAll('.stem-result')
    const audio = results[0]?.get<HTMLAudioElement>('audio')
    const buttons = wrapper.findAllComponents({ name: 'QBtn' })
    const download = buttons[1]

    expect(results).toHaveLength(4)
    expect(results.map((result) => result.get('h3').text())).toEqual([
      'Vocals',
      'Drums',
      'Bass',
      'Other instruments',
    ])
    expect(audio?.attributes('src')).toBe('blob:vocals')
    expect(download?.props()).toMatchObject({
      download: 'my-song-vocals.wav',
      href: 'blob:vocals',
      label: 'Download Vocals WAV',
    })
  })
})
