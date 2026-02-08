import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  nitro: {
    publicAssets: [
      { baseURL: '/models/mediapipe', dir: 'models/mediapipe' }
    ]
  },
  vite: {
    plugins: [
      tailwindcss(),
      tsconfigPaths()
    ],
  },
  modules: ['shadcn-nuxt'],
  shadcn: {
    prefix: '',
    componentDir: '@/components/ui'
  }
})