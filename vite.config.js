import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/letras': {
        target: 'https://argentinadatos.com',
        changeOrigin: true,
        rewrite: () => '/v1/finanzas/letras',
      },
      '/api/precios': {
        target: 'https://data912.com',
        changeOrigin: true,
        rewrite: () => '/live/arg_notes',
      },
      '/api/dolar-mep': {
        target: 'https://dolarapi.com',
        changeOrigin: true,
        rewrite: () => '/v1/dolares/bolsa',
      },
      '/api/dolar-ccl': {
        target: 'https://dolarapi.com',
        changeOrigin: true,
        rewrite: () => '/v1/dolares/contadoconliqui',
      },
    },
  },
})
