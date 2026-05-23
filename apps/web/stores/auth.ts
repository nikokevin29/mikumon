import { defineStore } from 'pinia'

interface AdminUser {
  id: number
  email: string
  name: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AdminUser | null>(null)
  const isAuthenticated = computed(() => !!user.value)

  async function login(email: string, password: string) {
    const { $api } = useApi()
    const res = await $api<{ success: true; data: { user: AdminUser } }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = res.data.user
    return res
  }

  async function logout() {
    const { $api } = useApi()
    try {
      await $api('/auth/logout', { method: 'POST' })
    } catch {}
    user.value = null
    await navigateTo('/login')
  }

  async function fetchMe() {
    const { $api } = useApi()
    try {
      const res = await $api<{ success: true; data: AdminUser }>('/auth/me')
      user.value = res.data
    } catch {
      user.value = null
    }
  }

  return { user, isAuthenticated, login, logout, fetchMe }
})
