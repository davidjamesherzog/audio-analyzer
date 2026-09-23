// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'

import AudioFilePicker from './AudioFilePicker.vue'

const defaultProps = {
  selectedFile: null,
  errorMessage: '',
  isAnalyzing: false,
}

function mountPicker(props: Partial<InstanceType<typeof AudioFilePicker>['$props']> = {}) {
  return mount(AudioFilePicker, {
    props: { ...defaultProps, ...props },
    global: {
      stubs: {
        QBtn: {
          emits: ['click'],
          template:
            '<button class="q-btn" type="button" @click="$emit(\'click\')"><slot /></button>',
        },
        QBanner: { template: '<div class="q-banner"><slot /></div>' },
        QLinearProgress: { template: '<div class="q-linear-progress" />' },
      },
    },
  })
}

describe('AudioFilePicker', () => {
  test('renders an audio-only file input and hides optional status content by default', () => {
    const wrapper = mountPicker()
    const input = wrapper.get('[data-testid="audio-file-input"]')

    expect(input.attributes('accept')).toBe('audio/*')
    expect(wrapper.find('[data-testid="selected-file"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="error-message"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="analyzing-progress"]').exists()).toBe(false)
  })

  test('shows the selected filename, error, and analyzing indicator', () => {
    const file = new File(['audio'], 'recording.wav', { type: 'audio/wav' })
    const wrapper = mountPicker({
      selectedFile: file,
      errorMessage: 'Unable to decode this file.',
      isAnalyzing: true,
    })

    expect(wrapper.get('[data-testid="selected-file-name"]').text()).toBe('recording.wav')
    expect(wrapper.get('[data-testid="error-message"]').text()).toBe('Unable to decode this file.')
    expect(wrapper.find('[data-testid="analyzing-progress"]').exists()).toBe(true)
  })

  test('clears the current input value and opens the native picker when the button is clicked', async () => {
    const wrapper = mountPicker()
    const input = wrapper.get<HTMLInputElement>('[data-testid="audio-file-input"]')
    const click = vi.spyOn(input.element, 'click')
    Object.defineProperty(input.element, 'value', {
      configurable: true,
      value: 'old.wav',
      writable: true,
    })

    await wrapper.get('[data-testid="choose-audio-button"]').trigger('click')

    expect(input.element.value).toBe('')
    expect(click).toHaveBeenCalledOnce()
  })

  test('emits the first selected file', async () => {
    const wrapper = mountPicker()
    const input = wrapper.get<HTMLInputElement>('[data-testid="audio-file-input"]')
    const firstFile = new File(['first'], 'first.mp3', { type: 'audio/mpeg' })
    const secondFile = new File(['second'], 'second.wav', { type: 'audio/wav' })
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [firstFile, secondFile],
    })

    await input.trigger('change')

    expect(wrapper.emitted('fileSelected')).toEqual([[firstFile]])
  })

  test('does not emit when the file selection is empty', async () => {
    const wrapper = mountPicker()

    await wrapper.get('[data-testid="audio-file-input"]').trigger('change')

    expect(wrapper.emitted('fileSelected')).toBeUndefined()
  })
})
