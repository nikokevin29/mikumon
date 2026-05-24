<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const voucherStore = useVoucherStore()
const router = useRouter()

const vouchers = computed(() => voucherStore.lastGenerated)
const profileName = computed(() => voucherStore.profileName)

// Layout options
const perRow = ref<2 | 3 | 4>(3)
const showCutLines = ref(true)
const showLogo = ref(true)

const perRowOptions = [
  { label: '2 per baris', value: 2 },
  { label: '3 per baris', value: 3 },
  { label: '4 per baris', value: 4 },
]

const gridClass = computed(() => ({
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
}[perRow.value]))

const printGridClass = computed(() => ({
  2: 'print:grid-cols-2',
  3: 'print:grid-cols-3',
  4: 'print:grid-cols-4',
}[perRow.value]))

onMounted(() => {
  if (!vouchers.value.length) router.replace('/hotspot')
})

function print() {
  window.print()
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

onBeforeUnmount(() => {
  voucherStore.clear()
})
</script>

<template>
  <div>
    <!-- Screen controls — hidden on print -->
    <div class="print:hidden p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Cetak Voucher</h1>
          <p class="text-sm text-gray-500 mt-0.5">
            <span class="font-semibold text-gray-700 dark:text-gray-300">{{ vouchers.length }}</span> voucher &mdash; Profil:
            <span class="font-semibold text-primary-600">{{ profileName }}</span>
          </p>
        </div>
        <div class="flex gap-2">
          <UButton color="gray" variant="ghost" icon="i-heroicons-arrow-left" to="/hotspot">Kembali</UButton>
          <UButton icon="i-heroicons-printer" @click="print">Cetak / Simpan PDF</UButton>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-4">
        <USelectMenu v-model="perRow" :options="perRowOptions" value-attribute="value" option-attribute="label" class="w-36" />
        <UToggle v-model="showCutLines" label="Garis potong" />
        <UToggle v-model="showLogo" label="Tampilkan logo" />
      </div>

      <UAlert
        color="amber"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        description="Data voucher hanya tersedia di halaman ini. Cetak atau simpan PDF sebelum meninggalkan halaman."
        class="mt-4"
      />
    </div>

    <!-- Voucher grid — printed area -->
    <div id="print-area" class="p-4 print:p-2">
      <div
        class="grid gap-0"
        :class="[gridClass, printGridClass]"
      >
        <div
          v-for="v in vouchers"
          :key="v.id"
          class="relative"
          :class="showCutLines ? 'p-1' : 'p-0.5'"
        >
          <!-- Cut-line border -->
          <div
            class="h-full"
            :class="showCutLines ? 'border border-dashed border-gray-300 print:border-gray-400' : 'border border-gray-200 print:border-gray-300'"
            style="border-radius: 4px;"
          >
            <div class="p-3 flex flex-col items-center text-center h-full">
              <!-- Header / Logo -->
              <div v-if="showLogo" class="w-full mb-2 pb-1.5 border-b border-gray-200">
                <p class="text-xs font-black tracking-widest text-gray-800 uppercase">MIKUMON</p>
                <p class="text-[9px] text-gray-400 tracking-wide">Hotspot Internet</p>
              </div>

              <!-- Profile name -->
              <p class="text-[10px] font-semibold text-primary-600 mb-2 uppercase tracking-wide">{{ profileName }}</p>

              <!-- Credentials -->
              <div class="w-full space-y-1.5">
                <div class="bg-gray-50 print:bg-gray-100 rounded px-2 py-1.5">
                  <p class="text-[9px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">Username</p>
                  <p class="font-mono font-black text-sm text-gray-900 leading-tight tracking-wide">{{ v.username }}</p>
                </div>
                <div class="bg-gray-50 print:bg-gray-100 rounded px-2 py-1.5">
                  <p class="text-[9px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">Password</p>
                  <p class="font-mono font-black text-sm text-gray-900 leading-tight tracking-wide">{{ v.password }}</p>
                </div>
              </div>

              <!-- Footer -->
              <p class="text-[9px] text-gray-400 mt-2">{{ formatDate(v.createdAt) }}</p>
            </div>
          </div>

          <!-- Scissor icon at corner when cut lines enabled -->
          <div v-if="showCutLines" class="print:block hidden absolute -top-1.5 -left-1.5 text-gray-300">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  /* Hide everything except print area */
  body > * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    padding: 8px !important;
  }
  /* Remove app chrome */
  aside, header, nav { display: none !important; }
}
</style>
