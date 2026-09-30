import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* ---------------------------------------------------------------------------
   camelaml-app
   The application code is split across files that share one scope (the
   engine, the case library and the views all call each other freely). This
   plugin compiles them, in the order declared in src/app/manifest.json, into a
   single ES module exposed as `virtual:camelaml-app`. Any file may contain
   `import` statements; they are hoisted as usual.
   --------------------------------------------------------------------------- */
function camelamlApp() {
  const VIRTUAL = "virtual:camelaml-app";
  const RESOLVED = "\0" + VIRTUAL;
  const root = resolve(__dirname, "src/app");
  const files = () => JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8")).files;
  return {
    name: "camelaml-app",
    resolveId(id) { if (id === VIRTUAL) return RESOLVED; },
    load(id) {
      if (id !== RESOLVED) return;
      this.addWatchFile(resolve(root, "manifest.json"));
      return files().map(f => {
        const p = resolve(root, f);
        this.addWatchFile(p);
        return "/* ===== " + f + " ===== */\n" + readFileSync(p, "utf8");
      }).join("\n");
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(root)) {
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
        return [];
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    plugins: [
      camelamlApp(),
      single
        ? viteSingleFile()
        : VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["brand/*.png"],
            manifest: {
              name: "CamelAML",
              short_name: "CamelAML",
              description: "Master AML. Think like an analyst. A transaction monitoring and AML investigation simulator.",
              theme_color: "#0B0B0C",
              background_color: "#F7F6F2",
              display: "standalone",
              start_url: "/",
              scope: "/",
              icons: [
                { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
                { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
                { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
              ]
            },
            workbox: {
              globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
              navigateFallback: "/index.html",
              maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
            }
          })
    ],
    resolve: single ? { alias: { "virtual:pwa-register": resolve(__dirname, "src/pwa-stub.js") } } : {},
    build: {
      outDir: single ? "dist-single" : "dist",
      chunkSizeWarningLimit: 1600,
      assetsInlineLimit: single ? 100000000 : 4096
    }
  };
});
