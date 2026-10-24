<template>
  <q-card data-testid="vocal-extraction-card" flat bordered class="info-card">
    <q-card-section>
      <div class="section-heading">
        <h2>Source separation</h2>
        <p>
          Choose the separation process that fits your track. Audio is processed locally and is
          never uploaded.
        </p>
      </div>

      <div class="separation-mode" data-testid="separation-mode-selector">
        <q-option-group
          v-model="separationMode"
          :options="separationOptions"
          color="secondary"
          type="radio"
          :disable="isExtracting || isRunningAdvancedSeparation"
        />
        <p v-if="!nativeSixStemAvailable" class="separation-mode__availability">
          Advanced separation is available in the desktop app.
        </p>
      </div>

      <div v-if="separationMode === 'basic'" data-testid="basic-separation-controls">
        <q-banner rounded class="vocal-note">
          The first extraction downloads an approximately 172 MB model. Processing may take
          several minutes, depending on the track and your device.
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
          label="Separate 4 stems"
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
      </div>

      <div v-else data-testid="advanced-separation-controls" class="advanced-separation">
        <q-banner rounded class="advanced-note">
          Advanced separation creates vocals, drums, bass, guitar, piano, and other as WAV files
          using the native Demucs helper. The first run downloads and caches its model.
        </q-banner>
        <p>
          Choose the tracks you want, then choose a WAV or MP3 source and an output folder.
        </p>
        <fieldset class="stem-selection" :disabled="isRunningAdvancedSeparation">
          <legend>Tracks to separate</legend>
          <p>Choose one or more of the six available tracks.</p>
          <div class="stem-selection__options">
            <q-checkbox
              v-for="stem in advancedStems"
              :key="stem.name"
              v-model="selectedAdvancedStemNames"
              :data-testid="`advanced-stem-selector-${stem.name}`"
              :label="stem.label"
              :val="stem.name"
            />
          </div>
        </fieldset>
        <q-btn
          data-testid="advanced-six-stem-button"
          color="secondary"
          icon="graphic_eq"
          label="Separate 6 stems"
          no-caps
          unelevated
          :loading="isRunningAdvancedSeparation"
          :disable="isRunningAdvancedSeparation || selectedAdvancedStemNames.length === 0"
          @click="runAdvancedSeparation"
        />
        <q-banner v-if="advancedMessage" data-testid="advanced-separation-message" rounded>
          {{ advancedMessage }}
        </q-banner>
      </div>

      <div
        v-if="separationMode === 'basic' && stems.length"
        data-testid="stem-results"
        class="stem-results"
      >
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
const advancedStems: Array<{ label: string; name: SixStemName }> = [
  { label: 'Vocals', name: 'vocals' },
  { label: 'Drums', name: 'drums' },
  { label: 'Bass', name: 'bass' },
  { label: 'Guitar', name: 'guitar' },
  { label: 'Piano', name: 'piano' },
  { label: 'Other instruments', name: 'other' },
]
const selectedAdvancedStemNames = ref<SixStemName[]>(advancedStems.map(({ name }) => name))
const nativeSixStemAvailable = typeof window !== 'undefined' && Boolean(window.sixStemSeparation)
const separationMode = ref<'advanced' | 'basic'>('basic')
const isRunningAdvancedSeparation = ref(false)
const advancedMessage = ref('')
const separationOptions = computed(() => [
  {
    label: 'Basic · 4 stems',
    value: 'basic',
    caption: 'Vocals, drums, bass, and other · runs in the browser',
  },
  {
    label: 'Advanced · 6 stems',
    value: 'advanced',
    caption: 'Adds guitar and piano · uses the native desktop helper',
    disable: !nativeSixStemAvailable,
  },
])
const exportButtonLabel = computed(() => {
  const count = props.stems.length
  return `Download ${count} selected ${count === 1 ? 'track' : 'tracks'}`
})

async function runAdvancedSeparation() {
  if (!window.sixStemSeparation) return

  advancedMessage.value = ''
  isRunningAdvancedSeparation.value = true
  try {
    const result = await window.sixStemSeparation.run(selectedAdvancedStemNames.value)
    if (result.error) {
      advancedMessage.value = result.error
    } else if (result.outputDirectory) {
      advancedMessage.value = `Selected stems written to ${result.outputDirectory}`
    }
  } catch (error) {
    advancedMessage.value =
      error instanceof Error ? error.message : 'Native six-stem separation failed.'
  } finally {
    isRunningAdvancedSeparation.value = false
  }
}
</script>
