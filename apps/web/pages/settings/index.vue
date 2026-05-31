<script setup lang="ts">
const { $api } = useApi()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const testing = ref(false)

const form = reactive({
  botToken: '',
  chatId: '',
  enabled: false,
  notifyFirstUse: true,
  notifyRouterOffline: true,
})

async function load() {
  loading.value = true
  try {
    const res = await $api<{ data: typeof form }>('/settings/telegram')
    Object.assign(form, res.data)
  } catch {
    toast.add({ title: 'Gagal memuat pengaturan', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await $api('/settings/telegram', { method: 'PUT', body: { ...form } })
    toast.add({ title: 'Pengaturan Telegram disimpan', color: 'green', icon: 'i-heroicons-check-circle' })
    await load()
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal menyimpan', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    saving.value = false
  }
}

async function testNotification() {
  testing.value = true
  try {
    await $api('/settings/telegram/test', { method: 'POST' })
    toast.add({ title: 'Test notifikasi berhasil dikirim!', color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e: any) {
    toast.add({ title: e?.data?.error?.message ?? 'Gagal mengirim test', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    testing.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="p-6 max-w-2xl">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan</h1>
      <p class="text-sm text-gray-500 mt-1">Konfigurasi notifikasi dan sistem</p>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p class="font-semibold">Notifikasi Telegram</p>
            <p class="text-xs text-gray-500">Kirim notifikasi ke bot Telegram saat event tertentu terjadi</p>
          </div>
          <div class="ml-auto">
            <UToggle v-model="form.enabled" />
          </div>
        </div>
      </template>

      <div v-if="loading" class="space-y-4">
        <USkeleton v-for="i in 4" :key="i" class="h-10" />
      </div>

      <div v-else class="space-y-5">
        <UAlert
          color="blue"
          variant="soft"
          icon="i-heroicons-information-circle"
          class="text-sm"
        >
          <template #description>
            Buat bot Telegram via <strong>@BotFather</strong>, lalu dapatkan Chat ID dengan mengirim pesan ke bot dan cek
            <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>
          </template>
        </UAlert>

        <UFormGroup label="Bot Token">
          <UInput
            v-model="form.botToken"
            placeholder="1234567890:ABCdefGHI..."
            :disabled="!form.enabled"
          />
        </UFormGroup>

        <UFormGroup label="Chat ID">
          <UInput
            v-model="form.chatId"
            placeholder="-100123456789"
            :disabled="!form.enabled"
          />
        </UFormGroup>

        <div class="border border-gray-100 dark:border-gray-800 rounded-xl p-4 space-y-3">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Event yang dinotifikasi</p>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-700 dark:text-gray-300">Voucher diaktifkan (first-use)</p>
                <p class="text-xs text-gray-400">Notif ketika user pertama kali login ke hotspot</p>
              </div>
              <UToggle v-model="form.notifyFirstUse" :disabled="!form.enabled" />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-700 dark:text-gray-300">Router offline</p>
                <p class="text-xs text-gray-400">Notif ketika sync gagal menjangkau router</p>
              </div>
              <UToggle v-model="form.notifyRouterOffline" :disabled="!form.enabled" />
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between">
          <UButton
            variant="ghost"
            color="gray"
            icon="i-heroicons-paper-airplane"
            :loading="testing"
            :disabled="!form.enabled || !form.botToken || !form.chatId"
            @click="testNotification"
          >
            Kirim Test
          </UButton>
          <UButton :loading="saving" icon="i-heroicons-check" @click="save">
            Simpan Pengaturan
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
