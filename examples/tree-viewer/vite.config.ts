import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  server: { host: "localhost", port: 5182, strictPort: true },
  preview: { host: "localhost", port: 5182, strictPort: true },
});
