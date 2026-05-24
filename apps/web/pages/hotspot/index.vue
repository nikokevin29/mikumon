<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { $api } = useApi()
const toast = useToast()
const voucherStore = useVoucherStore()
const router = useRouter()

interface RouterOption { id: number; name: string; ipAddress: string }
interface ProfileOption { id: number; name: string; price: string; sellingPrice: string | null }
interface HotspotUser {
  id: number
  routerId: number
  profileId: number
  profileName: string | null
  username: string
  comment: string | null
  isActive: boolean
  usedAt: string | null
  expiredAt: string | null
  createdAt: string
}

// Filters
const filterRouterId = ref<number | null>(null)
const filterProfileId = ref<number | null>(null)
const filterActive = ref<string>('all')
const filterSearch = ref('')
const page = ref(1)
const limit = 20

const { data: routerData } = await useAsyncData('routers-hs', () =>
  $api<{ data: RouterOption[] }>('/routers?limit=100'),
)
const routerOptions = computed(() => [
  { label: 'Semua Router', value: null },
  ...(routerData.value?.data ?? []).map((r) => ({ label: `${r.name} (${r.ipAddress})`, value: r.id })),
])

const { data: profileData } = await useAsyncData(
  'profiles-hs',
  () => {
    const q = filterRouterId.value ? `?router_id=${filterRouterId.value}&limit=100` : '?limit=100'
    return $api<{ data: ProfileOption[] }>(`/profiles${q}`)
  },
  { watch: [filterRouterId] },
)
const profileOptions = computed(() => [
  { label: 'Semua Profile', value: null },
  ...(profileData.value?.data ?? []).map((p) => ({ label: p.name, value: p.id })),
])

watch(filterRouterId, () => {
  filterProfileId.value = null
  page.value = 1
})

const queryString = computed(() => {
  const params = new URLSearchParams()
  params.set('page', String(page.value))
  params.set('limit', String(limit))
  if (filterRouterId.value) params.set('routerId', String(filterRouterId.value))
  if (filterProfileId.value) params.set('profileId', String(filterProfileId.value))
  if (filterActive.value !== 'all') params.set('isActive', filterActive.value)
  if (filterSearch.value) params.set('search', filterSearch.value)
  return params.toString()
})

