<script setup lang="ts">
import type { EChartsOption } from 'echarts'

const { sessions, connected, lastUpdated, connect, disconnect } = useTrafficWs()
const { $api } = useApi()
const toast = useToast()

interface RouterOption { id: number; name: string; ipAddress: string }
const { data: routerData } = await useAsyncData('routers-mon', () =>
  $api<{ data: RouterOption[] }>('/routers?limit=100'),
)
const routerOptions = computed(() =>
  (routerData.value?.data ?? []).map((r) => ({ label: `${r.name} (${r.ipAddress})`, value: r.id })),
)
const selectedRouterId = ref<number | null>(null)
watch(routerOptions, (opts) => { if (opts.length && !selectedRouterId.value) selectedRouterId.value = opts[0]!.value }, { immediate: true })

const { data: initialData } = await useAsyncData('sessions-initial', () =>
  $api<{ success: true; data: any[] }>('/sessions'),
)

onMounted(() => {
  if (initialData.value?.data) sessions.value = initialData.value.data
  connect()
})
onBeforeUnmount(() => disconnect())

function formatBytes(bytes: string | number) {
  const b = Number(bytes)
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleString('id-ID')
}

const totalUpload = computed(() => sessions.value.reduce((acc, s) => acc + Number(s.uploadBytes ?? 0), 0))
const totalDownload = computed(() => sessions.value.reduce((acc, s) => acc + Number(s.downloadBytes ?? 0), 0))

const trafficChartOption = computed<EChartsOption>(() => {
  const top10 = [...sessions.value]
    .sort((a, b) => Number(b.downloadBytes) + Number(b.uploadBytes) - Number(a.downloadBytes) - Number(a.uploadBytes))
    .slice(0, 10)

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['Download', 'Upload'], bottom: 0 },
    grid: { left: 80, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatBytes(v) } },
    yAxis: { type: 'category', data: top10.map((s) => s.username ?? s.ipAddress ?? `Session ${s.id}`) },
    series: [
      { name: 'Download', type: 'bar', stack: 'traffic', data: top10.map((s) => Number(s.downloadBytes)), itemStyle: { color: '#3b82f6' } },
      { name: 'Upload', type: 'bar', stack: 'traffic', data: top10.map((s) => Number(s.uploadBytes)), itemStyle: { color: '#10b981' } },
    ],
  }
})

// Disconnect session
const disconnecting = ref<string | null>(null)
async function disconnectSession(session: any) {
  if (!selectedRouterId.value) {
    toast.add({ title: 'Pilih router terlebih dahulu', color: 'yellow', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  if (!confirm(`Putuskan sesi ${session.username ?? session.ipAddress}?`)) return
  disconnecting.value = session.sessionId ?? session.id
  try {
    // sessionId is MikroTik's .id for the active session
    const sid = session.sessionId ?? session.id
    await $api(`/hotspot/active/${sid}?routerId=${selectedRouterId.value}`, { method: 'DELETE' })
    toast.add({ title: `Sesi ${session.username ?? session.ipAddress} diputus`, color: 'green', icon: 'i-heroicons-check-circle' })
    sessions.value = sessions.value.filter((s: any) => (s.sessionId ?? s.id) !== sid)
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal memutus sesi', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    disconnecting.value = null
  }
}

const columns = [
  { key: 'username', label: 'Username' },
  { key: 'ipAddress', label: 'IP Address' },
  { key: 'macAddress', label: 'MAC' },
  { key: 'download', label: 'Download' },
  { key: 'upload', label: 'Upload' },
  { key: 'connectedAt', label: 'Sejak' },
  { key: 'actions', label: '' },
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
        <USelect v-model="selectedRouterId" :options="routerOptions" value-attribute="value" option-attribute="label" placeholder="Pilih router..." icon="i-heroicons-server" class="w-48" />
        <div class="flex items-center gap-2 text-sm">
          <span :class="['inline-block w-2 h-2 rounded-full', connected ? 'bg-green-500 animate-pulse' : 'bg-red-400']" />
          <span class="text-gray-500">{{ connected ? 'Live' : 'Disconnected' }}</span>
        </div>
        <span v-if="lastUpdated" class="text-xs text-gray-400">{{ lastUpdated.toLocaleTimeString('id-ID') }}</span>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <UCard>
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-lg bg-blue-50 dark:bg-blue-950"><UIcon name="i-heroicons-users" class="w-6 h-6 text-blue-600" /></div>
          <div>
            <p class="text-sm text-gray-500">Sesi Aktif</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ sessions.length }}</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-lg bg-green-50 dark:bg-green-950"><UIcon name="i-heroicons-arrow-down-tray" class="w-6 h-6 text-green-600" /></div>
          <div>
            <p class="text-sm text-gray-500">Total Download</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatBytes(totalDownload) }}</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-lg bg-purple-50 dark:bg-purple-950"><UIcon name="i-heroicons-arrow-up-tray" class="w-6 h-6 text-purple-600" /></div>
          <div>
            <p class="text-sm text-gray-500">Total Upload</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatBytes(totalUpload) }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <UCard v-if="sessions.length" class="mb-6">
      <template #header><p class="font-semibold">Traffic per Sesi (Top 10)</p></template>
      <ClientOnly>
        <VChart :option="trafficChartOption" style="height: 280px" autoresize />
      </ClientOnly>
    </UCard>

    <UCard>
      <template #header><p class="font-semibold">Daftar Sesi</p></template>
      <div v-if="!sessions.length" class="flex flex-col items-center justify-center py-16 text-gray-400">
        <UIcon name="i-heroicons-wifi" class="w-12 h-12 mb-3" />
        <p class="font-medium">Tidak ada sesi aktif</p>
      </div>
      <UTable v-else :columns="columns" :rows="sessions">
        <template #username-data="{ row }"><span class="font-mono font-medium">{{ row.username ?? '-' }}</span></template>
        <template #macAddress-data="{ row }"><span class="font-mono text-xs text-gray-500">{{ row.macAddress ?? '-' }}</span></template>
        <template #download-data="{ row }"><span class="text-blue-600">{{ formatBytes(row.downloadBytes) }}</span></template>
        <template #upload-data="{ row }"><span class="text-green-600">{{ formatBytes(row.uploadBytes) }}</span></template>
        <template #connectedAt-data="{ row }"><span class="text-sm text-gray-500">{{ formatDate(row.connectedAt) }}</span></template>
        <template #actions-data="{ row }">
          <div class="flex justify-end">
            <UTooltip text="Putuskan Sesi">
              <UButton icon="i-heroicons-x-mark" size="xs" color="red" variant="ghost" :loading="disconnecting === (row.sessionId ?? row.id)" @click="disconnectSession(row)" />
            </UTooltip>
          </div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
