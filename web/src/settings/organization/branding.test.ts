import { expect, test, vi } from "vitest";
import { isAllowedLogo, isSafeLogoUrl, prepareLogo } from "./branding";

test("branding accepts raster only and fails to initials for malformed, foreign or SVG URLs", () => {
  for (const type of ["image/png", "image/jpeg", "image/webp"])
    expect(isAllowedLogo(new File(["raster"], "image", { type }))).toBe(true);
  expect(isAllowedLogo(new File(["svg"], "image.svg", { type: "image/svg+xml" }))).toBe(false);
  for (const url of [
    "https://[",
    "https://foreign.example/api/v1/organization/logo/",
    "/logo.svg",
    "data:image/svg+xml,<svg/>",
  ])
    expect(isSafeLogoUrl(url)).toBe(false);
  expect(isSafeLogoUrl("/api/v1/organization/logo/")).toBe(true);
});

test("JPEG and WebP are decoded to bounded PNG before reaching the upload API", async () => {
  const close = vi.fn();
  const bitmap = { width: 1, height: 1, close };
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
    callback(new Blob(["png"], { type: "image/png" }));
  });
  try {
    for (const type of ["image/jpeg", "image/webp"])
      expect((await prepareLogo(new File(["raster"], "image", { type }))).type).toBe("image/png");
    expect(close).toHaveBeenCalledTimes(2);
  } finally {
    getContext.mockRestore();
    toBlob.mockRestore();
    vi.unstubAllGlobals();
  }
});
