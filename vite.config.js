import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "kevin-storybook",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: "story-app/main.jsx",
      output: {
        entryFileNames: "storybook.js",
        assetFileNames: "storybook.[ext]"
      }
    }
  }
});
