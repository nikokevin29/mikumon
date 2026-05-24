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

interface RouterStatus {
  routerName: string
  ipAddress: string
  uptime: string
  version: string
  cpuLoad: string
  freeMemory: string
  totalMemory: string
  boardName: string
  model: string
  date: string
  time: string
  hotspotActive: number
  hotspotUsers: number
}

const { data, pending, refresh } = await useAsyncData('routers', () =>
  $api<{ data: RouterRow[]; pagination: any }>('/routers?limit=100'),
)
const routers = computed(() => data.value?.data ?? [])

// Per-row status state
const expandedId = ref<number | null>(null)
const statusCache = ref<Record<number, RouterStatus | 'loading' | 'error'>>({})

async function toggleStatus(router: RouterRow) {
  if (expandedId.value === router.id) {
    expandedId.value = null
    return
  }
  expandedId.value = router.id
  if (statusCache.value[router.id]) return
  statusCache.value[router.id] = 'loading'
  try {
    const res = await $api<{ success: true; data: RouterStatus }>(`/routers/${router.id}/status`)
    statusCache.value[router.id] = res.data
  } catch {
    statusCache.value[router.id] = 'error'
  }
}

async function refreshStatus(routerId: number) {
  statusCache.value[routerId] = 'loading'
  try {
    const res = await $api<{ success: true; data: RouterStatus }>(`/routers/${routerId}/status`)
    statusCache.value[routerId] = res.data
  } catch {
    statusCache.value[routerId] = 'error'
  }
}

