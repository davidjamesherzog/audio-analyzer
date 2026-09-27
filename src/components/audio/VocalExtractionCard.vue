<template>
  <q-card data-testid="vocal-extraction-card" flat bordered class="info-card">
    <q-card-section>
      <div class="section-heading">
        <h2>Vocal stem</h2>
        <p>
          Use the Demucs source-separation model to split vocals from the instrumental mix.
          Processing stays on this device.
        </p>
      </div>

      <q-banner rounded class="vocal-note">
        The first extraction downloads an approximately 172 MB model. Processing may take several
        minutes, depending on the track and your device.
      </q-banner>

      <q-btn
        data-testid="extract-vocals-button"
        color="secondary"
        icon="graphic_eq"
        label="Extract vocals"
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

      <div v-if="source" data-testid="vocal-result" class="vocal-result">
        <audio data-testid="vocal-audio-player" class="audio-player" controls :src="source"></audio>
        <q-btn
          data-testid="download-vocals-button"
          color="primary"
          icon="download"
          label="Download vocal WAV"
          no-caps
          outline
          :href="source"
          :download="downloadName"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
defineProps<{
  downloadName: string
  isExtracting: boolean
  progress: number | null
  source: string | null
  status: string
}>()

defineEmits<{
  extract: []
}>()
</script>
