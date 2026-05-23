<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const navLinks = [
  [
    { label: 'Dashboard', icon: 'i-heroicons-home', to: '/' },
  ],
  [
    { label: 'Routers', icon: 'i-heroicons-server', to: '/routers' },
    { label: 'Profiles', icon: 'i-heroicons-user-group', to: '/profiles' },
    { label: 'Hotspot Users', icon: 'i-heroicons-wifi', to: '/hotspot' },
  ],
  [
    { label: 'Live Monitoring', icon: 'i-heroicons-signal', to: '/monitoring' },
    { label: 'Laporan Penjualan', icon: 'i-heroicons-chart-bar', to: '/reports' },
  ],
]
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
    <aside
      class="w-60 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col"
    >
      <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <p class="text-lg font-bold text-primary-600">Mikumon</p>
        <p class="text-xs text-gray-500">ISP Management</p>
      </div>

      <nav class="flex-1 overflow-y-auto p-3">
        <UVerticalNavigation :links="navLinks" />
      </nav>

      <div class="p-3 border-t border-gray-200 dark:border-gray-700">
        <div class="px-2 py-2 mb-1">
          <p class="text-sm font-medium truncate text-gray-800 dark:text-gray-200">
            {{ authStore.user?.name }}
          </p>
          <p class="text-xs text-gray-500 truncate">{{ authStore.user?.email }}</p>
        </div>
        <UButton
          block
          variant="ghost"
          color="gray"
          icon="i-heroicons-arrow-right-on-rectangle"
          @click="authStore.logout()"
        >
          Logout
        </UButton>
      </div>
    </aside>

    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>
  </div>
</template>
