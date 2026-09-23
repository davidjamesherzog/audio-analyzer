<template>
  <q-page class="analyzer-page">
    <div class="analyzer-shell">
      <section class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Local Audio Inspection</p>
          <h1 data-testid="page-title">Pick a file and inspect its signal data in the browser.</h1>
          <p class="hero-text">
            The app decodes the selected audio file locally and reports file metadata, duration,
            sample rate, channel count, peak level, and RMS level.
          </p>
        </div>

        <audio-file-picker
          :selected-file="selectedFile"
          :error-message="errorMessage"
          :is-analyzing="isAnalyzing"
          @file-selected="analyzeFile"
        />
      </section>

      <section v-if="selectedFile" data-testid="file-content" class="content-grid">
        <stats-card
          title="File details"
          description="Basic metadata from the selected file."
          :items="fileStats"
        />
        <audio-preview-card v-if="previewUrl" :source="previewUrl" />
      </section>

      <section v-if="analysis" data-testid="analysis-content" class="content-grid">
        <stats-card
          title="Overall analysis"
          description="Decoded PCM data measured after loading the file into Web Audio."
          :items="overallAnalysisStats"
        />
        <channel-levels-card
          :channels="analysis.channelAnalyses"
          :channel-count="analysis.numberOfChannels"
        />
      </section>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import AudioFilePicker from 'src/components/audio/AudioFilePicker.vue'
import AudioPreviewCard from 'src/components/audio/AudioPreviewCard.vue'
import ChannelLevelsCard from 'src/components/audio/ChannelLevelsCard.vue'
import StatsCard from 'src/components/audio/StatsCard.vue'
import { useAudioAnalyzer } from 'src/composables/useAudioAnalyzer'

const {
  analysis,
  analyzeFile,
  errorMessage,
  fileStats,
  isAnalyzing,
  overallAnalysisStats,
  previewUrl,
  selectedFile,
} = useAudioAnalyzer()
</script>
