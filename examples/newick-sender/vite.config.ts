import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  server: { host: "127.0.0.1", port: 5181, strictPort: true },
  preview: { host: "127.0.0.1", port: 5181, strictPort: true },
});
