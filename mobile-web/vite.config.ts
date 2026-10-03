import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // GitHub Pages serves the app under /<repo>/; CI sets VITE_BASE accordingly.
  const base = env.VITE_BASE || '/'

  return {
    base,
    define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: '세아온 근태관리',
          short_name: '근태관리',
          description: '세아온 모바일 근태관리 서비스',
          lang: 'ko',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#ffffff',
          theme_color: '#1F4E8C',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        },
        devOptions: { enabled: false },
      }),
    ],
  }
})