function formatBytes(bytes: string | number) {
  const b = Number(bytes)
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${b} B`
}

function memPercent(free: string, total: string) {
  const f = Number(free), t = Number(total)
  if (!t) return 0
  return Math.round(((t - f) / t) * 100)
}

function cpuNum(load: string) {
  return parseInt(load) || 0
}

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
  { key: 'expand', label: '' },
  { key: 'name', label: 'Nama' },
  { key: 'ipAddress', label: 'IP Address' },
  { key: 'username', label: 'Username' },
  { key: 'status', label: 'Status' },
  { key: 'lastConnectedAt', label: 'Last Connected' },
  { key: 'actions', label: '' },
]

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function getStatus(id: number): RouterStatus | null {
  const s = statusCache.value[id]
  if (!s || s === 'loading' || s === 'error') return null
  return s
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Routers</h1>
        <p class="text-sm text-gray-500 mt-1">Kelola koneksi MikroTik</p>
      </div>
      <UButton icon="i-heroicons-plus" @click="openAdd">Tambah Router</UButton>
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

      <template v-else>
        <div class="divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="row in routers" :key="row.id">
            <!-- Main row -->
            <div class="flex items-center gap-3 px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              <button
                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
                @click="toggleStatus(row)"
              >
                <UIcon
                  name="i-heroicons-chevron-right"
                  class="w-4 h-4 text-gray-400 transition-transform duration-200"
                  :class="expandedId === row.id ? 'rotate-90' : ''"
                />
              </button>

              <div class="flex items-center gap-2 w-44 shrink-0">
                <span class="font-medium text-gray-900 dark:text-white truncate">{{ row.name }}</span>
                <UBadge v-if="row.isDefault" size="xs" color="blue" variant="soft">Default</UBadge>
              </div>

              <span class="font-mono text-sm text-gray-600 dark:text-gray-300 w-36 shrink-0">{{ row.ipAddress }}:{{ row.port }}</span>
              <span class="text-sm text-gray-500 w-24 shrink-0 truncate">{{ row.username }}</span>

              <div class="flex-1">
                <UBadge :color="row.isActive ? 'green' : 'gray'" variant="soft" size="sm">
                  {{ row.isActive ? 'Aktif' : 'Nonaktif' }}
                </UBadge>
              </div>

              <span class="text-xs text-gray-400 w-32 shrink-0 text-right">{{ formatDate(row.lastConnectedAt) }}</span>

              <div class="flex items-center gap-1 shrink-0">
                <UTooltip text="Test Koneksi">
                  <UButton icon="i-heroicons-signal" size="xs" color="blue" variant="ghost" :loading="testing === row.id" @click="testConnection(row)" />
                </UTooltip>
                <UButton icon="i-heroicons-pencil-square" size="xs" color="gray" variant="ghost" @click="openEdit(row)" />
                <UButton icon="i-heroicons-trash" size="xs" color="red" variant="ghost" :loading="deleting === row.id" @click="confirmDelete = row" />
              </div>
            </div>

            <!-- Expandable status panel — uses getStatus() to avoid 'as' cast in template -->
            <div v-if="expandedId === row.id" class="bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 px-10 py-4">
              <div v-if="statusCache[row.id] === 'loading'" class="flex items-center gap-3 text-sm text-gray-500">
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                Mengambil status dari MikroTik...
              </div>

              <div v-else-if="statusCache[row.id] === 'error'" class="flex items-center gap-2 text-sm text-red-500">
                <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4" />
                Router offline atau tidak dapat dijangkau
                <UButton size="xs" variant="ghost" color="red" icon="i-heroicons-arrow-path" @click="refreshStatus(row.id)">Coba lagi</UButton>
              </div>

              <div v-else-if="getStatus(row.id)" class="space-y-3">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status Real-time</p>
                  <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-arrow-path" @click="refreshStatus(row.id)">Refresh</UButton>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div class="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                    <p class="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Board</p>
                    <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ getStatus(row.id)?.boardName }}</p>
                    <p class="text-xs text-gray-500">RouterOS {{ getStatus(row.id)?.version }}</p>
                  </div>

                  <div class="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                    <p class="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Uptime</p>
                    <p class="text-sm font-mono font-semibold text-gray-800 dark:text-gray-100">{{ getStatus(row.id)?.uptime }}</p>
                    <p class="text-xs text-gray-500">{{ getStatus(row.id)?.date }} {{ getStatus(row.id)?.time }}</p>
                  </div>

                  <div class="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                    <p class="text-[10px] text-gray-400 uppercase tracking-wide mb-1">CPU Load</p>
                    <p class="text-sm font-semibold mb-1" :class="cpuNum(getStatus(row.id)?.cpuLoad ?? '0') > 80 ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'">
                      {{ getStatus(row.id)?.cpuLoad }}
                    </p>
                    <UProgress
                      :value="cpuNum(getStatus(row.id)?.cpuLoad ?? '0')"
                      :color="cpuNum(getStatus(row.id)?.cpuLoad ?? '0') > 80 ? 'red' : cpuNum(getStatus(row.id)?.cpuLoad ?? '0') > 60 ? 'yellow' : 'green'"
                      size="xs"
                    />
                  </div>

                  <div class="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                    <p class="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Memory</p>
                    <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">
                      {{ memPercent(getStatus(row.id)?.freeMemory ?? '0', getStatus(row.id)?.totalMemory ?? '0') }}%
                    </p>
                    <UProgress
                      :value="memPercent(getStatus(row.id)?.freeMemory ?? '0', getStatus(row.id)?.totalMemory ?? '0')"
                      :color="memPercent(getStatus(row.id)?.freeMemory ?? '0', getStatus(row.id)?.totalMemory ?? '0') > 80 ? 'red' : 'blue'"
                      size="xs"
                    />
                    <p class="text-[10px] text-gray-400 mt-1">
                      Free {{ formatBytes(getStatus(row.id)?.freeMemory ?? '0') }} / {{ formatBytes(getStatus(row.id)?.totalMemory ?? '0') }}
                    </p>
                  </div>
                </div>

                <div class="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span><span class="font-semibold text-emerald-600">{{ getStatus(row.id)?.hotspotActive }}</span> sesi aktif</span>
                  <span><span class="font-semibold text-gray-800 dark:text-gray-200">{{ getStatus(row.id)?.hotspotUsers }}</span> total user</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
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
