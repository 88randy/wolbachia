import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { mapSecurityHeaders } from "../../../map-security.config";
import { readMapSource } from "./map-source";
const template = readFileSync(
  join(import.meta.dirname, "../../../nginx/security-headers.conf"),
  "utf8",
);
describe("map provider configuration and strict CSP", () => {
  test("allows only the configured origin for map requests and blob workers", () => {
    const headers = mapSecurityHeaders(template, "https://tiles.example.org/{z}/{x}/{y}.png");
    expect(headers).toContain("connect-src 'self' https://tiles.example.org;");
    expect(headers).toContain("img-src 'self' data: https://tiles.example.org;");
    expect(headers).toContain("worker-src 'self' blob:;");
    expect(headers).not.toContain("tile.openstreetmap.org");
    expect(headers).not.toContain("https:;");
    expect(headers).toContain('Referrer-Policy "strict-origin"');
    expect(headers).toContain("script-src 'self';");
  });
  test("an empty Docker build argument uses the same OSM default as the client", () => {
    expect(mapSecurityHeaders(template, "")).toContain(
      "connect-src 'self' https://tile.openstreetmap.org;",
    );
  });
  test("requires custom attribution and rejects unsafe or incomplete tile templates", () => {
    for (const url of [
      "http://tiles.example.org/{z}/{x}/{y}",
      "https://user:pw@tiles.example.org/style.json",
      "https://tiles.example.org/{x}",
      "//tiles.example.org/style.json",
    ]) {
      expect(
        readMapSource({ VITE_MAP_TILES_URL: url, VITE_MAP_ATTRIBUTION: "Provider" }),
      ).toBeNull();
    }
    expect(
      readMapSource({ VITE_MAP_TILES_URL: "https://tiles.example.org/style.json" }),
    ).toBeNull();
    expect(
      readMapSource({
        VITE_MAP_TILES_URL: "/maps/style.json",
        VITE_MAP_ATTRIBUTION: "Approved provider",
      })?.isRaster,
    ).toBe(false);
  });
});
