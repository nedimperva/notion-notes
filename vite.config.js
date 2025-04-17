import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { networkInterfaces } from 'os'
import { VitePWA } from 'vite-plugin-pwa'

// Get the local IP address
const getLocalIP = () => {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const localIP = getLocalIP();

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({ 
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'robots.txt'],
      manifest: {
        name: 'Thought Base',
        short_name: 'ThoughtBase',
        description: 'A note-taking app with Notion integration',
        theme_color: '#2DD4BF',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'New Note',
            short_name: 'New',
            description: 'Create a new note',
            url: '/new',
            icons: [{ src: '/icons/icon.svg', sizes: 'any' }]
          }
        ]
      }
    })
  ],
  server: {
    host: true, // Listen on all addresses
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    },
    watch: {
      usePolling: true, // Enable polling for network drives and WSL
    },
    hmr: {
      host: localIP,
      protocol: 'ws',
    }
  },
  preview: {
    host: true,
    port: 5173
  }
}))
