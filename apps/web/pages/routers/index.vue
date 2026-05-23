<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { $api } = useApi()
const toast = useToast()

interface RouterRow {
  id: number
  name: string
  ipAddress: string
  port: number
  username: string
  isDefault: boolean
  isActive: boolean
  lastConnectedAt: string | null
  createdAt: string
}

const { data, pending, refresh } = await useAsyncData('routers', () =>
  $api<{ data: RouterRow[]; pagination: any }>('/routers?limit=100'),
)
const routers = computed(() => data.value?.data ?? [])

// Modal state
const isOpen = ref(false)
const editingRouter = ref<RouterRow | null>(null)
const saving = ref(false)
const testing = ref<number | null>(null)
const deleting = ref<number | null>(null)

const form = reactive({
  name: '',
  ipAddress: '',
  port: 8728,
  username: '',
  password: '',
  isDefault: false,
})

function openAdd() {
  editingRouter.value = null
  Object.assign(form, { name: '', ipAddress: '', port: 8728, username: '', password: '', isDefault: false })
  isOpen.value = true
}

function openEdit(router: RouterRow) {
  editingRouter.value = router
  Object.assign(form, {
    name: router.name,
    ipAddress: router.ipAddress,
    port: router.port,
    username: router.username,
    password: '',
    isDefault: router.isDefault,
  })
  isOpen.value = true
}

async function save() {
  if (!form.name || !form.ipAddress || !form.username) {
    toast.add({ title: 'Nama, IP, dan username wajib diisi', color: 'red', icon: 'i-heroicons-x-circle' })
    return
  }
  saving.value = true
  try {
    if (editingRouter.value) {
      const body: Record<string, any> = { name: form.name, ipAddress: form.ipAddress, port: form.port, username: form.username, isDefault: form.isDefault }
      if (form.password) body.password = form.password
      await $api(`/routers/${editingRouter.value.id}`, { method: 'PUT', body })
      toast.add({ title: 'Router berhasil diupdate', color: 'green', icon: 'i-heroicons-check-circle' })
    } else {
      if (!form.password) {
        toast.add({ title: 'Password wajib diisi', color: 'red', icon: 'i-heroicons-x-circle' })
        return
      }
      await $api('/routers', { method: 'POST', body: { ...form } })
      toast.add({ title: 'Router berhasil ditambahkan', color: 'green', icon: 'i-heroicons-check-circle' })
    }
    isOpen.value = false
    await refresh()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal menyimpan router', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    saving.value = false
  }
}

