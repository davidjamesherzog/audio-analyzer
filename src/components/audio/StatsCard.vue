<template>
  <q-card data-testid="stats-card" flat bordered class="info-card">
    <q-card-section>
      <div class="section-heading">
        <h2 data-testid="stats-title">{{ title }}</h2>
        <p data-testid="stats-description">{{ description }}</p>
      </div>

      <dl data-testid="stats-list" class="stats-grid">
        <div v-for="item in items" :key="item.label" data-testid="stat-item" class="stat-tile">
          <dt data-testid="stat-label">{{ item.label }}</dt>
          <dd data-testid="stat-value">{{ item.value }}</dd>
        </div>
      </dl>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import type { StatItem } from 'src/composables/useAudioAnalyzer'

defineProps<{
  title: string
  description: string
  items: StatItem[]
}>()
</script>
