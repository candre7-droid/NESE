
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // Aquesta definició és crucial per a Vercel i altres entorns. 
    // Vite substituirà process.env per les variables d'entorn reals.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ""),
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || "")
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
