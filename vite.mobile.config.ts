import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "mobile",
  publicDir: "../public",
  define: { "import.meta.env.VITE_NATIVE_APP": JSON.stringify("true") },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [tailwindcss(), viteReact()],
  build: { outDir: "../dist/mobile", emptyOutDir: true, target: "es2022" },
  server: { host: "0.0.0.0", port: 8081 },
});
