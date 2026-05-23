export const useApi = () => {
  const config = useRuntimeConfig()
  const route = useRoute()

  const $api = $fetch.create({
    baseURL: config.public.apiBase as string,
    credentials: 'include',
    onResponseError({ response }) {
      if (response.status === 401 && route.path !== '/login') {
        navigateTo('/login')
      }
    },
  })

  return { $api }
}
