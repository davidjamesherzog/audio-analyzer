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

      <fieldset class="stem-selection" :disabled="isExtracting">
        <legend>Tracks to separate</legend>
        <p>Choose the tracks you want before starting separation.</p>
        <div class="stem-selection__options">
          <q-checkbox
            v-for="stem in availableStems"
            :key="stem.name"
            v-model="selectedStemNames"
            :data-testid="`stem-selector-${stem.name}`"
            :label="stem.label"
            :val="stem.name"
          />
        </div>
      </fieldset>

      <q-btn
        data-testid="extract-stems-button"
        color="secondary"
        icon="graphic_eq"
        label="Separate stems"
        no-caps
        unelevated
        :loading="isExtracting"
        :disable="isExtracting || selectedStemNames.length === 0"
        @click="$emit('extract', selectedStemNames)"
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
        <div class="stem-export-controls">
          <div>
            <h3>Selected tracks are ready</h3>
            <p>Preview each track below or download all of the chosen WAV files.</p>
          </div>
          <q-btn
            data-testid="export-selected-button"
            color="primary"
            icon="download"
            :label="exportButtonLabel"
            no-caps
            unelevated
            @click="$emit('export', stems.map(({ name }) => name))"
          />
        </div>

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
import { computed, ref } from 'vue'

import type { StemPreview } from 'src/composables/useAudioAnalyzer'
import type { StemName } from 'src/utils/demucs-separation'

const props = defineProps<{
  isExtracting: boolean
  progress: number | null
  stems: StemPreview[]
  status: string
}>()

defineEmits<{
  extract: [stemNames: StemName[]]
  export: [stemNames: StemName[]]
}>()

const availableStems: Array<{ label: string; name: StemName }> = [
  { label: 'Vocals', name: 'vocals' },
  { label: 'Drums', name: 'drums' },
  { label: 'Bass', name: 'bass' },
  { label: 'Other instruments', name: 'other' },
]
const selectedStemNames = ref<StemName[]>(availableStems.map(({ name }) => name))
const exportButtonLabel = computed(() => {
  const count = props.stems.length
  return `Download ${count} selected ${count === 1 ? 'track' : 'tracks'}`
})
</script>
