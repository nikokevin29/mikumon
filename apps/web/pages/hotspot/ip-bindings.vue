<script setup lang="ts">
const { $api } = useApi()
const toast = useToast()

interface RouterOption { id: number; name: string; ipAddress: string }
interface IpBinding {
  id: string; macAddress: string; address: string; toAddress: string
  server: string; type: string; comment: string; disabled: boolean
}

const { data: routerData } = await useAsyncData('routers-ipb', () =>
  $api<{ data: RouterOption[] }>('/routers?limit=100'),
)
const routerOptions = computed(() =>
  (routerData.value?.data ?? []).map((r) => ({ label: `${r.name} (${r.ipAddress})`, value: r.id })),
)
const selectedRouterId = ref<number | null>(null)
watch(routerOptions, (opts) => { if (opts.length && !selectedRouterId.value) selectedRouterId.value = opts[0]!.value }, { immediate: true })

const bindings = ref<IpBinding[]>([])
const loading = ref(false)
const search = ref('')

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return bindings.value
  return bindings.value.filter((b) =>
    b.macAddress.toLowerCase().includes(q) || b.address.includes(q) || b.comment.toLowerCase().includes(q),
  )
})

async function load() {
  if (!selectedRouterId.value) return
  loading.value = true
  try {
    const res = await $api<{ data: IpBinding[] }>(`/hotspot/ip-bindings?routerId=${selectedRouterId.value}`)
    bindings.value = res.data
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal memuat IP bindings', color: 'red', icon: 'i-heroicons-x-circle' })
    bindings.value = []
  } finally { loading.value = false }
}
watch(selectedRouterId, load, { immediate: true })

// Add modal
const addOpen = ref(false)
const addForm = reactive({ macAddress: '', address: '', toAddress: '', server: '', type: 'bypassed', comment: '' })
const adding = ref(false)
const typeOptions = [
  { label: 'Bypassed', value: 'bypassed' },
  { label: 'Blocked', value: 'blocked' },
  { label: 'Regular', value: 'regular' },
]

async function addBinding() {
  if (!selectedRouterId.value) return
  adding.value = true
  try {
    await $api(`/hotspot/ip-bindings?routerId=${selectedRouterId.value}`, { method: 'POST', body: { ...addForm } })
    toast.add({ title: 'IP Binding ditambahkan', color: 'green', icon: 'i-heroicons-check-circle' })
    addOpen.value = false
    Object.assign(addForm, { macAddress: '', address: '', toAddress: '', server: '', type: 'bypassed', comment: '' })
    await load()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal menambah binding', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally { adding.value = false }
}

const toggling = ref<string | null>(null)
async function toggleBinding(b: IpBinding) {
  toggling.value = b.id
  try {
    await $api(`/hotspot/ip-bindings/${b.id}?routerId=${selectedRouterId.value}`, { method: 'PATCH', body: { disabled: !b.disabled } })
    b.disabled = !b.disabled
    toast.add({ title: `Binding ${b.disabled ? 'dinonaktifkan' : 'diaktifkan'}`, color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally { toggling.value = null }
}

const deleting = ref<string | null>(null)
async function deleteBinding(b: IpBinding) {
  if (!confirm(`Hapus binding ${b.macAddress || b.address}?`)) return
  deleting.value = b.id
  try {
    await $api(`/hotspot/ip-bindings/${b.id}?routerId=${selectedRouterId.value}`, { method: 'DELETE' })
    toast.add({ title: 'Binding dihapus', color: 'green', icon: 'i-heroicons-check-circle' })
    await load()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally { deleting.value = null }
}

const columns = [
  { key: 'macAddress', label: 'MAC Address' },
  { key: 'address', label: 'IP' },
  { key: 'type', label: 'Type' },
  { key: 'server', label: 'Server' },
  { key: 'comment', label: 'Comment' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '' },
]

function typeColor(t: string) {
  if (t === 'bypassed') return 'green'
  if (t === 'blocked') return 'red'
  return 'blue'
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">IP Bindings</h1>
        <p class="text-sm text-gray-500 mt-1">Kelola binding MAC/IP di hotspot</p>
      </div>
      <div class="flex gap-2">
        <USelect v-model="selectedRouterId" :options="routerOptions" value-attribute="value" option-attribute="label" placeholder="Pilih router..." icon="i-heroicons-server" class="w-52" />
        <UButton icon="i-heroicons-arrow-path" variant="soft" color="gray" :loading="loading" @click="load">Refresh</UButton>
        <UButton icon="i-heroicons-plus" @click="addOpen = true">Tambah</UButton>
      </div>
    </div>

    <div class="mb-4">
      <UInput v-model="search" placeholder="Cari MAC, IP, comment..." icon="i-heroicons-magnifying-glass" class="max-w-xs" />
    </div>

    <UCard>
      <div v-if="loading" class="space-y-3 p-2"><USkeleton v-for="i in 6" :key="i" class="h-10" /></div>
      <div v-else-if="!filtered.length" class="py-16 text-center text-gray-400">
        <UIcon name="i-heroicons-link" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Tidak ada IP binding</p>
      </div>
      <UTable v-else :rows="filtered" :columns="columns">
        <template #macAddress-data="{ row }">
          <span class="font-mono text-sm">{{ row.macAddress || '-' }}</span>
        </template>
        <template #address-data="{ row }">
          <span class="font-mono text-sm">{{ row.address || '-' }}<span v-if="row.toAddress" class="text-gray-400"> → {{ row.toAddress }}</span></span>
        </template>
        <template #type-data="{ row }">
          <UBadge :color="typeColor(row.type)" variant="soft" size="xs">{{ row.type }}</UBadge>
        </template>
        <template #status-data="{ row }">
          <UBadge :color="row.disabled ? 'red' : 'green'" variant="soft" size="xs">{{ row.disabled ? 'Disabled' : 'Enabled' }}</UBadge>
        </template>
        <template #actions-data="{ row }">
          <div class="flex justify-end gap-1">
            <UTooltip :text="row.disabled ? 'Aktifkan' : 'Nonaktifkan'">
              <UButton :icon="row.disabled ? 'i-heroicons-play' : 'i-heroicons-pause'" size="xs" color="yellow" variant="ghost" :loading="toggling === row.id" @click="toggleBinding(row)" />
            </UTooltip>
            <UButton icon="i-heroicons-trash" size="xs" color="red" variant="ghost" :loading="deleting === row.id" @click="deleteBinding(row)" />
          </div>
        </template>
      </UTable>
    </UCard>

    <UModal v-model="addOpen">
      <UCard>
        <template #header><p class="font-semibold">Tambah IP Binding</p></template>
        <div class="space-y-4">
          <UFormGroup label="MAC Address"><UInput v-model="addForm.macAddress" placeholder="AA:BB:CC:DD:EE:FF" /></UFormGroup>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup label="IP Address"><UInput v-model="addForm.address" placeholder="192.168.1.100" /></UFormGroup>
            <UFormGroup label="To Address (NAT)"><UInput v-model="addForm.toAddress" placeholder="opsional" /></UFormGroup>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup label="Type"><USelect v-model="addForm.type" :options="typeOptions" value-attribute="value" option-attribute="label" /></UFormGroup>
            <UFormGroup label="Server"><UInput v-model="addForm.server" placeholder="all" /></UFormGroup>
          </div>
          <UFormGroup label="Comment"><UInput v-model="addForm.comment" /></UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="addOpen = false">Batal</UButton>
            <UButton :loading="adding" @click="addBinding">Tambah</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
