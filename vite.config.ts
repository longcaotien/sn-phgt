import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  base: "./", // relative paths so it works on GitHub Pages (/sn-phgt/)
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true, // cho phép preview host của sandbox (.e2b.app)
  },
  preview: { host: true, allowedHosts: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: false,
    assetsInlineLimit: 2048,
    // Tách vendor + tách chunk Chương II / Sinh nhật:
    // - Lần đầu mở trang chỉ tải React + framer-motion + màn hình Hero.
    // - Chương II & Thế giới sinh nhật tải riêng khi người chơi bước vào.
    // - File có hash nội dung => trình duyệt cache vĩnh viễn, lần sau mở gần như tức thì.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) {
            return "vendor-motion";
          }
          if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("canvas-confetti")) return "vendor-confetti";
          return "vendor";
        },
      },
    },
  },
});
