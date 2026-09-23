// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'

import AudioPreviewCard from './AudioPreviewCard.vue'

function mountPreview(source = 'blob:preview-audio') {
  return mount(AudioPreviewCard, {
    props: { source },
    global: {
      stubs: {
        QCard: { template: '<section class="q-card"><slot /></section>' },
        QCardSection: { template: '<div class="q-card-section"><slot /></div>' },
      },
    },
  })
}

describe('AudioPreviewCard', () => {
  test('renders the preview heading and description inside the card', () => {
    const wrapper = mountPreview()

    expect(wrapper.find('[data-testid="audio-preview-card"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="audio-preview-title"]').text()).toBe('Preview')
    expect(wrapper.get('[data-testid="audio-preview-description"]').text()).toBe(
      'Play the selected file without leaving the page.',
    )
  })

  test('renders a controlled audio player with the provided source', () => {
    const wrapper = mountPreview('blob:selected-track')
    const player = wrapper.get<HTMLAudioElement>('[data-testid="audio-player"]')

    expect(player.attributes()).toHaveProperty('controls')
    expect(player.attributes('src')).toBe('blob:selected-track')
  })

  test('updates the audio source when the source prop changes', async () => {
    const wrapper = mountPreview('blob:first-track')

    await wrapper.setProps({ source: 'blob:second-track' })

    expect(wrapper.get('[data-testid="audio-player"]').attributes('src')).toBe('blob:second-track')
  })
})
