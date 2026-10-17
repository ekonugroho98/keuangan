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
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Karaya — Wealth Ledger',
        short_name: 'Karaya',
        description: 'Duit Lu, Kendali Lu — Aplikasi keuangan pribadi yang cerdas',
        start_url: '/',
        display: 'standalone',
        background_color: '#0d1f1c',
        theme_color: '#60fcc6',
        orientation: 'any',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Fase 4 (07-frontend.md §6): data domain sekarang lewat apps/api (VITE_API_BASE_URL),
        // bukan *.supabase.co lagi — dan TIDAK di-cache sama sekali (data keuangan harus selalu
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