const { data: usersData, refresh } = await useAsyncData(
  'hotspot-users',
  () => $api<{ data: HotspotUser[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/hotspot/users?${queryString.value}`),
  { watch: [queryString] },
)
const users = computed(() => usersData.value?.data ?? [])
const pagination = computed(() => usersData.value?.pagination)

// Selected rows for bulk delete
const selected = ref<HotspotUser[]>([])

// Generate modal
const generateOpen = ref(false)
const generating = ref(false)
const genForm = reactive({
  routerId: null as number | null,
  profileId: null as number | null,
  quantity: 10,
  prefix: '',
})

const genProfileOptions = computed(() => {
  if (!genForm.routerId) return []
  return (profileData.value?.data ?? []).map((p) => ({ label: p.name, value: p.id }))
})

async function generate() {
  if (!genForm.routerId || !genForm.profileId) {
    toast.add({ title: 'Router dan profile wajib dipilih', color: 'red', icon: 'i-heroicons-x-circle' })
    return
  }
  generating.value = true
  try {
    const res = await $api<{
      success: true
      data: { generated: number; users: Array<{ id: number; username: string; password: string; profileName: string; createdAt: string }> }
    }>('/hotspot/users/generate', {
      method: 'POST',
      body: {
        routerId: genForm.routerId,
        profileId: genForm.profileId,
        quantity: genForm.quantity,
        prefix: genForm.prefix || undefined,
      },
    })
    toast.add({ title: `${res.data.generated} user berhasil digenerate`, color: 'green', icon: 'i-heroicons-check-circle' })
    voucherStore.setGenerated(
      res.data.users,
      res.data.users[0]?.profileName ?? '',
    )
    generateOpen.value = false
    await refresh()
    await router.push('/hotspot/vouchers')
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal generate user', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    generating.value = false
  }
}

// Delete
const deleting = ref(false)
const confirmDelete = ref<HotspotUser | null>(null)
const confirmDeleteOpen = computed({
  get: () => !!confirmDelete.value,
  set: (v: boolean) => { if (!v) confirmDelete.value = null },
})

async function deleteUser(user: HotspotUser) {
  confirmDelete.value = user
}

async function doDelete() {
  const user = confirmDelete.value
  if (!user) return
  confirmDelete.value = null
  try {
    await $api(`/hotspot/users/${user.id}`, { method: 'DELETE' })
    toast.add({ title: `User ${user.username} berhasil dihapus`, color: 'green', icon: 'i-heroicons-check-circle' })
    await refresh()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal menghapus user', color: 'red', icon: 'i-heroicons-x-circle' })
  }
}

async function bulkDelete() {
  const ids = selected.value.map((u) => u.id)
  if (!ids.length) return
  if (!confirm(`Hapus ${ids.length} user yang dipilih?`)) return
  deleting.value = true
  try {
    await $api('/hotspot/users', { method: 'DELETE', body: { ids } })
    toast.add({ title: `${ids.length} user berhasil dihapus`, color: 'green', icon: 'i-heroicons-check-circle' })
    selected.value = []
    await refresh()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal menghapus user', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    deleting.value = false
  }
}

const columns = [
  { key: 'username', label: 'Username' },
  { key: 'profileName', label: 'Profile' },
  { key: 'voucherStatus', label: 'Status' },
  { key: 'usedAt', label: 'Dipakai' },
  { key: 'createdAt', label: 'Dibuat' },
  { key: 'actions', label: '' },
]

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { dateStyle: 'short' })
}

function formatDateTime(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type BadgeColor = 'red' | 'green' | 'blue' | 'gray' | 'yellow' | 'orange'

function voucherStatus(u: HotspotUser): { label: string; color: BadgeColor } {
  if (!u.isActive) return { label: 'Expired', color: 'red' }
  if (u.usedAt) return { label: 'Dipakai', color: 'blue' }
  return { label: 'Belum Dipakai', color: 'green' }
}

const activeOptions = [
  { label: 'Semua', value: 'all' },
  { label: 'Aktif', value: 'true' },
  { label: 'Nonaktif', value: 'false' },
]
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Hotspot Users</h1>
        <p class="text-sm text-gray-500 mt-1">
          Total: {{ pagination?.total ?? 0 }} user
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          v-if="selected.length"
          color="red"
          variant="soft"
          icon="i-heroicons-trash"
          :loading="deleting"
          @click="bulkDelete"
        >
          Hapus ({{ selected.length }})
        </UButton>
        <UButton icon="i-heroicons-bolt" @click="generateOpen = true"> Generate </UButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-4">
      <USelect
        v-model="filterRouterId"
        :options="routerOptions"
        value-attribute="value"
        option-attribute="label"
        class="w-48"
        icon="i-heroicons-server"
      />
      <USelect
        v-model="filterProfileId"
        :options="profileOptions"
        value-attribute="value"
        option-attribute="label"
        class="w-40"
        icon="i-heroicons-user-group"
      />
      <USelect
        v-model="filterActive"
        :options="activeOptions"
        value-attribute="value"
        option-attribute="label"
        class="w-32"
      />
      <UInput
        v-model="filterSearch"
        placeholder="Cari username..."
        icon="i-heroicons-magnifying-glass"
        class="w-48"
        @keyup.enter="page = 1"
      />
    </div>

    <UCard>
      <div v-if="!users.length" class="flex flex-col items-center justify-center py-16 text-gray-400">
        <UIcon name="i-heroicons-wifi" class="w-12 h-12 mb-3" />
        <p class="font-medium">Tidak ada user ditemukan</p>
        <p class="text-sm mt-1">Coba ubah filter atau generate user baru</p>
      </div>

      <template v-else>
        <UTable v-model="selected" :columns="columns" :rows="users">
          <template #username-data="{ row }">
            <span class="font-mono font-medium">{{ row.username }}</span>
          </template>

          <template #profileName-data="{ row }">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ row.profileName ?? '-' }}</span>
          </template>

          <template #voucherStatus-data="{ row }">
            <UBadge :color="voucherStatus(row).color" variant="soft" size="xs">
              {{ voucherStatus(row).label }}
            </UBadge>
          </template>

          <template #usedAt-data="{ row }">
            <span class="text-xs text-gray-500 font-mono">{{ formatDateTime(row.usedAt) }}</span>
          </template>

          <template #createdAt-data="{ row }">
            <span class="text-sm text-gray-500">{{ formatDate(row.createdAt) }}</span>
          </template>

          <template #actions-data="{ row }">
            <div class="flex justify-end">
              <UButton
                icon="i-heroicons-trash"
                size="xs"
                color="red"
                variant="ghost"
                @click="deleteUser(row)"
              />
            </div>
          </template>
        </UTable>

        <div v-if="pagination && pagination.pages > 1" class="flex justify-center mt-4 pb-2">
          <UPagination v-model="page" :page-count="limit" :total="pagination.total" />
        </div>
      </template>
    </UCard>

    <!-- Confirm Delete Modal -->
    <UModal v-model="confirmDeleteOpen" :ui="{ width: 'sm:max-w-sm' }">
      <UCard>
        <template #header>
          <p class="font-semibold text-red-600">Hapus User</p>
        </template>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Hapus user <span class="font-mono font-semibold">{{ confirmDelete?.username }}</span>?
        </p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="confirmDelete = null">Batal</UButton>
            <UButton color="red" @click="doDelete">Hapus</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Generate Modal -->
    <UModal v-model="generateOpen">
      <UCard>
        <template #header>
          <p class="font-semibold">Generate Hotspot Users</p>
        </template>

        <div class="space-y-4">
          <UFormGroup label="Router" required>
            <USelect
              v-model="genForm.routerId"
              :options="routerOptions.filter((o) => o.value !== null)"
              value-attribute="value"
              option-attribute="label"
              placeholder="Pilih router..."
            />
          </UFormGroup>

          <UFormGroup label="Profile" required>
            <USelect
              v-model="genForm.profileId"
              :options="genProfileOptions"
              value-attribute="value"
              option-attribute="label"
              placeholder="Pilih profile..."
              :disabled="!genForm.routerId"
            />
          </UFormGroup>

          <div class="grid grid-cols-2 gap-3">
            <UFormGroup label="Jumlah User" required>
              <UInput v-model.number="genForm.quantity" type="number" min="1" max="500" />
            </UFormGroup>
            <UFormGroup label="Prefix (opsional)">
              <UInput v-model="genForm.prefix" placeholder="MKM" maxlength="6" />
            </UFormGroup>
          </div>

          <UAlert
            color="blue"
            variant="soft"
            icon="i-heroicons-information-circle"
            description="Setelah generate, Anda akan diarahkan ke halaman cetak voucher."
          />
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="generateOpen = false">Batal</UButton>
            <UButton icon="i-heroicons-bolt" :loading="generating" @click="generate">
              Generate
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
