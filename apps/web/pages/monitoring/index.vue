<script setup lang="ts">
import type { EChartsOption } from 'echarts'

definePageMeta({ middleware: 'auth' })

const { sessions, connected, lastUpdated, connect, disconnect } = useTrafficWs()
const { $api } = useApi()

// Fallback: load initial data from REST, then WS takes over
const { data: initialData } = await useAsyncData('sessions-initial', () =>
  $api<{ success: true; data: any[] }>('/sessions'),
)

onMounted(() => {
  if (initialData.value?.data) {
    sessions.value = initialData.value.data
  }
  connect()
})

onBeforeUnmount(() => {
  disconnect()
})

function formatBytes(bytes: string | number) {
  const b = Number(bytes)
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

const totalUpload = computed(() =>
  sessions.value.reduce((acc, s) => acc + Number(s.uploadBytes ?? 0), 0),
)
const totalDownload = computed(() =>
  sessions.value.reduce((acc, s) => acc + Number(s.downloadBytes ?? 0), 0),
)

// Traffic chart: top 10 sessions by total bytes
const trafficChartOption = computed<EChartsOption>(() => {
  const top10 = [...sessions.value]
    .sort((a, b) => Number(b.downloadBytes) + Number(b.uploadBytes) - Number(a.downloadBytes) - Number(a.uploadBytes))
    .slice(0, 10)

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['Download', 'Upload'], bottom: 0 },
    grid: { left: 80, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatBytes(v) } },
    yAxis: {
      type: 'category',
      data: top10.map((s) => s.username ?? s.ipAddress ?? `Session ${s.id}`),
    },
    series: [
      {
        name: 'Download',
        type: 'bar',
        stack: 'traffic',
        data: top10.map((s) => Number(s.downloadBytes)),
        itemStyle: { color: '#3b82f6' },
      },
      {
        name: 'Upload',
        type: 'bar',
        stack: 'traffic',
        data: top10.map((s) => Number(s.uploadBytes)),
        itemStyle: { color: '#10b981' },
      },
    ],
  }
})

const columns = [
  { key: 'username', label: 'Username' },
  { key: 'ipAddress', label: 'IP Address' },
  { key: 'macAddress', label: 'MAC' },
  { key: 'download', label: 'Download' },
  { key: 'upload', label: 'Upload' },
  { key: 'connectedAt', label: 'Sejak' },
]
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Live Monitoring</h1>
        <p class="text-sm text-gray-500 mt-1">Sesi hotspot aktif secara real-time</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 text-sm">
          <span
            :class="[
              'inline-block w-2 h-2 rounded-full',
              connected ? 'bg-green-500 animate-pulse' : 'bg-red-400',
            ]"
          />
          <span class="text-gray-500">{{ connected ? 'Live' : 'Disconnected' }}</span>
        </div>
        <span v-if="lastUpdated" class="text-xs text-gray-400">
          Update: {{ lastUpdated.toLocaleTimeString('id-ID') }}
        </span>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <UCard>
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
            <UIcon name="i-heroicons-users" class="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Sesi Aktif</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ sessions.length }}</p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-lg bg-green-50 dark:bg-green-950">
            <UIcon name="i-heroicons-arrow-down-tray" class="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Total Download</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ formatBytes(totalDownload) }}
            </p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-lg bg-purple-50 dark:bg-purple-950">
            <UIcon name="i-heroicons-arrow-up-tray" class="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Total Upload</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ formatBytes(totalUpload) }}
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Traffic chart -->
    <UCard v-if="sessions.length" class="mb-6">
      <template #header>
        <p class="font-semibold">Traffic per Sesi (Top 10)</p>
      </template>
      <ClientOnly>
        <VChart :option="trafficChartOption" style="height: 280px" autoresize />
      </ClientOnly>
    </UCard>

    <!-- Sessions table -->
    <UCard>
      <template #header>
        <p class="font-semibold">Daftar Sesi</p>
      </template>

      <div v-if="!sessions.length" class="flex flex-col items-center justify-center py-16 text-gray-400">
        <UIcon name="i-heroicons-wifi" class="w-12 h-12 mb-3" />
        <p class="font-medium">Tidak ada sesi aktif</p>
        <p class="text-sm mt-1">Sesi akan muncul saat ada user yang terhubung ke hotspot</p>
      </div>

      <UTable v-else :columns="columns" :rows="sessions">
        <template #username-data="{ row }">
          <span class="font-mono font-medium">{{ row.username ?? '-' }}</span>
        </template>
        <template #macAddress-data="{ row }">
          <span class="font-mono text-xs text-gray-500">{{ row.macAddress ?? '-' }}</span>
        </template>
        <template #download-data="{ row }">
          <span class="text-blue-600">{{ formatBytes(row.downloadBytes) }}</span>
        </template>
        <template #upload-data="{ row }">
          <span class="text-green-600">{{ formatBytes(row.uploadBytes) }}</span>
        </template>
        <template #connectedAt-data="{ row }">
          <span class="text-sm text-gray-500">{{ formatDate(row.connectedAt) }}</span>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
