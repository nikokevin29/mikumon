<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { $api } = useApi()
const toast = useToast()

interface RouterOption { id: number; name: string; ipAddress: string }
interface PppSecret {
  id: string; name: string; password: string; service: string
  profile: string; localAddress: string; remoteAddress: string
  comment: string; disabled: boolean
}
interface PppActive {
  id: string; name: string; service: string; address: string
  uptime: string; bytesIn: string; bytesOut: string
}

const { data: routerData } = await useAsyncData('routers-ppp', () =>
  $api<{ data: RouterOption[] }>('/routers?limit=100'),
)
const routerOptions = computed(() =>
  (routerData.value?.data ?? []).map((r) => ({ label: `${r.name} (${r.ipAddress})`, value: r.id })),
)
const selectedRouterId = ref<number | null>(null)
watch(routerOptions, (opts) => { if (opts.length && !selectedRouterId.value) selectedRouterId.value = opts[0]!.value }, { immediate: true })

const activeTab = ref(0)
const tabs = [{ label: 'Secrets' }, { label: 'Active Sessions' }]

// Secrets
const secrets = ref<PppSecret[]>([])
const secretsLoading = ref(false)
const secretsError = ref<string | null>(null)

async function loadSecrets() {
  if (!selectedRouterId.value) return
  secretsLoading.value = true
  secretsError.value = null
  try {
    const res = await $api<{ data: PppSecret[] }>(`/ppp/secrets?routerId=${selectedRouterId.value}`)
    secrets.value = res.data
  } catch (e: any) {
    secretsError.value = e?.data?.error?.message ?? 'Gagal memuat secrets'
  } finally {
    secretsLoading.value = false
  }
}

// Active sessions
const activeSessions = ref<PppActive[]>([])
const activeLoading = ref(false)

async function loadActive() {
  if (!selectedRouterId.value) return
  activeLoading.value = true
  try {
    const res = await $api<{ data: PppActive[] }>(`/ppp/active?routerId=${selectedRouterId.value}`)
    activeSessions.value = res.data
  } catch {
    activeSessions.value = []
  } finally {
    activeLoading.value = false
  }
}

watch(selectedRouterId, () => {
  loadSecrets()
  loadActive()
}, { immediate: true })

watch(activeTab, (t) => { if (t === 1) loadActive() })

// Add secret modal
const addOpen = ref(false)
const saving = ref(false)
const form = reactive({ name: '', password: '', service: 'pppoe', profile: 'default', comment: '' })

async function addSecret() {
  if (!form.name || !form.password) {
    toast.add({ title: 'Nama dan password wajib diisi', color: 'red', icon: 'i-heroicons-x-circle' })
    return
  }
  saving.value = true
  try {
    await $api('/ppp/secrets', { method: 'POST', body: { routerId: selectedRouterId.value, ...form } })
    toast.add({ title: 'PPPoE secret berhasil ditambahkan', color: 'green', icon: 'i-heroicons-check-circle' })
    addOpen.value = false
    Object.assign(form, { name: '', password: '', service: 'pppoe', profile: 'default', comment: '' })
    await loadSecrets()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal menambahkan secret', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    saving.value = false
  }
}

const deletingSecret = ref<string | null>(null)
async function deleteSecret(s: PppSecret) {
  if (!confirm(`Hapus secret "${s.name}"?`)) return
  deletingSecret.value = s.id
  try {
    await $api(`/ppp/secrets/${s.id}?routerId=${selectedRouterId.value}`, { method: 'DELETE' })
    toast.add({ title: `Secret ${s.name} dihapus`, color: 'green', icon: 'i-heroicons-check-circle' })
    await loadSecrets()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal menghapus', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    deletingSecret.value = null
  }
}

const disconnecting = ref<string | null>(null)
async function disconnect(s: PppActive) {
  if (!confirm(`Putus koneksi "${s.name}"?`)) return
  disconnecting.value = s.id
  try {
    await $api(`/ppp/active/${s.id}?routerId=${selectedRouterId.value}`, { method: 'DELETE' })
    toast.add({ title: `Koneksi ${s.name} diputus`, color: 'green', icon: 'i-heroicons-check-circle' })
    await loadActive()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal memutus', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    disconnecting.value = null
  }
}

