<template>
  <q-card data-testid="channel-levels-card" flat bordered class="info-card">
    <q-card-section>
      <div class="section-heading">
        <h2 data-testid="channel-levels-title">Per-channel levels</h2>
        <p data-testid="channel-levels-description">
          Peak and RMS measurements for each decoded audio channel.
        </p>
      </div>

      <div data-testid="channel-list" class="channel-list">
        <div
          v-for="channel in channels"
          :key="channel.channelNumber"
          data-testid="channel-card"
          class="channel-card"
        >
          <div class="channel-card__header">
            <h3 data-testid="channel-title">Channel {{ channel.channelNumber }}</h3>
            <q-badge data-testid="channel-label" color="secondary" text-color="dark">
              {{ channelLabel(channel.channelNumber) }}
            </q-badge>
          </div>

          <div class="meter-group">
            <div class="meter-row">
              <div>
                <span class="meter-label">Peak</span>
                <strong data-testid="peak-amplitude">{{
                  formatAmplitude(channel.peakAmplitude)
                }}</strong>
              </div>
              <span data-testid="peak-dbfs">{{ formatDbfs(channel.peakDbfs) }}</span>
            </div>
            <q-linear-progress rounded color="primary" :value="channel.peakAmplitude" size="10px" />
          </div>

          <div class="meter-group">
            <div class="meter-row">
              <div>
                <span class="meter-label">RMS</span>
                <strong data-testid="rms-amplitude">{{
                  formatAmplitude(channel.rmsAmplitude)
                }}</strong>
              </div>
              <span data-testid="rms-dbfs">{{ formatDbfs(channel.rmsDbfs) }}</span>
            </div>
            <q-linear-progress rounded color="accent" :value="channel.rmsAmplitude" size="10px" />
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import type { ChannelAnalysis } from 'src/utils/audio-analysis'

const props = defineProps<{
  channels: ChannelAnalysis[]
  channelCount: number
}>()

function formatDbfs(value: number | null): string {
  return value === null ? 'Silence' : `${value.toFixed(2)} dBFS`
}

function formatAmplitude(value: number): string {
  return value.toFixed(4)
}

function channelLabel(channelNumber: number): string {
  if (props.channelCount === 2) {
    return channelNumber === 1 ? 'Left' : 'Right'
  }

  return `Ch ${channelNumber}`
}
</script>
