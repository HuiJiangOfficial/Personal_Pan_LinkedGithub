import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // 若单独运行 Vite、另开 wrangler pages dev 监听 8788，可设置环境变量 VITE_PROXY_API=1
    proxy:
      process.env.VITE_PROXY_API === '1'
        ? {
            '/api': {
              target: 'http://127.0.0.1:8788',
              changeOrigin: true,
            },
          }
        : undefined,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