function formatBytes(b: string) {
  const n = Number(b)
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">PPP Management</h1>
        <p class="text-sm text-gray-500 mt-1">Kelola PPPoE secrets dan sesi aktif</p>
      </div>
      <div class="flex gap-2">
        <USelect v-model="selectedRouterId" :options="routerOptions" value-attribute="value" option-attribute="label" placeholder="Pilih router..." icon="i-heroicons-server" class="w-52" />
        <UButton v-if="activeTab === 0" icon="i-heroicons-plus" @click="addOpen = true">Tambah Secret</UButton>
        <UButton v-else icon="i-heroicons-arrow-path" variant="soft" color="gray" @click="loadActive">Refresh</UButton>
      </div>
    </div>

    <UTabs v-model="activeTab" :items="tabs" class="mb-4" />

    <!-- Secrets tab -->
    <UCard v-if="activeTab === 0">
      <div v-if="secretsLoading" class="space-y-3 p-2">
        <USkeleton v-for="i in 5" :key="i" class="h-10" />
      </div>
      <div v-else-if="secretsError" class="py-10 text-center text-red-500 text-sm">
        <UIcon name="i-heroicons-exclamation-circle" class="w-8 h-8 mx-auto mb-2" />
        <p>{{ secretsError }}</p>
      </div>
      <div v-else-if="!secrets.length" class="py-16 text-center text-gray-400">
        <UIcon name="i-heroicons-key" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Tidak ada PPPoE secret</p>
      </div>
      <UTable v-else :rows="secrets" :columns="[
        { key: 'name', label: 'Username' },
        { key: 'service', label: 'Service' },
        { key: 'profile', label: 'Profile' },
        { key: 'remoteAddress', label: 'Remote IP' },
        { key: 'comment', label: 'Komentar' },
        { key: 'actions', label: '' },
      ]">
        <template #name-data="{ row }">
          <span class="font-mono font-medium">{{ row.name }}</span>
        </template>
        <template #remoteAddress-data="{ row }">
          <span class="font-mono text-xs text-gray-500">{{ row.remoteAddress || '-' }}</span>
        </template>
        <template #comment-data="{ row }">
          <span class="text-xs text-gray-500">{{ row.comment || '-' }}</span>
        </template>
        <template #actions-data="{ row }">
          <div class="flex justify-end">
            <UButton icon="i-heroicons-trash" size="xs" color="red" variant="ghost" :loading="deletingSecret === row.id" @click="deleteSecret(row)" />
          </div>
        </template>
      </UTable>
    </UCard>

    <!-- Active sessions tab -->
    <UCard v-else>
      <div v-if="activeLoading" class="space-y-3 p-2">
        <USkeleton v-for="i in 5" :key="i" class="h-10" />
      </div>
      <div v-else-if="!activeSessions.length" class="py-16 text-center text-gray-400">
        <UIcon name="i-heroicons-signal-slash" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Tidak ada sesi PPPoE aktif</p>
      </div>
      <UTable v-else :rows="activeSessions" :columns="[
        { key: 'name', label: 'Username' },
        { key: 'address', label: 'IP Address' },
        { key: 'uptime', label: 'Uptime' },
        { key: 'bytesIn', label: 'Download' },
        { key: 'bytesOut', label: 'Upload' },
        { key: 'actions', label: '' },
      ]">
        <template #name-data="{ row }">
          <span class="font-mono font-medium">{{ row.name }}</span>
        </template>
        <template #address-data="{ row }">
          <span class="font-mono text-sm">{{ row.address }}</span>
        </template>
        <template #bytesIn-data="{ row }">
          <span class="text-xs text-blue-600">{{ formatBytes(row.bytesIn) }}</span>
        </template>
        <template #bytesOut-data="{ row }">
          <span class="text-xs text-emerald-600">{{ formatBytes(row.bytesOut) }}</span>
        </template>
        <template #actions-data="{ row }">
          <div class="flex justify-end">
            <UButton icon="i-heroicons-x-circle" size="xs" color="red" variant="ghost" :loading="disconnecting === row.id" @click="disconnect(row)">Putus</UButton>
          </div>
        </template>
      </UTable>
    </UCard>

    <!-- Add Secret Modal -->
    <UModal v-model="addOpen" :ui="{ width: 'sm:max-w-md' }">
      <UCard>
        <template #header><p class="font-semibold">Tambah PPPoE Secret</p></template>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup label="Username" required>
              <UInput v-model="form.name" placeholder="user001" />
            </UFormGroup>
            <UFormGroup label="Password" required>
              <UInput v-model="form.password" placeholder="••••••••" />
            </UFormGroup>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup label="Service">
              <UInput v-model="form.service" placeholder="pppoe" />
            </UFormGroup>
            <UFormGroup label="Profile">
              <UInput v-model="form.profile" placeholder="default" />
            </UFormGroup>
          </div>
          <UFormGroup label="Komentar">
            <UInput v-model="form.comment" placeholder="Opsional..." />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="addOpen = false">Batal</UButton>
            <UButton :loading="saving" @click="addSecret">Simpan</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
