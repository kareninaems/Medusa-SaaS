import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    hmr: import.meta.env?.VITE_HMR_HOST
      ? {
          protocol: "wss",
          host: import.meta.env.VITE_HMR_HOST,
          clientPort: 443,
        }
      : process.env.VITE_HMR_HOST
      ? {
          protocol: "wss",
          host: process.env.VITE_HMR_HOST,
          clientPort: 443,
        }
      : true,
  },
})
