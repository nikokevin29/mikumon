<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { $api } = useApi()
const toast = useToast()

interface RouterOption {
  id: number
  name: string
  ipAddress: string
}

interface Profile {
  id: number
  routerId: number
  name: string
  price: string
  sellingPrice: string | null
  limitUptimeSeconds: number | null
  expiredMode: 'none' | 'remove' | 'record'
  parentQueue: string | null
  addressPool: string | null
  isActive: boolean
  createdAt: string
}

const { data: routerData } = await useAsyncData('routers-list', () =>
  $api<{ data: RouterOption[] }>('/routers?limit=100'),
)
const routerOptions = computed(() =>
  (routerData.value?.data ?? []).map((r) => ({ label: `${r.name} (${r.ipAddress})`, value: r.id })),
)

const selectedRouterId = ref<number | null>(null)

watch(routerOptions, (opts) => {
  if (opts.length && !selectedRouterId.value) {
    selectedRouterId.value = opts[0]!.value
  }
}, { immediate: true })

const { data: profileData, pending: profilePending, refresh } = await useAsyncData(
  'profiles',
  () => {
    const q = selectedRouterId.value ? `?router_id=${selectedRouterId.value}&limit=100` : '?limit=100'
    return $api<{ data: Profile[] }>(`/profiles${q}`)
  },
  { watch: [selectedRouterId] },
)
const profiles = computed(() => profileData.value?.data ?? [])

// Modal
const isOpen = ref(false)
const editingProfile = ref<Profile | null>(null)
const saving = ref(false)
const deleting = ref<number | null>(null)
const confirmDelete = ref<Profile | null>(null)
const confirmDeleteOpen = computed({
  get: () => !!confirmDelete.value,
  set: (v: boolean) => { if (!v) confirmDelete.value = null },
})

const form = reactive({
  routerId: 0,
  name: '',
  price: '',
  sellingPrice: '',
  limitUptimeSeconds: '',
  parentQueue: '',
  addressPool: '',
  expiredMode: 'none' as 'none' | 'remove' | 'record',
})

const expiredModeOptions = [
  { label: 'None', value: 'none' },
  { label: 'Remove', value: 'remove' },
  { label: 'Record', value: 'record' },
]

function openAdd() {
  editingProfile.value = null
  Object.assign(form, {
    routerId: selectedRouterId.value ?? 0,
    name: '',
    price: '',
    sellingPrice: '',
    limitUptimeSeconds: '',
    parentQueue: '',
    addressPool: '',
    expiredMode: 'none',
  })
  isOpen.value = true
}

function openEdit(p: Profile) {
  editingProfile.value = p
  Object.assign(form, {
    routerId: p.routerId,
    name: p.name,
    price: p.price,
    sellingPrice: p.sellingPrice ?? '',
    limitUptimeSeconds: p.limitUptimeSeconds ? String(p.limitUptimeSeconds) : '',
    parentQueue: p.parentQueue ?? '',
    addressPool: p.addressPool ?? '',
    expiredMode: p.expiredMode,
  })
  isOpen.value = true
}

function buildBody() {
  return {
    routerId: form.routerId,
    name: form.name,
    price: Number(form.price),
    sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : undefined,
    limitUptimeSeconds: form.limitUptimeSeconds ? Number(form.limitUptimeSeconds) : undefined,
    parentQueue: form.parentQueue || undefined,
    addressPool: form.addressPool || undefined,
    expiredMode: form.expiredMode,
  }
}

async function save() {
  if (!form.name || !form.price) {
    toast.add({ title: 'Nama dan harga wajib diisi', color: 'red', icon: 'i-heroicons-x-circle' })
    return
  }
  saving.value = true
  try {
    if (editingProfile.value) {
      await $api(`/profiles/${editingProfile.value.id}`, { method: 'PUT', body: buildBody() })
      toast.add({ title: 'Profile berhasil diupdate', color: 'green', icon: 'i-heroicons-check-circle' })
    } else {
      await $api('/profiles', { method: 'POST', body: buildBody() })
      toast.add({ title: 'Profile berhasil dibuat', color: 'green', icon: 'i-heroicons-check-circle' })
    }
    isOpen.value = false
    await refresh()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal menyimpan profile', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    saving.value = false
  }
}

async function deleteProfile(p: Profile) {
  confirmDelete.value = p
}

async function doDelete() {
  const p = confirmDelete.value
  if (!p) return
  confirmDelete.value = null
  deleting.value = p.id
  try {
    await $api(`/profiles/${p.id}`, { method: 'DELETE' })
    toast.add({ title: 'Profile berhasil dihapus', color: 'green', icon: 'i-heroicons-check-circle' })
    await refresh()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal menghapus profile', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    deleting.value = null
  }
}

const columns = [
  { key: 'name', label: 'Nama' },
  { key: 'price', label: 'Harga Modal' },
  { key: 'sellingPrice', label: 'Harga Jual' },
  { key: 'limitUptimeSeconds', label: 'Durasi' },
  { key: 'expiredMode', label: 'Expired Mode' },
  { key: 'actions', label: '' },
]

