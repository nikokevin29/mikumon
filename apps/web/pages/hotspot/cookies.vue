<script setup lang="ts">
const { $api } = useApi()
const toast = useToast()

interface RouterOption { id: number; name: string; ipAddress: string }
interface HotspotCookie { id: string; domain: string; user: string; macAddress: string; expiresIn: string }

const { data: routerData } = await useAsyncData('routers-cookies', () =>
  $api<{ data: RouterOption[] }>('/routers?limit=100'),
)
const routerOptions = computed(() =>
  (routerData.value?.data ?? []).map((r) => ({ label: `${r.name} (${r.ipAddress})`, value: r.id })),
)
const selectedRouterId = ref<number | null>(null)
watch(routerOptions, (opts) => { if (opts.length && !selectedRouterId.value) selectedRouterId.value = opts[0]!.value }, { immediate: true })

const cookies = ref<HotspotCookie[]>([])
const loading = ref(false)
const search = ref('')

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return cookies.value
  return cookies.value.filter((c) => c.user.toLowerCase().includes(q) || c.macAddress.toLowerCase().includes(q))
})

async function load() {
  if (!selectedRouterId.value) return
  loading.value = true
  try {
    const res = await $api<{ data: HotspotCookie[] }>(`/hotspot/cookies?routerId=${selectedRouterId.value}`)
    cookies.value = res.data
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal memuat cookies', color: 'red', icon: 'i-heroicons-x-circle' })
    cookies.value = []
  } finally { loading.value = false }
}
watch(selectedRouterId, load, { immediate: true })

const deleting = ref<string | null>(null)
async function deleteCookie(c: HotspotCookie) {
  if (!confirm(`Hapus cookie ${c.user}?`)) return
  deleting.value = c.id
  try {
    await $api(`/hotspot/cookies/${c.id}?routerId=${selectedRouterId.value}`, { method: 'DELETE' })
    toast.add({ title: `Cookie ${c.user} dihapus`, color: 'green', icon: 'i-heroicons-check-circle' })
    await load()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally { deleting.value = null }
}

async function deleteAll() {
  if (!cookies.value.length || !confirm(`Hapus semua ${cookies.value.length} cookie?`)) return
  for (const c of [...cookies.value]) {
    await $api(`/hotspot/cookies/${c.id}?routerId=${selectedRouterId.value}`, { method: 'DELETE' }).catch(() => {})
  }
  toast.add({ title: 'Semua cookie dihapus', color: 'green', icon: 'i-heroicons-check-circle' })
  await load()
}

const columns = [
  { key: 'user', label: 'User' },
  { key: 'domain', label: 'Domain' },
  { key: 'macAddress', label: 'MAC Address' },
  { key: 'expiresIn', label: 'Expires In' },
  { key: 'actions', label: '' },
]
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Hotspot Cookies</h1>
        <p class="text-sm text-gray-500 mt-1">Cookie autentikasi aktif</p>
      </div>
      <div class="flex gap-2">
        <USelect v-model="selectedRouterId" :options="routerOptions" value-attribute="value" option-attribute="label" placeholder="Pilih router..." icon="i-heroicons-server" class="w-52" />
        <UButton icon="i-heroicons-arrow-path" variant="soft" color="gray" :loading="loading" @click="load">Refresh</UButton>
        <UButton v-if="cookies.length" icon="i-heroicons-trash" color="red" variant="soft" @click="deleteAll">Hapus Semua</UButton>
      </div>
    </div>

    <div class="mb-4">
      <UInput v-model="search" placeholder="Cari user, MAC..." icon="i-heroicons-magnifying-glass" class="max-w-xs" />
    </div>

    <UCard>
      <div v-if="loading" class="space-y-3 p-2"><USkeleton v-for="i in 5" :key="i" class="h-10" /></div>
      <div v-else-if="!filtered.length" class="py-16 text-center text-gray-400">
        <UIcon name="i-heroicons-cake" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Tidak ada cookie aktif</p>
      </div>
      <UTable v-else :rows="filtered" :columns="columns">
        <template #user-data="{ row }"><span class="font-mono font-medium">{{ row.user }}</span></template>
        <template #macAddress-data="{ row }"><span class="font-mono text-xs uppercase text-gray-500">{{ row.macAddress || '-' }}</span></template>
        <template #expiresIn-data="{ row }"><span class="font-mono text-xs text-gray-500">{{ row.expiresIn || '-' }}</span></template>
        <template #actions-data="{ row }">
          <div class="flex justify-end">
            <UButton icon="i-heroicons-trash" size="xs" color="red" variant="ghost" :loading="deleting === row.id" @click="deleteCookie(row)" />
          </div>
        </template>
      </UTable>
      <div v-if="!loading && filtered.length" class="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
        {{ filtered.length }} cookie
      </div>
    </UCard>
  </div>
</template>
