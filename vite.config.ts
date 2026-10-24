import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import musicTitle from './netlify/functions/music-title.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), {
    name: 'local-music-title',
    configureServer(server) {
      server.middlewares.use('/.netlify/functions/music-title', async (request, response) => {
        const result = await musicTitle(new Request(`http://localhost/${request.url ?? ''}`, { method: request.method }))
        response.statusCode = result.status
        response.setHeader('Content-Type', 'application/json')
        response.end(await result.text())
      })
    },
  }],
})
