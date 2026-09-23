<template>
  <div class="picker-panel">
    <input
      ref="fileInputRef"
      data-testid="audio-file-input"
      class="hidden-file-input"
      type="file"
      accept="audio/*"
      @change="handleFileSelection"
    />

    <q-btn
      data-testid="choose-audio-button"
      color="primary"
      icon="folder_open"
      label="Choose audio file"
      no-caps
      unelevated
      @click="openFilePicker"
    />

    <div v-if="selectedFile" data-testid="selected-file" class="selected-file">
      <span class="selected-file__label">Selected file</span>
      <span data-testid="selected-file-name" class="selected-file__name">{{
        selectedFile.name
      }}</span>
    </div>

    <q-banner
      v-if="errorMessage"
      data-testid="error-message"
      rounded
      class="bg-negative text-white"
    >
      {{ errorMessage }}
    </q-banner>

    <q-linear-progress
      v-if="isAnalyzing"
      data-testid="analyzing-progress"
      indeterminate
      color="accent"
      rounded
      size="10px"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  selectedFile: File | null
  errorMessage: string
  isAnalyzing: boolean
}>()

const emit = defineEmits<{
  fileSelected: [file: File]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

function openFilePicker() {
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
    fileInputRef.value.click()
  }
}

function handleFileSelection(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (file) {
    emit('fileSelected', file)
  }
}
</script>