async function testConnection(router: RouterRow) {
  testing.value = router.id
  try {
    await $api(`/routers/${router.id}/test`, { method: 'POST' })
    toast.add({ title: `Koneksi ke ${router.name} berhasil`, color: 'green', icon: 'i-heroicons-check-circle' })
    await refresh()
  } catch {
    toast.add({ title: `Gagal terhubung ke ${router.name}`, color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    testing.value = null
  }
}

const confirmDelete = ref<RouterRow | null>(null)
const confirmDeleteOpen = computed({
  get: () => !!confirmDelete.value,
  set: (v: boolean) => { if (!v) confirmDelete.value = null },
})

async function deleteRouter(router: RouterRow) {
  confirmDelete.value = router
}

async function doDelete() {
  const router = confirmDelete.value
  if (!router) return
  confirmDelete.value = null
  deleting.value = router.id
  try {
    await $api(`/routers/${router.id}`, { method: 'DELETE' })
    toast.add({ title: 'Router berhasil dihapus', color: 'green', icon: 'i-heroicons-check-circle' })
    await refresh()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal menghapus router', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    deleting.value = null
  }
}


const columns = [
  { key: 'name', label: 'Nama' },
  { key: 'ipAddress', label: 'IP Address' },
  { key: 'username', label: 'Username' },
  { key: 'status', label: 'Status' },
  { key: 'lastConnectedAt', label: 'Last Connected' },
  { key: 'actions', label: '' },
]

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Routers</h1>
        <p class="text-sm text-gray-500 mt-1">Kelola koneksi MikroTik</p>
      </div>
      <UButton icon="i-heroicons-plus" @click="openAdd"> Tambah Router </UButton>
    </div>

    <UCard>
      <div v-if="pending" class="space-y-3 p-2">
        <USkeleton v-for="i in 4" :key="i" class="h-10 w-full" />
      </div>

      <div v-else-if="!routers.length" class="flex flex-col items-center justify-center py-16 text-gray-400">
        <UIcon name="i-heroicons-server" class="w-12 h-12 mb-3" />
        <p class="font-medium">Belum ada router</p>
        <p class="text-sm mt-1">Tambah router MikroTik untuk mulai mengelola hotspot</p>
        <UButton class="mt-4" icon="i-heroicons-plus" size="sm" @click="openAdd">Tambah Router</UButton>
      </div>

      <UTable v-else :columns="columns" :rows="routers">
        <template #name-data="{ row }">
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ row.name }}</span>
            <UBadge v-if="row.isDefault" size="xs" color="blue" variant="soft">Default</UBadge>
          </div>
        </template>

        <template #ipAddress-data="{ row }">
          <span class="font-mono text-sm">{{ row.ipAddress }}:{{ row.port }}</span>
        </template>

        <template #status-data="{ row }">
          <UBadge :color="row.isActive ? 'green' : 'gray'" variant="soft">
            {{ row.isActive ? 'Aktif' : 'Nonaktif' }}
          </UBadge>
        </template>

        <template #lastConnectedAt-data="{ row }">
          <span class="text-sm text-gray-500">{{ formatDate(row.lastConnectedAt) }}</span>
        </template>

        <template #actions-data="{ row }">
          <div class="flex items-center gap-1 justify-end">
            <UButton
              icon="i-heroicons-signal"
              size="xs"
              color="blue"
              variant="ghost"
              :loading="testing === row.id"
              @click="testConnection(row)"
            />
            <UButton
              icon="i-heroicons-pencil-square"
              size="xs"
              color="gray"
              variant="ghost"
              @click="openEdit(row)"
            />
            <UButton
              icon="i-heroicons-trash"
              size="xs"
              color="red"
              variant="ghost"
              :loading="deleting === row.id"
              @click="deleteRouter(row)"
            />
          </div>
        </template>
      </UTable>
    </UCard>

    <!-- Confirm Delete Modal -->
    <UModal v-model="confirmDeleteOpen" :ui="{ width: 'sm:max-w-sm' }">
      <UCard>
        <template #header>
          <p class="font-semibold text-red-600">Hapus Router</p>
        </template>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Hapus router <span class="font-semibold">{{ confirmDelete?.name }}</span>?
          Semua profil dan user hotspot yang terhubung akan ikut terhapus.
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
          <p class="font-semibold">{{ editingRouter ? 'Edit Router' : 'Tambah Router' }}</p>
        </template>

        <div class="space-y-4">
          <UFormGroup label="Nama Router" required>
            <UInput v-model="form.name" placeholder="Contoh: Main Router" />
          </UFormGroup>

          <div class="grid grid-cols-3 gap-3">
            <UFormGroup label="IP Address" class="col-span-2" required>
              <UInput v-model="form.ipAddress" placeholder="192.168.1.1" />
            </UFormGroup>
            <UFormGroup label="Port">
              <UInput v-model.number="form.port" type="number" placeholder="8728" />
            </UFormGroup>
          </div>

          <UFormGroup label="Username MikroTik" required>
            <UInput v-model="form.username" placeholder="admin" />
          </UFormGroup>

          <UFormGroup :label="editingRouter ? 'Password (kosongkan jika tidak diubah)' : 'Password'" :required="!editingRouter">
            <UInput v-model="form.password" type="password" placeholder="••••••••" />
          </UFormGroup>

          <UFormGroup>
            <UCheckbox v-model="form.isDefault" label="Set sebagai router default" />
          </UFormGroup>
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
