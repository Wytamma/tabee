import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
} as const;

/**
 * The app document is cross-origin isolated; the exchange page must not be.
 * Static hosts need the same split as a path rule; this middleware is the
 * local equivalent for `vite` and `vite preview`.
 */
function perPathIsolationHeaders(): Plugin {
  const middleware = (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): void => {
    const path = (req.url ?? "/").split("?")[0] ?? "/";
    if (!path.endsWith("/sidecar.html")) {
      for (const [name, value] of Object.entries(ISOLATION_HEADERS)) {
        res.setHeader(name, value);
      }
    }
    next();
  };

  return {
    name: "tabee-per-path-isolation-headers",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [perPathIsolationHeaders()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        sidecar: fileURLToPath(new URL("sidecar.html", import.meta.url)),
      },
    },
  },
  server: { host: "127.0.0.1", port: 5183, strictPort: true },
  preview: { host: "127.0.0.1", port: 5183, strictPort: true },
});
