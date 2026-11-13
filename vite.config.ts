import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const build = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(build),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": a new version waits for the user to tap Update. It never
      // reloads on its own, so a workout is never interrupted.
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Garage Gym',
        short_name: 'Garage Gym',
        description: 'Workout tracker for our home gym',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        background_color: '#0D0F11',
        theme_color: '#0D0F11',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,jpg}'],
        // Exercise pictures are precached so the library works offline.
        maximumFileSizeToCacheInBytes: 3_000_000,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Adds the push notification handlers to the generated service worker.
        importScripts: ['push-sw.js'],
        globIgnores: ['push-sw.js', 'splash/**'],
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
