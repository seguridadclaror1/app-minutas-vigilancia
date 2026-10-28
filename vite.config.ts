import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  base: isGitHubActions ? '/app-minutas-vigilancia/' : '/',
  server: {
    host: true,
    port: 5173,
    allowedHosts: true
  }
})
