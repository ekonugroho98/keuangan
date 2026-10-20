import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      '/v1': {
        target: 'https://karaya-api-v1.vercel.app',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          ocr: ['tesseract.js'],
          docx: ['docx'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'logo-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Keluarga Berkembang: Berkembang Bersama dalam Kehangatan',
        short_name: 'Keluarga Berkembang',
        description: 'Berkembang Bersama dalam Kehangatan. Aplikasi keuangan rumah tangga, belanja dapur, stok kulkas, dan asisten AI keluarga.',
        start_url: '/',
        display: 'standalone',
        background_color: '#FFFDF9',
        theme_color: '#3F5142',
        orientation: 'portrait',
        icons: [
          { src: '/logo-icon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/logo-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/logo-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        globIgnores: ['**/screenshots/**', '**/*.apk'],
        // Fase 4 (07-frontend.md §6): data domain sekarang lewat apps/api (VITE_API_BASE_URL),
        // bukan *.supabase.co lagi, dan TIDAK di-cache sama sekali (data keuangan harus selalu
        // fresh, bukan NetworkFirst dengan fallback cache). Supabase client di apps/web hanya
        // dipakai untuk auth (login/refresh token), jadi pattern dipersempit ke /auth/v1/ saja.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-auth-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 5 },
            },
          },
        ],
      },
    }),
  ],
})
