import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// ▼▼▼ START: 匯入 nodePolyfills ▼▼▼
import { nodePolyfills } from 'vite-plugin-node-polyfills';
// ▲▲▲ END: 匯入 nodePolyfills ▼▲▲

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      // ▼▼▼ START: 在 plugins 陣列中使用 nodePolyfills() ▼▼▼
      plugins: [
        react(),
        nodePolyfills({
          // 您可以在這裡設定選項，通常預設即可
          // 例如，如果您確定只需要 crypto 和 buffer:
          // include: ['crypto', 'buffer'], 
        })
      ],
      // ▲▲▲ END: 在 plugins 陣列中使用 nodePolyfills() ▼▲▲
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
