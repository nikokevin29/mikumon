export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@pinia/nuxt', '@vueuse/nuxt'],
  css: ['~/assets/css/main.css'],
  experimental: {
    appManifest: false,
    viteEnvironmentApi: true,
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:3001/api',
      wsBase: process.env.NUXT_PUBLIC_WS_BASE ?? 'ws://localhost:3001',
    },
  },
  nitro: {
    preset: 'static',
    output: {
      publicDir: '.output/public',
    },
  },
  typescript: {
    strict: true,
  },
})
