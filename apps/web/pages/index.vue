<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { $api } = useApi()

const { data: stats, pending } = await useAsyncData('stats', () =>
  $api<{ success: true; data: { routers: number; profiles: number; hotspotUsers: number; salesTotal: string } }>('/stats'),
)

const cards = computed(() => [
  {
    label: 'Routers',
    value: stats.value?.data.routers ?? 0,
    icon: 'i-heroicons-server',
    color: 'blue',
    to: '/routers',
  },
  {
    label: 'Profiles',
    value: stats.value?.data.profiles ?? 0,
    icon: 'i-heroicons-user-group',
    color: 'purple',
    to: '/profiles',
  },
  {
    label: 'Hotspot Users',
    value: stats.value?.data.hotspotUsers ?? 0,
    icon: 'i-heroicons-wifi',
    color: 'green',
    to: '/hotspot',
  },
  {
    label: 'Total Penjualan',
    value: `Rp ${Number(stats.value?.data.salesTotal ?? 0).toLocaleString('id-ID')}`,
    icon: 'i-heroicons-banknotes',
    color: 'yellow',
    to: null,
  },
])
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <p class="text-sm text-gray-500 mt-1">Ringkasan sistem Mikumon</p>
    </div>

    <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <USkeleton v-for="i in 4" :key="i" class="h-28 rounded-lg" />
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <NuxtLink
        v-for="card in cards"
        :key="card.label"
        :to="card.to ?? undefined"
        :class="card.to ? 'cursor-pointer hover:shadow-md transition-shadow' : 'cursor-default'"
      >
        <UCard>
          <div class="flex items-center gap-4">
            <div :class="`p-3 rounded-lg bg-${card.color}-50 dark:bg-${card.color}-950`">
              <UIcon :name="card.icon" :class="`w-6 h-6 text-${card.color}-600`" />
            </div>
            <div>
              <p class="text-sm text-gray-500">{{ card.label }}</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ card.value }}</p>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>

    <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <p class="font-semibold">Akses Cepat</p>
        </template>
        <div class="space-y-2">
          <NuxtLink to="/routers">
            <UButton block variant="ghost" color="gray" icon="i-heroicons-server" class="justify-start">
              Kelola Routers
            </UButton>
          </NuxtLink>
          <NuxtLink to="/profiles">
            <UButton block variant="ghost" color="gray" icon="i-heroicons-user-group" class="justify-start">
              Kelola Profiles
            </UButton>
          </NuxtLink>
          <NuxtLink to="/hotspot">
            <UButton block variant="ghost" color="gray" icon="i-heroicons-wifi" class="justify-start">
              Hotspot Users
            </UButton>
          </NuxtLink>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <p class="font-semibold">Info Sistem</p>
        </template>
        <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div class="flex justify-between">
            <span>Platform</span>
            <span class="font-medium">Mikumon v1.0</span>
          </div>
          <UDivider />
          <div class="flex justify-between">
            <span>Backend</span>
            <span class="font-medium">Elysia + Bun</span>
          </div>
          <UDivider />
          <div class="flex justify-between">
            <span>Database</span>
            <span class="font-medium">PostgreSQL + Drizzle</span>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
