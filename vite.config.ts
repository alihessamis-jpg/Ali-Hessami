import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The app shell is precached so Nephron opens with no network. Supabase
      // API data is NOT cached here -- src/lib/offlineFetch.ts does that
      // network-first in IndexedDB, so online you always get fresh data.
      // Stored files (images/PDFs) and fonts are cached at runtime below.
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webp,woff2,json}'],
        navigateFallback: '/index.html',
        // the three.js / charts bundles are bigger than workbox's 2 MB
        // default -- without this they'd be skipped and the app couldn't
        // start offline
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        runtimeCaching: [
          // Google Fonts (Plus Jakarta Sans / Vazirmatn) so text looks the same offline
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Stored files (imaging, PDFs, chapter figures, attachments), opened
          // through short-lived signed URLs. The token is stripped from the
          // cache key so the saved copy is found again offline even though
          // every signed URL is different. Paths are unique per upload, so a
          // saved file never goes stale.
          {
            urlPattern: /^https:\/\/[^/]+\/storage\/v1\/object\/(sign|public)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'nephron-files',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 3000, purgeOnQuotaError: true },
              plugins: [
                {
                  // <img>/<a> loads are "no-cors" and would be stored as
                  // opaque responses, which can't be read back by fetch()
                  // (the offline viewer) and bloat storage. Supabase Storage
                  // sends CORS headers, so fetch them as normal CORS requests.
                  requestWillFetch: async ({ request }) =>
                    request.mode === 'no-cors' ? new Request(request.url, { mode: 'cors', credentials: 'omit' }) : request,
                  cacheKeyWillBeUsed: async ({ request }) =>
                    request.url.replace(/([?&])token=[^&]*&?/, '$1').replace(/[?&]$/, ''),
                },
              ],
            },
          },
        ],
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
