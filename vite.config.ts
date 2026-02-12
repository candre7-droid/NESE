
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // Aquesta definició és crucial per a Vercel. 
    // Vite substituirà process.env.API_KEY pel valor real durant el build.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "")
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) {
              return 'vendor-react';
            }
            if (id.includes('@google/genai')) {
              return 'vendor-gemini';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
