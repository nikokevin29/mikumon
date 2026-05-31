<script setup lang="ts">
const { $api } = useApi()
const toast = useToast()
const voucherStore = useVoucherStore()
const nuxtRouter = useRouter()

interface RouterOption { id: number; name: string; ipAddress: string }
interface ProfileOption { id: number; name: string }
interface LiveUser {
  id: string; name: string; password: string; profile: string
  comment: string; macAddress: string; bytesIn: string; bytesOut: string
  uptime: string; disabled: boolean; server: string
}

// Router selector
const { data: routerData } = await useAsyncData('routers-hs', () =>
  $api<{ data: RouterOption[] }>('/routers?limit=100'),
)
const routerOptions = computed(() =>
  (routerData.value?.data ?? []).map((r) => ({ label: `${r.name} (${r.ipAddress})`, value: r.id })),
)
const selectedRouterId = ref<number | null>(null)
watch(routerOptions, (opts) => {
  if (opts.length && !selectedRouterId.value) selectedRouterId.value = opts[0]!.value
}, { immediate: true })

// Live users from MikroTik
const allUsers = ref<LiveUser[]>([])
const loading = ref(false)

async function load() {
  if (!selectedRouterId.value) return
  loading.value = true
  try {
    const res = await $api<{ data: LiveUser[] }>(`/hotspot/users/live?routerId=${selectedRouterId.value}`)
    allUsers.value = res.data
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal memuat users', color: 'red', icon: 'i-heroicons-x-circle' })
    allUsers.value = []
  } finally { loading.value = false }
}
watch(selectedRouterId, load, { immediate: true })

// Filters
const filterSearch = ref('')
const filterProfile = ref('')
const filterComment = ref('')

const profileOptions = computed(() => {
  const profiles = [...new Set(allUsers.value.map((u) => u.profile))].filter(Boolean).sort()
  return [
    { label: 'Profile', value: '' },
    { label: 'Show All', value: '__all__' },
    ...profiles.map((p) => ({ label: p, value: p })),
  ]
})

const commentOptions = computed(() => {
  const counts: Record<string, number> = {}
  for (const u of allUsers.value) {
    const c = u.comment || ''
    if (c) counts[c] = (counts[c] ?? 0) + 1
  }
  return [
    { label: 'Comment', value: '' },
    ...Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => ({ label: `${c} [${n}]`, value: c })),
  ]
})

const filtered = computed(() => {
  let list = allUsers.value
  if (filterProfile.value && filterProfile.value !== '__all__') list = list.filter((u) => u.profile === filterProfile.value)
  if (filterComment.value) list = list.filter((u) => u.comment === filterComment.value)
  if (filterSearch.value) {
    const q = filterSearch.value.toLowerCase()
    list = list.filter((u) => u.name.toLowerCase().includes(q) || u.comment.toLowerCase().includes(q))
  }
  return list
})

// Selected rows
const selected = ref<LiveUser[]>([])

// Generate modal
const generateOpen = ref(false)
const generating = ref(false)
const { data: profileData } = await useAsyncData('profiles-hs', () =>
  $api<{ data: ProfileOption[] }>('/profiles?limit=100'),
  { watch: [selectedRouterId] }
)
const genProfileOptions = computed(() =>
  (profileData.value?.data ?? []).map((p) => ({ label: p.name, value: p.id })),
)
const genForm = reactive({ profileId: null as number | null, quantity: 10, prefix: '' })

