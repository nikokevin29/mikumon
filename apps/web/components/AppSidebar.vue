<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const route = useRoute()

const open = ref<Record<string, boolean>>({
  hotspot: true,
  hotspotUsers: false,
  network: false,
})

function toggle(key: string) {
  open.value[key] = !open.value[key]
}

function isActive(path: string) {
  return route.path === path
}

function isGroupActive(paths: string[]) {
  return paths.some((p) => route.path.startsWith(p))
}

const navLink = 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors'
const navLinkSub = 'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors'
const navLinkSubSub = 'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors'
const active = 'bg-primary-600 text-white'
const activeSub = 'bg-primary-600/80 text-white'
const inactive = 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
const inactiveSub = 'text-gray-400 hover:bg-gray-700/60 hover:text-white'
</script>

<template>
  <aside class="w-56 flex-shrink-0 flex flex-col bg-gray-900 text-gray-100 h-screen overflow-hidden">
    <!-- Brand -->
    <div class="px-4 py-4 border-b border-gray-700/60">
      <p class="text-base font-bold tracking-wide text-white">MIKUMON</p>
      <p class="text-xs text-gray-400 mt-0.5">ISP Management</p>
    </div>

    <!-- Nav -->
    <nav class="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">

      <!-- Dashboard -->
      <NuxtLink to="/">
        <div :class="[navLink, isActive('/') ? active : inactive]">
          <UIcon name="i-heroicons-home" class="w-4 h-4 shrink-0" />
          <span>Dashboard</span>
        </div>
      </NuxtLink>

      <!-- Hotspot group -->
      <div>
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-700/60"
          :class="isGroupActive(['/hotspot', '/monitoring', '/profiles']) ? 'text-white' : 'text-gray-300'"
          @click="toggle('hotspot')"
        >
          <UIcon name="i-heroicons-wifi" class="w-4 h-4 shrink-0" />
          <span class="flex-1 text-left">Hotspot</span>
          <UIcon name="i-heroicons-chevron-down" class="w-3.5 h-3.5 transition-transform duration-200" :class="open.hotspot ? 'rotate-180' : ''" />
        </button>

        <div v-show="open.hotspot" class="ml-3 mt-0.5 pl-3 border-l border-gray-700 space-y-0.5">
          <!-- Users sub-group -->
          <button
            class="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-gray-700/60"
            :class="isGroupActive(['/hotspot']) ? 'text-white' : 'text-gray-400'"
            @click="toggle('hotspotUsers')"
          >
            <UIcon name="i-heroicons-users" class="w-3.5 h-3.5 shrink-0" />
            <span class="flex-1 text-left">Users</span>
            <UIcon name="i-heroicons-chevron-down" class="w-3 h-3 transition-transform duration-200" :class="open.hotspotUsers ? 'rotate-180' : ''" />
          </button>

          <div v-show="open.hotspotUsers" class="ml-3 pl-3 border-l border-gray-700/60 space-y-0.5">
            <NuxtLink to="/hotspot">
              <div :class="[navLinkSubSub, isActive('/hotspot') ? activeSub : inactiveSub]">
                <UIcon name="i-heroicons-list-bullet" class="w-3.5 h-3.5 shrink-0" />
                <span>Daftar User</span>
              </div>
            </NuxtLink>
            <NuxtLink to="/hotspot?generate=1">
              <div :class="[navLinkSubSub, inactiveSub]">
                <UIcon name="i-heroicons-sparkles" class="w-3.5 h-3.5 shrink-0" />
                <span>Generate</span>
              </div>
            </NuxtLink>
          </div>

          <NuxtLink to="/profiles">
            <div :class="[navLinkSub, isActive('/profiles') ? activeSub : inactiveSub]">
              <UIcon name="i-heroicons-user-group" class="w-3.5 h-3.5 shrink-0" />
              <span>User Profile</span>
            </div>
          </NuxtLink>

          <NuxtLink to="/hotspot/vouchers">
            <div :class="[navLinkSub, isActive('/hotspot/vouchers') ? activeSub : inactiveSub]">
              <UIcon name="i-heroicons-ticket" class="w-3.5 h-3.5 shrink-0" />
              <span>Vouchers</span>
            </div>
          </NuxtLink>

          <NuxtLink to="/monitoring">
            <div :class="[navLinkSub, isActive('/monitoring') ? activeSub : inactiveSub]">
              <UIcon name="i-heroicons-signal" class="w-3.5 h-3.5 shrink-0" />
              <span>Hotspot Aktif</span>
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- Routers -->
      <NuxtLink to="/routers">
        <div :class="[navLink, isActive('/routers') ? active : inactive]">
          <UIcon name="i-heroicons-server" class="w-4 h-4 shrink-0" />
          <span>Routers</span>
        </div>
      </NuxtLink>

      <!-- Network group (PPP + DHCP) -->
      <div>
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-700/60"
          :class="isGroupActive(['/ppp', '/dhcp']) ? 'text-white' : 'text-gray-300'"
          @click="toggle('network')"
        >
          <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 shrink-0" />
          <span class="flex-1 text-left">Network</span>
          <UIcon name="i-heroicons-chevron-down" class="w-3.5 h-3.5 transition-transform duration-200" :class="open.network ? 'rotate-180' : ''" />
        </button>

        <div v-show="open.network" class="ml-3 mt-0.5 pl-3 border-l border-gray-700 space-y-0.5">
          <NuxtLink to="/ppp">
            <div :class="[navLinkSub, isActive('/ppp') ? activeSub : inactiveSub]">
              <UIcon name="i-heroicons-arrows-right-left" class="w-3.5 h-3.5 shrink-0" />
              <span>PPP Management</span>
            </div>
          </NuxtLink>
          <NuxtLink to="/dhcp">
            <div :class="[navLinkSub, isActive('/dhcp') ? activeSub : inactiveSub]">
              <UIcon name="i-heroicons-computer-desktop" class="w-3.5 h-3.5 shrink-0" />
              <span>DHCP Leases</span>
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- Divider -->
      <div class="pt-1 pb-1">
        <div class="border-t border-gray-700/60" />
      </div>

      <!-- Live Monitoring -->
      <NuxtLink to="/monitoring">
        <div :class="[navLink, isActive('/monitoring') ? active : inactive]">
          <UIcon name="i-heroicons-chart-bar-square" class="w-4 h-4 shrink-0" />
          <span>Live Monitoring</span>
        </div>
      </NuxtLink>

      <!-- Laporan -->
      <NuxtLink to="/reports">
        <div :class="[navLink, isActive('/reports') ? active : inactive]">
          <UIcon name="i-heroicons-chart-bar" class="w-4 h-4 shrink-0" />
          <span>Laporan Penjualan</span>
        </div>
      </NuxtLink>

      <!-- Settings -->
      <NuxtLink to="/settings">
        <div :class="[navLink, isActive('/settings') ? active : inactive]">
          <UIcon name="i-heroicons-cog-6-tooth" class="w-4 h-4 shrink-0" />
          <span>Pengaturan</span>
        </div>
      </NuxtLink>

    </nav>

    <!-- User + Logout -->
    <div class="px-3 py-3 border-t border-gray-700/60">
      <div class="px-2 py-1.5 mb-2">
        <p class="text-sm font-medium text-white truncate">{{ authStore.user?.name }}</p>
        <p class="text-xs text-gray-400 truncate">{{ authStore.user?.email }}</p>
      </div>
      <button
        class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-700/60 hover:text-white transition-colors"
        @click="authStore.logout()"
      >
        <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4 h-4" />
        <span>Logout</span>
      </button>
    </div>
  </aside>
</template>
