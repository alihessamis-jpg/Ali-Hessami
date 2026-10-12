import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Only the app shell (JS/CSS/fonts/the one local image) is
      // precached here -- Supabase API/storage calls are left alone so
      // the app's own offline cache (src/lib/offlineCache.ts) decides what
      // Academy data to serve when there's no network, instead of the
      // service worker silently freezing stale API responses.
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallback: '/index.html',
      },
      includeAssets: ['kidneys-logo.png'],
      manifest: {
        name: 'Nephron — Pediatric Nephrology Workspace',
        short_name: 'Nephron',
        description: 'Pediatric nephrology clinical workspace and study library.',
        start_url: '/',
        display: 'standalone',
        background_color: '#eef3fb',
        theme_color: '#12357a',
        icons: [
          { src: '/kidneys-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/kidneys-logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/kidneys-logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