async function generate() {
  if (!selectedRouterId.value || !genForm.profileId) {
    toast.add({ title: 'Router dan profile wajib dipilih', color: 'red', icon: 'i-heroicons-x-circle' })
    return
  }
  generating.value = true
  try {
    const res = await $api<{ success: true; data: { generated: number; users: any[] } }>('/hotspot/users/generate', {
      method: 'POST',
      body: { routerId: selectedRouterId.value, profileId: genForm.profileId, quantity: genForm.quantity, prefix: genForm.prefix || undefined },
    })
    toast.add({ title: `${res.data.generated} user berhasil digenerate`, color: 'green', icon: 'i-heroicons-check-circle' })
    voucherStore.setGenerated(res.data.users, res.data.users[0]?.profileName ?? '')
    generateOpen.value = false
    await load()
    await nuxtRouter.push('/hotspot/vouchers')
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal generate', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally { generating.value = false }
}

// Delete user dari MikroTik + DB
const deleting = ref<string | null>(null)
async function deleteUser(user: LiveUser) {
  if (!confirm(`Hapus user "${user.name}"?`)) return
  deleting.value = user.id
  try {
    // Hapus dari MikroTik via live endpoint (pakai .id MikroTik)
    await $api(`/hotspot/users/mikrotik/${user.id}?routerId=${selectedRouterId.value}`, { method: 'DELETE' })
    toast.add({ title: `User ${user.name} dihapus`, color: 'green', icon: 'i-heroicons-check-circle' })
    allUsers.value = allUsers.value.filter((u) => u.id !== user.id)
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal menghapus', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally { deleting.value = null }
}

// Sync ke DB
const syncing = ref(false)
async function syncFromMikrotik() {
  if (!selectedRouterId.value) return
  syncing.value = true
  try {
    const res = await $api<{ data: { usersImported: number; profilesImported: number } }>(
      `/hotspot/sync?routerId=${selectedRouterId.value}`, { method: 'POST' }
    )
    toast.add({ title: `Sync selesai: ${res.data.usersImported} user diimport ke DB`, color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal sync', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally { syncing.value = false }
}

// Export CSV
function exportCsv() {
  const apiBase = useRuntimeConfig().public.apiBase
  const params = new URLSearchParams()
  if (selectedRouterId.value) params.set('routerId', String(selectedRouterId.value))
  window.open(`${apiBase}/hotspot/users/export?${params.toString()}`, '_blank')
}

function formatBytes(bytes: string | number) {
  const b = Number(bytes)
  if (!b) return '0 B'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const columns = [
  { key: 'select', label: '' },
  { key: 'name', label: 'Name' },
  { key: 'profile', label: 'Profile' },
  { key: 'uptime', label: 'Uptime' },
  { key: 'bytesIn', label: 'Bytes In' },
  { key: 'bytesOut', label: 'Bytes Out' },
  { key: 'comment', label: 'Comment' },
  { key: 'actions', label: '' },
]
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <USelect v-model="selectedRouterId" :options="routerOptions" value-attribute="value" option-attribute="label" icon="i-heroicons-server" class="w-52" size="sm" />
        <span class="text-sm text-gray-500">{{ filtered.length }} / {{ allUsers.length }} users</span>
      </div>
      <div class="flex gap-2">
        <UButton size="sm" icon="i-heroicons-arrow-path" variant="soft" color="gray" :loading="loading" @click="load">Refresh</UButton>
        <UButton size="sm" icon="i-heroicons-arrow-down-on-square" variant="soft" color="blue" :loading="syncing" @click="syncFromMikrotik">Sync DB</UButton>
        <UButton size="sm" icon="i-heroicons-plus" variant="soft" color="green" @click="generateOpen = true">Generate</UButton>
        <UButton size="sm" icon="i-heroicons-arrow-down-tray" variant="soft" color="gray" @click="exportCsv">CSV</UButton>
      </div>
    </div>

    <!-- Filters bar — mirip mikhmon -->
    <div class="flex flex-wrap gap-2 mb-4">
      <UInput v-model="filterSearch" placeholder="Search..." icon="i-heroicons-magnifying-glass" size="sm" class="w-52" />
      <USelect
        v-model="filterProfile"
        :options="profileOptions"
        value-attribute="value"
        option-attribute="label"
        size="sm"
        class="w-52"
      />
      <USelect
        v-model="filterComment"
        :options="commentOptions"
        value-attribute="value"
        option-attribute="label"
        size="sm"
        class="w-80"
      />
      <UButton v-if="filterProfile || filterComment || filterSearch" size="sm" variant="ghost" color="gray" icon="i-heroicons-x-mark" @click="filterProfile = ''; filterComment = ''; filterSearch = ''">Reset</UButton>
    </div>

    <!-- Table -->
    <UCard :ui="{ body: { padding: 'p-0' } }">
      <div v-if="loading" class="space-y-2 p-4">
        <USkeleton v-for="i in 10" :key="i" class="h-9" />
      </div>

      <div v-else-if="!allUsers.length" class="flex flex-col items-center justify-center py-16 text-gray-400">
        <UIcon name="i-heroicons-wifi" class="w-12 h-12 mb-3 opacity-40" />
        <p class="font-medium">Pilih router untuk memuat users</p>
      </div>

      <div v-else-if="!filtered.length" class="flex flex-col items-center justify-center py-16 text-gray-400">
        <UIcon name="i-heroicons-funnel" class="w-10 h-10 mb-2 opacity-40" />
        <p>Tidak ada user yang cocok dengan filter</p>
      </div>

      <template v-else>
        <UTable v-model="selected" :columns="columns" :rows="filtered" :ui="{ tr: { base: 'hover:bg-gray-50 dark:hover:bg-gray-800/40' }, td: { base: 'py-2' } }">

          <template #name-data="{ row }">
            <div class="flex items-center gap-1.5">
              <!-- Status indicator -->
              <span :class="['w-1.5 h-1.5 rounded-full shrink-0', row.disabled ? 'bg-red-400' : row.uptime ? 'bg-green-400 animate-pulse' : 'bg-gray-300']" />
              <span class="font-mono font-medium text-sm">{{ row.name }}</span>
            </div>
          </template>

          <template #profile-data="{ row }">
            <UBadge color="blue" variant="soft" size="xs">{{ row.profile }}</UBadge>
          </template>

          <template #uptime-data="{ row }">
            <span class="font-mono text-xs text-gray-500">{{ row.uptime || '—' }}</span>
          </template>

          <template #bytesIn-data="{ row }">
            <span class="font-mono text-xs" :class="Number(row.bytesIn) > 0 ? 'text-green-600' : 'text-gray-400'">
              {{ formatBytes(row.bytesIn) }}
            </span>
          </template>

          <template #bytesOut-data="{ row }">
            <span class="font-mono text-xs" :class="Number(row.bytesOut) > 0 ? 'text-blue-600' : 'text-gray-400'">
              {{ formatBytes(row.bytesOut) }}
            </span>
          </template>

          <template #comment-data="{ row }">
            <span class="text-xs text-gray-500 truncate max-w-[200px] block" :title="row.comment">
              {{ row.comment || '—' }}
            </span>
          </template>

          <template #actions-data="{ row }">
            <div class="flex justify-end gap-1">
              <UTooltip text="Cetak Voucher">
                <UButton size="xs" color="gray" variant="ghost" icon="i-heroicons-printer"
                  @click="voucherStore.setGenerated([{ id: row.id, username: row.name, password: row.password, profileName: row.profile, createdAt: '' }], row.profile); nuxtRouter.push('/hotspot/vouchers')" />
              </UTooltip>
              <UTooltip text="Hapus dari MikroTik">
                <UButton size="xs" color="red" variant="ghost" icon="i-heroicons-trash" :loading="deleting === row.id" @click="deleteUser(row)" />
              </UTooltip>
            </div>
          </template>
        </UTable>

        <div class="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span>{{ filtered.length }} user ditampilkan</span>
          <span v-if="selected.length" class="text-primary-600 font-medium">{{ selected.length }} dipilih</span>
        </div>
      </template>
    </UCard>

    <!-- Generate Modal -->
    <UModal v-model="generateOpen">
      <UCard>
        <template #header><p class="font-semibold">Generate Hotspot Users</p></template>
        <div class="space-y-4">
          <UFormGroup label="Profile" required>
            <USelect v-model="genForm.profileId" :options="genProfileOptions" value-attribute="value" option-attribute="label" placeholder="Pilih profile..." />
          </UFormGroup>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup label="Jumlah User" required>
              <UInput v-model.number="genForm.quantity" type="number" min="1" max="500" />
            </UFormGroup>
            <UFormGroup label="Prefix (opsional)">
              <UInput v-model="genForm.prefix" placeholder="MKM" maxlength="6" />
            </UFormGroup>
          </div>
          <UAlert color="blue" variant="soft" icon="i-heroicons-information-circle" description="Setelah generate, Anda akan diarahkan ke halaman cetak voucher." />
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="generateOpen = false">Batal</UButton>
            <UButton icon="i-heroicons-bolt" :loading="generating" @click="generate">Generate</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
