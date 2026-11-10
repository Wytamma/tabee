import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  server: { host: "localhost", port: 5186, strictPort: true },
  preview: { host: "localhost", port: 5186, strictPort: true },
});
