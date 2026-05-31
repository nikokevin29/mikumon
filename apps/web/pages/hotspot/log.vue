<script setup lang="ts">
const { $api } = useApi()
const toast = useToast()

interface RouterOption { id: number; name: string; ipAddress: string }
interface LogEntry { id: string; time: string; topics: string; message: string }

const { data: routerData } = await useAsyncData('routers-log', () =>
  $api<{ data: RouterOption[] }>('/routers?limit=100'),
)
const routerOptions = computed(() =>
  (routerData.value?.data ?? []).map((r) => ({ label: `${r.name} (${r.ipAddress})`, value: r.id })),
)
const selectedRouterId = ref<number | null>(null)
watch(routerOptions, (opts) => { if (opts.length && !selectedRouterId.value) selectedRouterId.value = opts[0]!.value }, { immediate: true })

const logs = ref<LogEntry[]>([])
const loading = ref(false)
const search = ref('')

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return logs.value
  return logs.value.filter((l) => l.message.toLowerCase().includes(q) || l.topics.toLowerCase().includes(q))
})

async function load() {
  if (!selectedRouterId.value) return
  loading.value = true
  try {
    const res = await $api<{ data: LogEntry[] }>(`/hotspot/log?routerId=${selectedRouterId.value}`)
    logs.value = res.data
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal memuat log', color: 'red', icon: 'i-heroicons-x-circle' })
    logs.value = []
  } finally { loading.value = false }
}
watch(selectedRouterId, load, { immediate: true })

function topicColor(topics: string) {
  if (topics.includes('error') || topics.includes('critical')) return 'red'
  if (topics.includes('warning')) return 'yellow'
  if (topics.includes('info')) return 'blue'
  return 'gray'
}

const columns = [
  { key: 'time', label: 'Waktu' },
  { key: 'topics', label: 'Topics' },
  { key: 'message', label: 'Message' },
]
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Hotspot Log</h1>
        <p class="text-sm text-gray-500 mt-1">Log aktivitas hotspot dari router</p>
      </div>
      <div class="flex gap-2">
        <USelect v-model="selectedRouterId" :options="routerOptions" value-attribute="value" option-attribute="label" placeholder="Pilih router..." icon="i-heroicons-server" class="w-52" />
        <UButton icon="i-heroicons-arrow-path" variant="soft" color="gray" :loading="loading" @click="load">Refresh</UButton>
      </div>
    </div>

    <div class="mb-4">
      <UInput v-model="search" placeholder="Cari pesan atau topic..." icon="i-heroicons-magnifying-glass" class="max-w-xs" />
    </div>

    <UCard>
      <div v-if="loading" class="space-y-2 p-2"><USkeleton v-for="i in 10" :key="i" class="h-8" /></div>
      <div v-else-if="!filtered.length" class="py-16 text-center text-gray-400">
        <UIcon name="i-heroicons-document-text" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Tidak ada log</p>
      </div>
      <UTable v-else :rows="filtered" :columns="columns">
        <template #time-data="{ row }">
          <span class="font-mono text-xs text-gray-500 whitespace-nowrap">{{ row.time }}</span>
        </template>
        <template #topics-data="{ row }">
          <UBadge :color="topicColor(row.topics)" variant="soft" size="xs">{{ row.topics }}</UBadge>
        </template>
        <template #message-data="{ row }">
          <span class="text-sm font-mono">{{ row.message }}</span>
        </template>
      </UTable>
      <div v-if="!loading && filtered.length" class="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
        {{ filtered.length }} entri (200 terbaru)
      </div>
    </UCard>
  </div>
</template>
