// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { StatItem } from 'src/composables/useAudioAnalyzer'
import type { AudioAnalysisSummary } from 'src/utils/audio-analysis'

import IndexPage from './IndexPage.vue'

const analyzeFile = vi.fn()

const analyzer = {
  analysis: ref<AudioAnalysisSummary | null>(null),
  analyzeFile,
  errorMessage: ref(''),
  fileStats: ref<StatItem[]>([]),
  isAnalyzing: ref(false),
  overallAnalysisStats: ref<StatItem[]>([]),
  previewUrl: ref<string | null>(null),
  selectedFile: ref<File | null>(null),
}

vi.mock('src/composables/useAudioAnalyzer', () => ({
  useAudioAnalyzer: () => analyzer,
}))

const analysis: AudioAnalysisSummary = {
  durationSeconds: 1,
  sampleRate: 48_000,
  numberOfChannels: 1,
  frameCount: 48_000,
  sampleCount: 48_000,
  peakAmplitude: 0.75,
  peakDbfs: -2.5,
  rmsAmplitude: 0.25,
  rmsDbfs: -12.04,
  channelAnalyses: [
    {
      channelNumber: 1,
      peakAmplitude: 0.75,
      peakDbfs: -2.5,
      rmsAmplitude: 0.25,
      rmsDbfs: -12.04,
    },
  ],
}

function mountPage() {
  return mount(IndexPage, {
    global: {
      stubs: {
        QPage: { template: '<main class="q-page"><slot /></main>' },
        AudioFilePicker: {
          name: 'AudioFilePicker',
          props: ['selectedFile', 'errorMessage', 'isAnalyzing'],
          emits: ['fileSelected'],
          template: '<div class="audio-file-picker" />',
        },
        StatsCard: {
          name: 'StatsCard',
          props: ['title', 'description', 'items'],
          template: '<div class="stats-card" />',
        },
        AudioPreviewCard: {
          name: 'AudioPreviewCard',
          props: ['source'],
          template: '<div class="audio-preview-card" />',
        },
        ChannelLevelsCard: {
          name: 'ChannelLevelsCard',
          props: ['channels', 'channelCount'],
          template: '<div class="channel-levels-card" />',
        },
      },
    },
  })
}

beforeEach(() => {
  analyzer.analysis.value = null
  analyzer.errorMessage.value = ''
  analyzer.fileStats.value = []
  analyzer.isAnalyzing.value = false
  analyzer.overallAnalysisStats.value = []
  analyzer.previewUrl.value = null
  analyzer.selectedFile.value = null
  analyzeFile.mockReset()
})

describe('IndexPage', () => {
  test('renders the introduction and only the file picker before a file is selected', () => {
    const wrapper = mountPage()
    const picker = wrapper.getComponent({ name: 'AudioFilePicker' })

    expect(wrapper.get('[data-testid="page-title"]').text()).toBe(
      'Pick a file and inspect its signal data in the browser.',
    )
    expect(picker.props()).toMatchObject({
      selectedFile: null,
      errorMessage: '',
      isAnalyzing: false,
    })
    expect(wrapper.find('[data-testid="file-content"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="analysis-content"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'StatsCard' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'AudioPreviewCard' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'ChannelLevelsCard' }).exists()).toBe(false)
  })

  test('passes picker state through and analyzes files emitted by the picker', async () => {
    const file = new File(['audio'], 'track.wav', { type: 'audio/wav' })
    analyzer.errorMessage.value = 'Decode failed'
    analyzer.isAnalyzing.value = true
    const wrapper = mountPage()
    const picker = wrapper.getComponent({ name: 'AudioFilePicker' })

    picker.vm.$emit('fileSelected', file)
    await wrapper.vm.$nextTick()

    expect(picker.props('errorMessage')).toBe('Decode failed')
    expect(picker.props('isAnalyzing')).toBe(true)
    expect(analyzeFile).toHaveBeenCalledOnce()
    expect(analyzeFile).toHaveBeenCalledWith(file)
  })

  test('shows file details and a preview after a file is selected', () => {
    const file = new File(['audio'], 'track.wav', { type: 'audio/wav' })
    const fileStats = [{ label: 'File name', value: 'track.wav' }]
    analyzer.selectedFile.value = file
    analyzer.fileStats.value = fileStats
    analyzer.previewUrl.value = 'blob:track-preview'
    const wrapper = mountPage()
    const stats = wrapper.getComponent({ name: 'StatsCard' })
    const preview = wrapper.getComponent({ name: 'AudioPreviewCard' })

    expect(stats.props()).toMatchObject({
      title: 'File details',
      description: 'Basic metadata from the selected file.',
      items: fileStats,
    })
    expect(preview.props('source')).toBe('blob:track-preview')
    expect(wrapper.findComponent({ name: 'ChannelLevelsCard' }).exists()).toBe(false)
  })

  test('shows overall statistics and channel levels when analysis is available', () => {
    const overallStats = [{ label: 'Duration', value: '0:01.00' }]
    analyzer.analysis.value = analysis
    analyzer.overallAnalysisStats.value = overallStats
    const wrapper = mountPage()
    const stats = wrapper.getComponent({ name: 'StatsCard' })
    const levels = wrapper.getComponent({ name: 'ChannelLevelsCard' })

    expect(stats.props()).toMatchObject({
      title: 'Overall analysis',
      description: 'Decoded PCM data measured after loading the file into Web Audio.',
      items: overallStats,
    })
    expect(levels.props('channels')).toEqual(analysis.channelAnalyses)
    expect(levels.props('channelCount')).toBe(1)
  })

  test('does not show an audio preview until a preview URL exists', () => {
    analyzer.selectedFile.value = new File(['audio'], 'track.wav')

    const wrapper = mountPage()

    expect(wrapper.findComponent({ name: 'StatsCard' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'AudioPreviewCard' }).exists()).toBe(false)
  })
})
