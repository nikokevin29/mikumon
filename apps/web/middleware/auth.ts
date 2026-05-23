export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const authStore = useAuthStore()

  if (!authStore.isAuthenticated) {
    await authStore.fetchMe()
  }

  if (!authStore.isAuthenticated) {
    return navigateTo('/login')
  }
})
