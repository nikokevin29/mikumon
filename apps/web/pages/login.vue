<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  if (!form.email || !form.password) {
    errorMsg.value = 'Email dan password wajib diisi'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    await authStore.login(form.email, form.password)
    toast.add({ title: 'Login berhasil', color: 'green', icon: 'i-heroicons-check-circle' })
    await router.push('/')
  } catch (e: any) {
    const msg = e?.data?.error?.message ?? 'Email atau password salah'
    errorMsg.value = msg
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-sm">
    <template #header>
      <div class="text-center">
        <p class="text-2xl font-bold text-primary-600">Mikumon</p>
        <p class="text-sm text-gray-500 mt-1">ISP Management Platform</p>
      </div>
    </template>

    <form class="space-y-4" @submit.prevent="handleLogin">
      <UAlert v-if="errorMsg" color="red" variant="soft" :description="errorMsg" />

      <UFormGroup label="Email">
        <UInput
          v-model="form.email"
          type="email"
          placeholder="admin@mikumon.local"
          icon="i-heroicons-envelope"
          autocomplete="email"
        />
      </UFormGroup>

      <UFormGroup label="Password">
        <UInput
          v-model="form.password"
          type="password"
          placeholder="••••••••"
          icon="i-heroicons-lock-closed"
          autocomplete="current-password"
        />
      </UFormGroup>

      <UButton type="submit" block :loading="loading" class="mt-2"> Login </UButton>
    </form>
  </UCard>
</template>
