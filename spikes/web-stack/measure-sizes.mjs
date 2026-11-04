// Gzip size of each library in isolation (tree-shaken, minified), imported the way the PoC imports it.
import { build } from "vite";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const entries = {
  "react + react-dom": `import {createRoot} from "react-dom/client"; import {createElement} from "react"; createRoot(document.body).render(createElement("div"));`,
  "@tanstack/react-router": `import {createRouter,createRootRoute,RouterProvider,createRoute} from "@tanstack/react-router"; console.log(createRouter,createRootRoute,RouterProvider,createRoute);`,
  "@tanstack/react-query": `import {QueryClient,QueryClientProvider,useQuery} from "@tanstack/react-query"; console.log(QueryClient,QueryClientProvider,useQuery);`,
  "@tanstack/react-table": `import {useTable,tableFeatures,createColumnHelper} from "@tanstack/react-table"; console.log(useTable,tableFeatures,createColumnHelper);`,
  "recharts (BarChart)": `import {BarChart,Bar,XAxis,YAxis,CartesianGrid} from "recharts"; console.log(BarChart,Bar,XAxis,YAxis,CartesianGrid);`,
  "i18next + react-i18next": `import i18n from "i18next"; import {initReactI18next,useTranslation} from "react-i18next"; console.log(i18n,initReactI18next,useTranslation);`,
  "react-hook-form + resolver + zod": `import {useForm} from "react-hook-form"; import {zodResolver} from "@hookform/resolvers/zod"; import {z} from "zod"; console.log(useForm,zodResolver,z.object({a:z.number()}));`,
  "maplibre-gl + react-map-gl (lazy)": `import Map from "react-map-gl/maplibre"; console.log(Map);`,
};

const dir = mkdtempSync(join(process.cwd(), ".size-")); // inside the project so bare imports resolve
for (const [name, code] of Object.entries(entries)) {
  const file = join(dir, "entry.mjs");
  writeFileSync(file, code);
  const out = await build({
    logLevel: "silent",
    configFile: false,
    root: process.cwd(),
    build: { write: false, minify: true, lib: { entry: file, formats: ["es"], fileName: "x" }, rollupOptions: { external: [] } },
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const chunks = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output).filter((c) => c.type === "chunk");
  const gz = chunks.reduce((n, c) => n + gzipSync(c.code).length, 0);
  console.log(`${name.padEnd(36)} ${(gz / 1024).toFixed(1)} kB gzip`);
}
rmSync(dir, { recursive: true, force: true });
