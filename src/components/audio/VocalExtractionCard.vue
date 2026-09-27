<template>
  <q-card data-testid="vocal-extraction-card" flat bordered class="info-card">
    <q-card-section>
      <div class="section-heading">
        <h2>Separated stems</h2>
        <p>
          Use the Demucs source-separation model to split vocals, drums, bass, and other
          instruments. Processing stays on this device.
        </p>
      </div>

      <q-banner rounded class="vocal-note">
        The first extraction downloads an approximately 172 MB model. Processing may take several
        minutes, depending on the track and your device.
      </q-banner>

      <q-btn
        data-testid="extract-stems-button"
        color="secondary"
        icon="graphic_eq"
        label="Separate stems"
        no-caps
        unelevated
        :loading="isExtracting"
        :disable="isExtracting"
        @click="$emit('extract')"
      />

      <div v-if="isExtracting || status" data-testid="vocal-progress" class="vocal-progress">
        <q-linear-progress
          v-if="isExtracting"
          color="secondary"
          rounded
          size="10px"
          :indeterminate="progress === null"
          :value="progress ?? 0"
        />
        <span>{{ status }}</span>
      </div>

      <div v-if="stems.length" data-testid="stem-results" class="stem-results">
        <section
          v-for="stem in stems"
          :key="stem.name"
          :data-testid="`stem-result-${stem.name}`"
          class="stem-result"
        >
          <h3>{{ stem.label }}</h3>
          <audio class="audio-player" controls :src="stem.source"></audio>
          <q-btn
            color="primary"
            icon="download"
            :label="`Download ${stem.label} WAV`"
            no-caps
            outline
            :href="stem.source"
            :download="stem.downloadName"
          />
        </section>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import type { StemPreview } from 'src/composables/useAudioAnalyzer'

defineProps<{
  isExtracting: boolean
  progress: number | null
  stems: StemPreview[]
  status: string
}>()

defineEmits<{
  extract: []
}>()
</script>
