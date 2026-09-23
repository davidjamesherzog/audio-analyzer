<template>
  <q-card data-testid="audio-preview-card" flat bordered class="info-card">
    <q-card-section>
      <div class="section-heading">
        <h2 data-testid="audio-preview-title">Preview</h2>
        <p data-testid="audio-preview-description">
          Play the selected file without leaving the page.
        </p>
      </div>

      <audio data-testid="audio-player" class="audio-player" controls :src="source"></audio>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
defineProps<{
  source: string
}>()
</script>
