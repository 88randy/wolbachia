import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { DEFAULT_TILES } from "./src/quadrants/geography/map-source.ts";
/** Restrict map requests to the build's configured HTTPS origin, never CSP wildcards. */
export function mapSecurityHeaders(template: string, tileUrl = DEFAULT_TILES): string {
  const configured = tileUrl.trim() || DEFAULT_TILES;
  const parsed = new URL(configured, "https://same-origin.invalid");
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    configured.includes("\\") ||
    configured.startsWith("//")
  )
    throw new Error("Invalid map tile URL");
  const origin = configured.startsWith("/") ? "" : parsed.origin;
  return template.replaceAll("https://tile.openstreetmap.org", origin).replaceAll(/ +;/g, ";");
}
/** Read Vite's resolved environment so --mode and Docker empty/default values cannot drift from the bundle. */
export function mapSecurityPlugin(): Plugin {
  let tileUrl = DEFAULT_TILES;
  return {
    name: "map-security-headers",
    configResolved(config) {
      const value: unknown = config.env["VITE_MAP_TILES_URL"];
      tileUrl = typeof value === "string" ? value : DEFAULT_TILES;
    },
    generateBundle() {
      const template = readFileSync(
        join(import.meta.dirname, "nginx/security-headers.conf"),
        "utf8",
      );
      this.emitFile({
        type: "asset",
        fileName: "security-headers.conf",
        source: mapSecurityHeaders(template, tileUrl),
      });
    },
  };
}
