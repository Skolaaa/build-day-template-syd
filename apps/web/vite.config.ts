import { createRequire } from "node:module";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const config = defineConfig({
  environments: {
    ssr: {
      optimizeDeps: {
        rolldownOptions: {
          plugins: [punycodeTrailingSlash()],
        },
      },
    },
  },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  resolve: { tsconfigPaths: true },
});

// tr46 (a MongoDB driver dependency) does `require("punycode/")`, with the
// trailing slash to reach the npm package instead of Node's builtin. The
// Worker dependency optimizer can't resolve that spelling and leaves it as an
// external `require`, which the Worker runtime doesn't have. Resolve it to the
// package's ES module instead. See cloudflare/workers-sdk#11751.
function punycodeTrailingSlash(): Plugin {
  return {
    name: "punycode-trailing-slash",
    resolveId(id, importer) {
      if (id !== "punycode/" || !importer) {
        return null;
      }
      return createRequire(importer).resolve("punycode/punycode.es6.js");
    },
  };
}

export default config;
