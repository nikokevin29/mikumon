<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { $api } = useApi()

type StatsData = {
  routers: number
  profiles: number
  hotspotUsers: number
  salesTotal: string
  activeSessions: number
  incomeToday: string
  incomeTodayCount: number
  incomeMonth: string
  incomeMonthCount: number
}

type RouterStatus = {
  routerName: string
  ipAddress: string
  boardName: string
  model: string
  version: string
  uptime: string
  cpuLoad: string
  freeMemory: string
  totalMemory: string
  date: string
  time: string
  hotspotActive: number
  hotspotUsers: number
}

const { data: stats, pending, refresh: refreshStats } = await useAsyncData('stats', () =>
  $api<{ success: true; data: StatsData }>('/stats'),
)

const { data: sessionsData, refresh: refreshSessions } = await useAsyncData(
  'sessions-dashboard',
  () => $api<{ success: true; data: any[] }>('/sessions'),
)

// Fetch default router for status panel — non-blocking
const routerStatus = ref<RouterStatus | null>(null)
const routerStatusError = ref<string | null>(null)
const routerStatusLoading = ref(false)

async function loadRouterStatus() {
  const routerList = await $api<{ success: true; data: any[] }>('/routers').catch(() => null)
  const defaultRouter = routerList?.data?.find((r: any) => r.isDefault) ?? routerList?.data?.[0]
  if (!defaultRouter) return

  routerStatusLoading.value = true
  routerStatusError.value = null
  try {
    const res = await $api<{ success: true; data: RouterStatus }>(`/routers/${defaultRouter.id}/status`)
    routerStatus.value = res.data
  } catch (e: any) {
    routerStatusError.value = e?.data?.error?.message ?? 'Router offline'
  } finally {
    routerStatusLoading.value = false
  }
}

const recentSessions = computed(() => sessionsData.value?.data?.slice(0, 10) ?? [])

let refreshTimer: ReturnType<typeof setInterval>
onMounted(() => {
  loadRouterStatus()
  refreshTimer = setInterval(() => {
    refreshStats()
    refreshSessions()
    loadRouterStatus()
  }, 30_000)
})
onBeforeUnmount(() => clearInterval(refreshTimer))

function formatRupiah(val: string | number) {
  return `Rp ${Number(val).toLocaleString('id-ID')}`
}

