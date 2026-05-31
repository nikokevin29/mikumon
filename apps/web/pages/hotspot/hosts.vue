<script setup lang="ts">
const { $api } = useApi()
const toast = useToast()

interface RouterOption { id: number; name: string; ipAddress: string }
interface HotspotHost {
  id: string; macAddress: string; address: string; toAddress: string
  server: string; hostname: string; uptime: string; comment: string; authorized: boolean
}

const { data: routerData } = await useAsyncData('routers-hosts', () =>
  $api<{ data: RouterOption[] }>('/routers?limit=100'),
)
const routerOptions = computed(() =>
  (routerData.value?.data ?? []).map((r) => ({ label: `${r.name} (${r.ipAddress})`, value: r.id })),
)
const selectedRouterId = ref<number | null>(null)
watch(routerOptions, (opts) => { if (opts.length && !selectedRouterId.value) selectedRouterId.value = opts[0]!.value }, { immediate: true })

const hosts = ref<HotspotHost[]>([])
const loading = ref(false)
const search = ref('')

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return hosts.value
  return hosts.value.filter((h) =>
    h.macAddress.toLowerCase().includes(q) || h.address.includes(q) || h.hostname.toLowerCase().includes(q),
  )
})

async function load() {
  if (!selectedRouterId.value) return
  loading.value = true
  try {
    const res = await $api<{ data: HotspotHost[] }>(`/hotspot/hosts?routerId=${selectedRouterId.value}`)
    hosts.value = res.data
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal memuat hosts', color: 'red', icon: 'i-heroicons-x-circle' })
    hosts.value = []
  } finally { loading.value = false }
}
watch(selectedRouterId, load, { immediate: true })

const deleting = ref<string | null>(null)
async function deleteHost(h: HotspotHost) {
  if (!confirm(`Hapus host ${h.macAddress || h.address}?`)) return
  deleting.value = h.id
  try {
    await $api(`/hotspot/hosts/${h.id}?routerId=${selectedRouterId.value}`, { method: 'DELETE' })
    toast.add({ title: 'Host dihapus', color: 'green', icon: 'i-heroicons-check-circle' })
    await load()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally { deleting.value = null }
}

const columns = [
  { key: 'macAddress', label: 'MAC Address' },
  { key: 'address', label: 'IP Address' },
  { key: 'hostname', label: 'Hostname' },
  { key: 'uptime', label: 'Uptime' },
  { key: 'server', label: 'Server' },
  { key: 'authorized', label: 'Auth' },
  { key: 'actions', label: '' },
]
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Hotspot Hosts</h1>
        <p class="text-sm text-gray-500 mt-1">Daftar host yang terdeteksi di hotspot</p>
      </div>
      <div class="flex gap-2">
        <USelect v-model="selectedRouterId" :options="routerOptions" value-attribute="value" option-attribute="label" placeholder="Pilih router..." icon="i-heroicons-server" class="w-52" />
        <UButton icon="i-heroicons-arrow-path" variant="soft" color="gray" :loading="loading" @click="load">Refresh</UButton>
      </div>
    </div>

    <div class="mb-4">
      <UInput v-model="search" placeholder="Cari MAC, IP, hostname..." icon="i-heroicons-magnifying-glass" class="max-w-xs" />
    </div>

    <UCard>
      <div v-if="loading" class="space-y-3 p-2"><USkeleton v-for="i in 6" :key="i" class="h-10" /></div>
      <div v-else-if="!filtered.length" class="py-16 text-center text-gray-400">
        <UIcon name="i-heroicons-computer-desktop" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Tidak ada host</p>
      </div>
      <UTable v-else :rows="filtered" :columns="columns">
        <template #macAddress-data="{ row }"><span class="font-mono text-xs uppercase">{{ row.macAddress || '-' }}</span></template>
        <template #address-data="{ row }"><span class="font-mono text-sm">{{ row.address || '-' }}</span></template>
        <template #hostname-data="{ row }"><span class="text-sm">{{ row.hostname || '-' }}</span></template>
        <template #uptime-data="{ row }"><span class="font-mono text-xs text-gray-500">{{ row.uptime || '-' }}</span></template>
        <template #authorized-data="{ row }">
          <UBadge :color="row.authorized ? 'green' : 'yellow'" variant="soft" size="xs">{{ row.authorized ? 'Auth' : 'Bypass' }}</UBadge>
        </template>
        <template #actions-data="{ row }">
          <div class="flex justify-end">
            <UButton icon="i-heroicons-trash" size="xs" color="red" variant="ghost" :loading="deleting === row.id" @click="deleteHost(row)" />
          </div>
        </template>
      </UTable>
      <div v-if="!loading && filtered.length" class="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
        {{ filtered.length }} host
      </div>
    </UCard>
  </div>
</template>
