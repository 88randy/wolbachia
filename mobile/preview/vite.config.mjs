import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const previewRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(previewRoot, "../..");

// Browser renderer only. Metro never reads this config or bundles this directory.
export default defineConfig({
  root: previewRoot,
  resolve: {
    alias: [
      {
        find: /^.*\/navigation\/NavigationProvider\.tsx$/,
        replacement: path.join(previewRoot, "release-preview-runtime.js"),
      },
      {
        find: /^.*\/sync\/use-sync\.ts$/,
        replacement: path.join(previewRoot, "release-preview-runtime.js"),
      },
      {
        find: /^react-native-svg$/,
        replacement: path.join(
          repositoryRoot,
          "node_modules/react-native-svg/lib/module/elements.web.js",
        ),
      },
      ...Object.entries({
        "./NativeSafeAreaProvider": path.join(
          repositoryRoot,
          "node_modules/react-native-safe-area-context/lib/module/NativeSafeAreaProvider.web.js",
        ),
        "@react-native/assets-registry/registry": path.join(
          repositoryRoot,
          "node_modules/react-native-web/dist/modules/AssetRegistry/index.js",
        ),
        "react-native": path.join(previewRoot, "native-renderer.jsx"),
        "react-native-safe-area-context": path.join(
          repositoryRoot,
          "node_modules/react-native-safe-area-context/lib/module/SafeAreaContext.js",
        ),
        react: path.join(repositoryRoot, "node_modules/react"),
        "react-dom": path.join(repositoryRoot, "node_modules/react-dom"),
      }).map(([find, replacement]) => ({ find, replacement })),
    ],
    extensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".jsx", ".js", ".json"],
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    exclude: ["react-native-safe-area-context"],
    include: ["react-native-svg"],
  },
  server: { host: "127.0.0.1", port: 4203, strictPort: true, fs: { allow: [repositoryRoot] } },
  build: { outDir: "../dist/style-preview", emptyOutDir: true },
});
