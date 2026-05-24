<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { $api } = useApi()
const toast = useToast()

interface RouterOption { id: number; name: string; ipAddress: string }
interface DhcpLease {
  id: string; address: string; macAddress: string; hostname: string
  status: string; expiresAfter: string; server: string; comment: string
  dynamic: boolean; disabled: boolean
}

const { data: routerData } = await useAsyncData('routers-dhcp', () =>
  $api<{ data: RouterOption[] }>('/routers?limit=100'),
)
const routerOptions = computed(() =>
  (routerData.value?.data ?? []).map((r) => ({ label: `${r.name} (${r.ipAddress})`, value: r.id })),
)
const selectedRouterId = ref<number | null>(null)
watch(routerOptions, (opts) => { if (opts.length && !selectedRouterId.value) selectedRouterId.value = opts[0]!.value }, { immediate: true })

const leases = ref<DhcpLease[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const search = ref('')

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return leases.value
  return leases.value.filter((l) =>
    l.address.includes(q) || l.macAddress.toLowerCase().includes(q) || l.hostname.toLowerCase().includes(q),
  )
})

async function load() {
  if (!selectedRouterId.value) return
  loading.value = true
  error.value = null
  try {
    const res = await $api<{ data: DhcpLease[] }>(`/dhcp/leases?routerId=${selectedRouterId.value}`)
    leases.value = res.data
  } catch (e: any) {
    error.value = e?.data?.error?.message ?? 'Gagal memuat DHCP leases'
    leases.value = []
  } finally {
    loading.value = false
  }
}

watch(selectedRouterId, load, { immediate: true })

const makingStatic = ref<string | null>(null)
async function makeStatic(lease: DhcpLease) {
  makingStatic.value = lease.id
  try {
    await $api(`/dhcp/leases/${lease.id}/make-static?routerId=${selectedRouterId.value}`, { method: 'POST' })
    toast.add({ title: `${lease.address} dijadikan static`, color: 'green', icon: 'i-heroicons-check-circle' })
    await load()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    makingStatic.value = null
  }
}

const deleting = ref<string | null>(null)
async function deleteLease(lease: DhcpLease) {
  if (!confirm(`Hapus lease ${lease.address}?`)) return
  deleting.value = lease.id
  try {
    await $api(`/dhcp/leases/${lease.id}?routerId=${selectedRouterId.value}`, { method: 'DELETE' })
    toast.add({ title: `Lease ${lease.address} dihapus`, color: 'green', icon: 'i-heroicons-check-circle' })
    await load()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    deleting.value = null
  }
}

const columns = [
  { key: 'address', label: 'IP Address' },
  { key: 'macAddress', label: 'MAC Address' },
  { key: 'hostname', label: 'Hostname' },
  { key: 'status', label: 'Status' },
  { key: 'expiresAfter', label: 'Expires' },
  { key: 'actions', label: '' },
]

function statusColor(s: string) {
  if (s === 'bound') return 'green'
  if (s === 'waiting') return 'yellow'
  return 'gray'
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">DHCP Leases</h1>
        <p class="text-sm text-gray-500 mt-1">Daftar IP yang diberikan ke klien</p>
      </div>
      <div class="flex gap-2">
        <USelect v-model="selectedRouterId" :options="routerOptions" value-attribute="value" option-attribute="label" placeholder="Pilih router..." icon="i-heroicons-server" class="w-52" />
        <UButton icon="i-heroicons-arrow-path" variant="soft" color="gray" :loading="loading" @click="load">Refresh</UButton>
      </div>
    </div>

    <div class="mb-4">
      <UInput v-model="search" placeholder="Cari IP, MAC, hostname..." icon="i-heroicons-magnifying-glass" class="max-w-xs" />
    </div>

    <UCard>
      <div v-if="loading" class="space-y-3 p-2">
        <USkeleton v-for="i in 8" :key="i" class="h-10" />
      </div>

      <div v-else-if="error" class="py-10 text-center text-red-500 text-sm">
        <UIcon name="i-heroicons-exclamation-circle" class="w-8 h-8 mx-auto mb-2" />
        <p>{{ error }}</p>
      </div>

      <div v-else-if="!filtered.length" class="py-16 text-center text-gray-400">
        <UIcon name="i-heroicons-computer-desktop" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Tidak ada DHCP lease</p>
      </div>

      <UTable v-else :rows="filtered" :columns="columns">
        <template #address-data="{ row }">
          <span class="font-mono font-medium text-gray-900 dark:text-white">{{ row.address }}</span>
        </template>

        <template #macAddress-data="{ row }">
          <span class="font-mono text-xs text-gray-500 uppercase">{{ row.macAddress }}</span>
        </template>

        <template #hostname-data="{ row }">
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ row.hostname || '-' }}</span>
        </template>

        <template #status-data="{ row }">
          <UBadge :color="statusColor(row.status)" variant="soft" size="xs">
            {{ row.dynamic ? 'Dynamic' : 'Static' }} · {{ row.status }}
          </UBadge>
        </template>

        <template #expiresAfter-data="{ row }">
          <span class="text-xs font-mono text-gray-500">{{ row.expiresAfter || '—' }}</span>
        </template>

        <template #actions-data="{ row }">
          <div class="flex justify-end gap-1">
            <UTooltip v-if="row.dynamic" text="Jadikan Static">
              <UButton icon="i-heroicons-lock-closed" size="xs" color="blue" variant="ghost" :loading="makingStatic === row.id" @click="makeStatic(row)" />
            </UTooltip>
            <UButton icon="i-heroicons-trash" size="xs" color="red" variant="ghost" :loading="deleting === row.id" @click="deleteLease(row)" />
          </div>
        </template>
      </UTable>

      <div v-if="!loading && filtered.length" class="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
        {{ filtered.length }} lease ditampilkan
      </div>
    </UCard>
  </div>
</template>
