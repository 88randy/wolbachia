import { Buffer } from "node:buffer";
import { crc32, deflateSync } from "node:zlib";
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

test("grayscale/indexed PNG, JPEG and WebP are decoded and re-encoded before upload", async () => {
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
    const sources = [
      sourcePng(0),
      sourcePng(3),
      new File(["jpeg"], "image", { type: "image/jpeg" }),
      new File(["webp"], "image", { type: "image/webp" }),
    ];
    for (const source of sources) expect(await (await prepareLogo(source)).text()).toBe("png");
    expect(close).toHaveBeenCalledTimes(4);
  } finally {
    getContext.mockRestore();
    toBlob.mockRestore();
    vi.unstubAllGlobals();
  }
});

function pngChunk(kind: string, content: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(kind), content]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(content.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([size, body, checksum]);
}
/** Valid one-pixel PNGs using backend-unsupported grayscale or indexed color. */
function sourcePng(color: 0 | 3): File {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = color;
  const bytes = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    ...(color === 3 ? [pngChunk("PLTE", new Uint8Array([0, 0, 0]))] : []),
    pngChunk("IDAT", deflateSync(new Uint8Array([0, 0]))),
    pngChunk("IEND", new Uint8Array()),
  ]);
  return new File([Uint8Array.from(bytes)], "source.png", { type: "image/png" });
}
