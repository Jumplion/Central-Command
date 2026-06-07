import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "src/shared"),
        "@main": resolve(__dirname, "src/main"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "src/shared"),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    plugins: [react()],
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "src/shared"),
        "@renderer": resolve(__dirname, "src/renderer/src"),
        "@widgets": resolve(__dirname, "src/widgets"),
      },
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, "src/renderer/index.html"),
        output: {
          manualChunks: (id) => {
            if (id.includes("react-dom") || id.includes("/react/"))
              return "vendor-react";
            if (id.includes("react-grid-layout")) return "vendor-grid";
            if (id.includes("zustand")) return "vendor-state";
          },
        },
      },
    },
  },
});
