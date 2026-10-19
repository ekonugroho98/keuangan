import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import { ThemeProvider } from './i18n/ThemeContext.jsx'

// Default query client (07-frontend.md §6): staleTime pendek untuk list, cache tidak disimpan
// ke localStorage (data keuangan, selalu fresh dari apps/api saat sesi baru).
//
// refetchOnWindowFocus + refetchInterval (keduanya dihormati staleTime 30s, jadi tidak nambah
// request kalau datanya masih fresh): ditambah 2026-10-07 karena agent eksternal (Hermes) bisa
// bikin transaksi lewat API tanpa app ini tahu — tanpa ini, user yang app-nya sudah kebuka harus
// hard-reload manual tiap kali mau lihat transaksi baru yang dicatat dari luar. refetchOnWindowFocus
// nangkep kasus "switch balik ke tab/app setelah chat ke Hermes"; refetchInterval nangkep kasus
// app tetap kebuka visible di layar (gak pernah blur) sementara Hermes nyatet di background.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
    },
  },
})

if ('serviceWorker' in navigator) {
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
