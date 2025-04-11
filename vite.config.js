import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
// import { VitePWA } from 'vite-plugin-pwa' // Commented out for testing

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    /* // Commented out for testing
    VitePWA({ 
      registerType: 'autoUpdate',
      manifest: {
        name: 'NoteSync PWA',
        short_name: 'NoteSync',
        description: 'Note synchronization PWA with Notion',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      } 
    })
    */
  ],
})