function formatBytes(bytes: string | number) {
  const b = Number(bytes)
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${b} B`
}

function formatTime(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<template>
  <div class="p-6 space-y-5">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <p class="text-sm text-gray-500 mt-1">Ringkasan sistem Mikumon</p>
    </div>

    <!-- Hero stat cards -->
    <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <USkeleton v-for="i in 4" :key="i" class="h-32 rounded-xl" />
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Hotspot Aktif -->
      <div class="rounded-xl bg-cyan-500 p-5 text-white shadow-md">
        <div class="flex items-center justify-between mb-3">
          <UIcon name="i-heroicons-wifi" class="w-7 h-7 opacity-80" />
          <span class="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">Live</span>
        </div>
        <p class="text-4xl font-bold leading-none">{{ stats?.data.activeSessions ?? 0 }}</p>
        <p class="text-sm mt-2 opacity-80">Hotspot Aktif</p>
      </div>

      <!-- Hotspot User -->
      <NuxtLink to="/hotspot">
        <div class="rounded-xl bg-emerald-500 p-5 text-white shadow-md cursor-pointer hover:brightness-110 transition-all h-full">
          <div class="flex items-center justify-between mb-3">
            <UIcon name="i-heroicons-users" class="w-7 h-7 opacity-80" />
            <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 opacity-50" />
          </div>
          <p class="text-4xl font-bold leading-none">{{ stats?.data.hotspotUsers ?? 0 }}</p>
          <p class="text-sm mt-2 opacity-80">Hotspot User</p>
        </div>
      </NuxtLink>

      <!-- Income Hari Ini -->
      <div class="rounded-xl bg-amber-500 p-5 text-white shadow-md">
        <div class="flex items-center justify-between mb-3">
          <UIcon name="i-heroicons-banknotes" class="w-7 h-7 opacity-80" />
          <span class="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
            {{ stats?.data.incomeTodayCount ?? 0 }} vcr
          </span>
        </div>
        <p class="text-2xl font-bold leading-none">{{ formatRupiah(stats?.data.incomeToday ?? 0) }}</p>
        <p class="text-sm mt-2 opacity-80">Income Hari Ini</p>
      </div>

      <!-- Income Bulan Ini -->
      <div class="rounded-xl bg-blue-500 p-5 text-white shadow-md">
        <div class="flex items-center justify-between mb-3">
          <UIcon name="i-heroicons-chart-bar-square" class="w-7 h-7 opacity-80" />
          <span class="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
            {{ stats?.data.incomeMonthCount ?? 0 }} vcr
          </span>
        </div>
        <p class="text-2xl font-bold leading-none">{{ formatRupiah(stats?.data.incomeMonth ?? 0) }}</p>
        <p class="text-sm mt-2 opacity-80">Income Bulan Ini</p>
      </div>
    </div>

    <!-- Router status panel (like Mikhmon's top info bar) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <!-- System date & board -->
      <UCard>
        <div class="flex items-start gap-3">
          <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
            <UIcon name="i-heroicons-calendar-days" class="w-5 h-5 text-slate-500" />
          </div>
          <div v-if="routerStatusLoading" class="space-y-1.5 w-full">
            <USkeleton class="h-3 w-24" />
            <USkeleton class="h-3 w-32" />
            <USkeleton class="h-3 w-20" />
          </div>
          <div v-else-if="routerStatus" class="text-sm space-y-0.5">
            <p class="font-semibold text-gray-800 dark:text-gray-100">{{ routerStatus.date }} {{ routerStatus.time }}</p>
            <p class="text-gray-500 text-xs">Uptime: <span class="font-mono">{{ routerStatus.uptime }}</span></p>
          </div>
          <div v-else class="text-xs text-gray-400 italic pt-1">
            {{ routerStatusError ?? 'Belum ada router' }}
          </div>
        </div>
      </UCard>

      <!-- Board info -->
      <UCard>
        <div class="flex items-start gap-3">
          <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
            <UIcon name="i-heroicons-cpu-chip" class="w-5 h-5 text-slate-500" />
          </div>
          <div v-if="routerStatus" class="text-sm space-y-0.5">
            <p class="font-semibold text-gray-800 dark:text-gray-100">{{ routerStatus.boardName }}</p>
            <p class="text-gray-500 text-xs">Model: {{ routerStatus.model }}</p>
            <p class="text-gray-500 text-xs">RouterOS {{ routerStatus.version }}</p>
          </div>
          <div v-else-if="!routerStatusLoading" class="text-xs text-gray-400 italic pt-1">-</div>
          <div v-else class="space-y-1.5 w-full">
            <USkeleton class="h-3 w-28" />
            <USkeleton class="h-3 w-20" />
            <USkeleton class="h-3 w-24" />
          </div>
        </div>
      </UCard>

      <!-- CPU & memory -->
      <UCard>
        <div class="flex items-start gap-3">
          <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
            <UIcon name="i-heroicons-server-stack" class="w-5 h-5 text-slate-500" />
          </div>
          <div v-if="routerStatus" class="text-sm space-y-0.5">
            <p class="font-semibold text-gray-800 dark:text-gray-100">CPU Load: {{ routerStatus.cpuLoad }}</p>
            <p class="text-gray-500 text-xs">Free Memory: {{ formatBytes(routerStatus.freeMemory) }}</p>
            <p class="text-gray-500 text-xs">Total: {{ formatBytes(routerStatus.totalMemory) }}</p>
          </div>
          <div v-else-if="!routerStatusLoading" class="text-xs text-gray-400 italic pt-1">-</div>
          <div v-else class="space-y-1.5 w-full">
            <USkeleton class="h-3 w-24" />
            <USkeleton class="h-3 w-28" />
            <USkeleton class="h-3 w-20" />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Secondary stats -->
    <div class="grid grid-cols-2 gap-3">
      <NuxtLink to="/routers">
        <UCard class="hover:shadow-md transition-shadow cursor-pointer">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              <UIcon name="i-heroicons-server" class="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p class="text-xs text-gray-500">Routers</p>
              <p class="text-xl font-bold text-gray-900 dark:text-white">{{ stats?.data.routers ?? 0 }}</p>
            </div>
          </div>
        </UCard>
      </NuxtLink>
      <NuxtLink to="/profiles">
        <UCard class="hover:shadow-md transition-shadow cursor-pointer">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              <UIcon name="i-heroicons-user-group" class="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p class="text-xs text-gray-500">Profiles</p>
              <p class="text-xl font-bold text-gray-900 dark:text-white">{{ stats?.data.profiles ?? 0 }}</p>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>

    <!-- Bottom row: sessions log + quick actions -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Sesi aktif terbaru -->
      <UCard class="lg:col-span-2">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p class="font-semibold">Sesi Aktif Terbaru</p>
            </div>
            <NuxtLink to="/monitoring">
              <UButton size="xs" variant="ghost" color="gray" trailing-icon="i-heroicons-arrow-top-right-on-square">
                Live Monitor
              </UButton>
            </NuxtLink>
          </div>
        </template>

        <div v-if="!recentSessions.length" class="py-10 text-center text-gray-400 text-sm">
          <UIcon name="i-heroicons-wifi" class="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Tidak ada sesi aktif saat ini</p>
        </div>

        <div v-else class="divide-y divide-gray-100 dark:divide-gray-800 -mx-4 -my-3">
          <div
            v-for="s in recentSessions"
            :key="s.id"
            class="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <span class="text-xs text-gray-400 w-20 shrink-0 font-mono">
              {{ formatTime(s.lastUpdated) }}
            </span>
            <span class="font-mono text-sm font-medium text-gray-800 dark:text-gray-200 w-28 shrink-0 truncate">
              {{ s.username ?? '-' }}
            </span>
            <span class="text-xs text-gray-500 font-mono flex-1 truncate">{{ s.ipAddress ?? '-' }}</span>
            <span class="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full shrink-0">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              active
            </span>
          </div>
        </div>
      </UCard>

      <!-- Akses cepat -->
      <UCard>
        <template #header>
          <p class="font-semibold">Akses Cepat</p>
        </template>
        <div class="space-y-2">
          <NuxtLink to="/hotspot">
            <UButton block variant="soft" color="green" icon="i-heroicons-wifi" class="justify-start">
              Hotspot Users
            </UButton>
          </NuxtLink>
          <NuxtLink to="/routers">
            <UButton block variant="soft" color="blue" icon="i-heroicons-server" class="justify-start">
              Kelola Routers
            </UButton>
          </NuxtLink>
          <NuxtLink to="/monitoring">
            <UButton block variant="soft" color="purple" icon="i-heroicons-signal" class="justify-start">
              Live Monitoring
            </UButton>
          </NuxtLink>
          <NuxtLink to="/reports">
            <UButton block variant="soft" color="yellow" icon="i-heroicons-chart-bar" class="justify-start">
              Laporan Penjualan
            </UButton>
          </NuxtLink>
        </div>
      </UCard>
    </div>
  </div>
</template>
