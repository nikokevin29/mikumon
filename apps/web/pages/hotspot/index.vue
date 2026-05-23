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
  username: string
  comment: string | null
  isActive: boolean
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

async function deleteUser(user: HotspotUser) {
  if (!confirm(`Hapus user "${user.username}"?`)) return
  try {
    await $api(`/hotspot/users/${user.id}`, { method: 'DELETE' })
    toast.add({ title: 'User berhasil dihapus', color: 'green', icon: 'i-heroicons-check-circle' })
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
  { key: 'profileId', label: 'Profile' },
  { key: 'isActive', label: 'Status' },
  { key: 'createdAt', label: 'Dibuat' },
  { key: 'actions', label: '' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { dateStyle: 'short' })
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
      <UTable v-model="selected" :columns="columns" :rows="users">
        <template #username-data="{ row }">
          <span class="font-mono font-medium">{{ row.username }}</span>
        </template>

        <template #isActive-data="{ row }">
          <UBadge :color="row.isActive ? 'green' : 'gray'" variant="soft" size="xs">
            {{ row.isActive ? 'Aktif' : 'Nonaktif' }}
          </UBadge>
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
        <UPagination
          v-model="page"
          :page-count="limit"
          :total="pagination.total"
        />
      </div>
    </UCard>

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
