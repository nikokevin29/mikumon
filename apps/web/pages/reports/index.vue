<script setup lang="ts">
import type { EChartsOption } from 'echarts'

const { $api } = useApi()

// Filter state
const today = new Date().toISOString().slice(0, 10)
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const startDate = ref(thirtyDaysAgo)
const endDate = ref(today)
const groupBy = ref<'day' | 'week' | 'month'>('day')

const groupByOptions = [
  { label: 'Per Hari', value: 'day' },
  { label: 'Per Minggu', value: 'week' },
  { label: 'Per Bulan', value: 'month' },
]

const queryKey = computed(() => `${startDate.value}-${endDate.value}-${groupBy.value}`)

const { data: report, pending, refresh } = await useAsyncData(
  'sales-report',
  () =>
    $api<{
      success: true
      data: {
        summary: { totalRevenue: string; totalCount: number; startDate: string; endDate: string }
        chart: { period: string; total: number; count: number }[]
        byRouter: { routerId: number; routerName: string; total: number; count: number }[]
      }
    }>(
      `/reports/sales?start=${startDate.value}&end=${endDate.value}&group_by=${groupBy.value}`,
    ),
  { watch: [queryKey] },
)

const summary = computed(() => report.value?.data.summary)
const chartData = computed(() => report.value?.data.chart ?? [])
const byRouter = computed(() => report.value?.data.byRouter ?? [])

function formatPeriod(period: string) {
  const d = new Date(period)
  if (groupBy.value === 'month')
    return d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
  if (groupBy.value === 'week')
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

function formatRp(val: number | string) {
  return `Rp ${Number(val).toLocaleString('id-ID')}`
}

const chartOption = computed<EChartsOption>(() => ({
  tooltip: {
    trigger: 'axis',
    formatter: (params: any) => {
      const p = Array.isArray(params) ? params[0] : params
      return `${p.name}<br/>
        <b>${formatRp(p.value)}</b><br/>
        ${p.data?.count ?? 0} transaksi`
    },
  },
  grid: { left: 60, right: 20, top: 20, bottom: 40 },
  xAxis: {
    type: 'category',
    data: chartData.value.map((r) => formatPeriod(r.period)),
    axisLabel: { rotate: chartData.value.length > 14 ? 45 : 0, fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    axisLabel: {
      formatter: (v: number) =>
        v >= 1_000_000
          ? `${(v / 1_000_000).toFixed(1)}jt`
          : v >= 1000
            ? `${(v / 1000).toFixed(0)}rb`
            : String(v),
    },
  },
  series: [
    {
      name: 'Revenue',
      type: 'bar',
      data: chartData.value.map((r) => ({ value: r.total, count: r.count })),
      itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
    },
  ],
}))

const routerTableColumns = [
  { key: 'routerName', label: 'Router' },
  { key: 'count', label: 'Transaksi' },
  { key: 'total', label: 'Revenue' },
]
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Laporan Penjualan</h1>
        <p class="text-sm text-gray-500 mt-1">Analisa revenue voucher hotspot</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-6">
      <UFormGroup label="Dari">
        <UInput v-model="startDate" type="date" />
      </UFormGroup>
      <UFormGroup label="Sampai">
        <UInput v-model="endDate" type="date" />
      </UFormGroup>
      <UFormGroup label="Kelompokkan">
        <USelect
          v-model="groupBy"
          :options="groupByOptions"
          value-attribute="value"
          option-attribute="label"
          class="w-36"
        />
      </UFormGroup>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <UCard>
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-lg bg-green-50 dark:bg-green-950">
            <UIcon name="i-heroicons-banknotes" class="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Total Revenue</p>
            <p v-if="pending" class="text-2xl font-bold">...</p>
            <p v-else class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ formatRp(summary?.totalRevenue ?? 0) }}
            </p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
            <UIcon name="i-heroicons-ticket" class="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Total Transaksi</p>
            <p v-if="pending" class="text-2xl font-bold">...</p>
            <p v-else class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ summary?.totalCount.toLocaleString('id-ID') ?? 0 }}
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Chart -->
    <UCard class="mb-6">
      <template #header>
        <p class="font-semibold">Revenue per Periode</p>
      </template>

      <div v-if="pending" class="flex items-center justify-center h-64">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
      </div>

      <div v-else-if="!chartData.length" class="flex flex-col items-center justify-center h-64 text-gray-400">
        <UIcon name="i-heroicons-chart-bar" class="w-12 h-12 mb-2" />
        <p>Tidak ada data di rentang waktu ini</p>
      </div>

      <ClientOnly v-else>
        <VChart :option="chartOption" style="height: 300px" autoresize />
      </ClientOnly>
    </UCard>

    <!-- Per-router breakdown -->
    <UCard v-if="byRouter.length">
      <template #header>
        <p class="font-semibold">Breakdown per Router</p>
      </template>

      <UTable :columns="routerTableColumns" :rows="byRouter">
        <template #total-data="{ row }">
          <span class="font-medium">{{ formatRp(row.total) }}</span>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