function formatDuration(seconds: number | null) {
  if (!seconds) return '-'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

function formatRp(val: string | null) {
  if (!val) return '-'
  return `Rp ${Number(val).toLocaleString('id-ID')}`
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Profiles</h1>
        <p class="text-sm text-gray-500 mt-1">Kelola paket hotspot</p>
      </div>
      <UButton icon="i-heroicons-plus" :disabled="!selectedRouterId" @click="openAdd">
        Tambah Profile
      </UButton>
    </div>

    <div class="mb-4 max-w-xs">
      <USelect
        v-model="selectedRouterId"
        :options="routerOptions"
        value-attribute="value"
        option-attribute="label"
        placeholder="Pilih router..."
        icon="i-heroicons-server"
      />
    </div>

    <UCard>
      <div v-if="profilePending" class="space-y-3 p-2">
        <USkeleton v-for="i in 4" :key="i" class="h-10 w-full" />
      </div>

      <div v-else-if="!selectedRouterId" class="flex flex-col items-center justify-center py-16 text-gray-400">
        <UIcon name="i-heroicons-server" class="w-12 h-12 mb-3" />
        <p class="font-medium">Pilih router terlebih dahulu</p>
      </div>

      <div v-else-if="!profiles.length" class="flex flex-col items-center justify-center py-16 text-gray-400">
        <UIcon name="i-heroicons-user-group" class="w-12 h-12 mb-3" />
        <p class="font-medium">Belum ada profile</p>
        <p class="text-sm mt-1">Tambah paket hotspot untuk router ini</p>
        <UButton class="mt-4" icon="i-heroicons-plus" size="sm" @click="openAdd">Tambah Profile</UButton>
      </div>

      <UTable v-else :columns="columns" :rows="profiles">
        <template #name-data="{ row }">
          <span class="font-medium">{{ row.name }}</span>
        </template>

        <template #price-data="{ row }">
          {{ formatRp(row.price) }}
        </template>

        <template #sellingPrice-data="{ row }">
          {{ formatRp(row.sellingPrice) }}
        </template>

        <template #limitUptimeSeconds-data="{ row }">
          {{ formatDuration(row.limitUptimeSeconds) }}
        </template>

        <template #expiredMode-data="{ row }">
          <UBadge size="xs" color="gray" variant="soft">{{ row.expiredMode }}</UBadge>
        </template>

        <template #actions-data="{ row }">
          <div class="flex items-center gap-1 justify-end">
            <UButton icon="i-heroicons-pencil-square" size="xs" color="gray" variant="ghost" @click="openEdit(row)" />
            <UButton
              icon="i-heroicons-trash"
              size="xs"
              color="red"
              variant="ghost"
              :loading="deleting === row.id"
              @click="deleteProfile(row)"
            />
          </div>
        </template>
      </UTable>
    </UCard>

    <!-- Confirm Delete Modal -->
    <UModal v-model="confirmDeleteOpen" :ui="{ width: 'sm:max-w-sm' }">
      <UCard>
        <template #header>
          <p class="font-semibold text-red-600">Hapus Profile</p>
        </template>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Hapus profile <span class="font-semibold">{{ confirmDelete?.name }}</span>?
          User hotspot yang menggunakan profile ini tidak akan bisa login.
        </p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="confirmDelete = null">Batal</UButton>
            <UButton color="red" :loading="!!deleting" @click="doDelete">Hapus</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Add/Edit Modal -->
    <UModal v-model="isOpen">
      <UCard>
        <template #header>
          <p class="font-semibold">{{ editingProfile ? 'Edit Profile' : 'Tambah Profile' }}</p>
        </template>

        <div class="space-y-4">
          <UFormGroup label="Router" required>
            <USelect
              v-model="form.routerId"
              :options="routerOptions"
              value-attribute="value"
              option-attribute="label"
            />
          </UFormGroup>

          <UFormGroup label="Nama Profile" required>
            <UInput v-model="form.name" placeholder="Contoh: 1 Hari" />
          </UFormGroup>

          <div class="grid grid-cols-2 gap-3">
            <UFormGroup label="Harga Modal (Rp)" required>
              <UInput v-model="form.price" type="number" placeholder="5000" />
            </UFormGroup>
            <UFormGroup label="Harga Jual (Rp)">
              <UInput v-model="form.sellingPrice" type="number" placeholder="7000" />
            </UFormGroup>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <UFormGroup label="Durasi (detik)">
              <UInput v-model="form.limitUptimeSeconds" type="number" placeholder="86400" />
            </UFormGroup>
            <UFormGroup label="Expired Mode">
              <USelect v-model="form.expiredMode" :options="expiredModeOptions" value-attribute="value" option-attribute="label" />
            </UFormGroup>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <UFormGroup label="Parent Queue">
              <UInput v-model="form.parentQueue" placeholder="default" />
            </UFormGroup>
            <UFormGroup label="Address Pool">
              <UInput v-model="form.addressPool" placeholder="hs-pool" />
            </UFormGroup>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="isOpen = false">Batal</UButton>
            <UButton :loading="saving" @click="save">Simpan</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
