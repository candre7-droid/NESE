
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Augmentem el límit d'avís de 500kb a 2000kb per silenciar l'avís de Vercel
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Optimitzem la generació de fitxers separant les llibreries de 'node_modules'
        // Això ajuda a que el navegador no hagi de carregar un sol fitxer gegant
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
