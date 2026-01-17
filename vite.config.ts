import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env for the Google GenAI SDK usage in the code
      'process.env': {
        API_KEY: env.API_KEY
      }
    },
    build: {
      outDir: 'dist',
    }
  };
});