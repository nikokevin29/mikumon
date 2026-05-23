<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const voucherStore = useVoucherStore()
const router = useRouter()

const vouchers = computed(() => voucherStore.lastGenerated)
const profileName = computed(() => voucherStore.profileName)

onMounted(() => {
  if (!vouchers.value.length) {
    router.replace('/hotspot')
  }
})

function print() {
  window.print()
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { dateStyle: 'short' })
}

onBeforeUnmount(() => {
  voucherStore.clear()
})
</script>

<template>
  <div>
    <!-- Screen controls (hidden on print) -->
    <div class="print:hidden p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Cetak Voucher</h1>
          <p class="text-sm text-gray-500 mt-1">
            {{ vouchers.length }} voucher — Profile: {{ profileName }}
          </p>
        </div>
        <div class="flex gap-2">
          <UButton color="gray" variant="ghost" icon="i-heroicons-arrow-left" to="/hotspot">
            Kembali
          </UButton>
          <UButton icon="i-heroicons-printer" @click="print"> Cetak </UButton>
        </div>
      </div>

      <UAlert
        color="yellow"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        description="Data voucher hanya tersedia di halaman ini. Pastikan mencetak atau menyimpan sebelum meninggalkan halaman."
        class="mb-4"
      />
    </div>

    <!-- Voucher grid (visible on screen & print) -->
    <div class="px-6 pb-6 print:p-4">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 print:grid-cols-3 print:gap-2">
        <div
          v-for="v in vouchers"
          :key="v.id"
          class="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center print:border-gray-400 print:rounded"
        >
          <p class="text-xs font-bold text-primary-600 mb-1">MIKUMON</p>
          <p class="text-xs text-gray-500 mb-2">{{ profileName }}</p>
          <div class="bg-gray-50 rounded p-2 mb-2 print:bg-gray-100">
            <p class="text-xs text-gray-500">Username</p>
            <p class="font-mono font-bold text-sm text-gray-900">{{ v.username }}</p>
          </div>
          <div class="bg-gray-50 rounded p-2 print:bg-gray-100">
            <p class="text-xs text-gray-500">Password</p>
            <p class="font-mono font-bold text-sm text-gray-900">{{ v.password }}</p>
          </div>
          <p class="text-xs text-gray-400 mt-2">{{ formatDate(v.createdAt) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  body * {
    visibility: hidden;
  }
  .print\:p-4,
  .print\:p-4 * {
    visibility: visible;
  }
  .print\:p-4 {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
  }
}
</style>
