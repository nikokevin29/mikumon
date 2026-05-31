<script setup lang="ts">
const { $api } = useApi()
const toast = useToast()

interface RouterOption { id: number; name: string; ipAddress: string }
interface Scheduler {
  id: string; name: string; startDate: string; startTime: string; interval: string
  onEvent: string; runCount: string; nextRun: string; comment: string; disabled: boolean
}

const { data: routerData } = await useAsyncData('routers-sched', () =>
  $api<{ data: RouterOption[] }>('/routers?limit=100'),
)
const routerOptions = computed(() =>
  (routerData.value?.data ?? []).map((r) => ({ label: `${r.name} (${r.ipAddress})`, value: r.id })),
)
const selectedRouterId = ref<number | null>(null)
watch(routerOptions, (opts) => { if (opts.length && !selectedRouterId.value) selectedRouterId.value = opts[0]!.value }, { immediate: true })

const schedulers = ref<Scheduler[]>([])
const loading = ref(false)
const search = ref('')
const expandedScript = ref<string | null>(null)

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return schedulers.value
  return schedulers.value.filter((s) => s.name.toLowerCase().includes(q) || s.comment.toLowerCase().includes(q))
})

async function load() {
  if (!selectedRouterId.value) return
  loading.value = true
  try {
    const res = await $api<{ data: Scheduler[] }>(`/system/scheduler?routerId=${selectedRouterId.value}`)
    schedulers.value = res.data
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal memuat scheduler', color: 'red', icon: 'i-heroicons-x-circle' })
    schedulers.value = []
  } finally { loading.value = false }
}
watch(selectedRouterId, load, { immediate: true })

const toggling = ref<string | null>(null)
async function toggleScheduler(s: Scheduler) {
  toggling.value = s.id
  try {
    await $api(`/system/scheduler/${s.id}?routerId=${selectedRouterId.value}`, { method: 'PATCH', body: { disabled: !s.disabled } })
    s.disabled = !s.disabled
    toast.add({ title: `Scheduler ${s.disabled ? 'dinonaktifkan' : 'diaktifkan'}`, color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally { toggling.value = null }
}

const deleting = ref<string | null>(null)
async function deleteScheduler(s: Scheduler) {
  if (!confirm(`Hapus scheduler "${s.name}"?`)) return
  deleting.value = s.id
  try {
    await $api(`/system/scheduler/${s.id}?routerId=${selectedRouterId.value}`, { method: 'DELETE' })
    toast.add({ title: `Scheduler "${s.name}" dihapus`, color: 'green', icon: 'i-heroicons-check-circle' })
    await load()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally { deleting.value = null }
}

const columns = [
  { key: 'name', label: 'Nama' },
  { key: 'interval', label: 'Interval' },
  { key: 'nextRun', label: 'Next Run' },
  { key: 'runCount', label: 'Run Count' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '' },
]
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">System Scheduler</h1>
        <p class="text-sm text-gray-500 mt-1">Kelola scheduler di MikroTik</p>
      </div>
      <div class="flex gap-2">
        <USelect v-model="selectedRouterId" :options="routerOptions" value-attribute="value" option-attribute="label" placeholder="Pilih router..." icon="i-heroicons-server" class="w-52" />
        <UButton icon="i-heroicons-arrow-path" variant="soft" color="gray" :loading="loading" @click="load">Refresh</UButton>
      </div>
    </div>

    <div class="mb-4">
      <UInput v-model="search" placeholder="Cari nama scheduler..." icon="i-heroicons-magnifying-glass" class="max-w-xs" />
    </div>

    <UCard>
      <div v-if="loading" class="space-y-3 p-2"><USkeleton v-for="i in 6" :key="i" class="h-10" /></div>
      <div v-else-if="!filtered.length" class="py-16 text-center text-gray-400">
        <UIcon name="i-heroicons-clock" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Tidak ada scheduler</p>
      </div>
      <UTable v-else :rows="filtered" :columns="columns">
        <template #name-data="{ row }">
          <div>
            <p class="font-mono font-medium text-sm">{{ row.name }}</p>
            <p v-if="row.comment" class="text-xs text-gray-400">{{ row.comment }}</p>
          </div>
        </template>
        <template #interval-data="{ row }">
          <span class="font-mono text-xs text-gray-600 dark:text-gray-300">{{ row.interval || '—' }}</span>
        </template>
        <template #nextRun-data="{ row }">
          <span class="font-mono text-xs text-gray-500">{{ row.nextRun || '—' }}</span>
        </template>
        <template #runCount-data="{ row }">
          <span class="text-sm text-gray-600">{{ row.runCount }}</span>
        </template>
        <template #status-data="{ row }">
          <UBadge :color="row.disabled ? 'red' : 'green'" variant="soft" size="xs">{{ row.disabled ? 'Disabled' : 'Enabled' }}</UBadge>
        </template>
        <template #actions-data="{ row }">
          <div class="flex justify-end gap-1">
            <UTooltip text="Lihat Script">
              <UButton icon="i-heroicons-code-bracket" size="xs" color="blue" variant="ghost" @click="expandedScript = expandedScript === row.id ? null : row.id" />
            </UTooltip>
            <UTooltip :text="row.disabled ? 'Aktifkan' : 'Nonaktifkan'">
              <UButton :icon="row.disabled ? 'i-heroicons-play' : 'i-heroicons-pause'" size="xs" color="yellow" variant="ghost" :loading="toggling === row.id" @click="toggleScheduler(row)" />
            </UTooltip>
            <UButton icon="i-heroicons-trash" size="xs" color="red" variant="ghost" :loading="deleting === row.id" @click="deleteScheduler(row)" />
          </div>
        </template>
      </UTable>

      <!-- Script expand rows -->
      <template v-for="row in filtered" :key="`script-${row.id}`">
        <div v-if="expandedScript === row.id" class="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
          <p class="text-xs text-gray-400 mb-1">Script: {{ row.name }}</p>
          <pre class="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">{{ row.onEvent || '(kosong)' }}</pre>
        </div>
      </template>
    </UCard>
  </div>
</template>
