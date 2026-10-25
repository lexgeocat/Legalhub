import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  plugins: [react()],
  build: { target: 'esnext' },
  optimizeDeps: { rolldownOptions: { transform: { target: 'esnext' } } },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      '/api-tsj': {
        target: 'https://apigenesis.tsj.bo',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-tsj/, ''),
        headers: {
          Origin: 'https://genesis.tsj.bo',
          Referer: 'https://genesis.tsj.bo/',
        },
      },
    },
  },
}));
