import type { MessageKey } from "@wolbachia/i18n";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "./annotation-upload";

const HEADER_BYTES = 12;
const GENERIC_TYPES = ["", "application/octet-stream", "binary/octet-stream"];
const JPEG_ALIASES = ["image/jfif", "image/jpe", "image/jpg", "image/pjpeg"];
const JPEG_HEADER = [0xff, 0xd8, 0xff];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_HEADER = [0x57, 0x45, 0x42, 0x50];
const RIFF_HEADER = [0x52, 0x49, 0x46, 0x46];
const WEBP_OFFSET = 8;

type PhotoChoice = { file: File; error?: never } | { file?: never; error: MessageKey };

function matchesHeader(bytes: Uint8Array, header: number[], offset = 0) {
  return header.every((byte, index) => bytes[index + offset] === byte);
}

function detectPhotoType(bytes: Uint8Array) {
  if (matchesHeader(bytes, JPEG_HEADER)) return "image/jpeg";
  if (matchesHeader(bytes, PNG_HEADER)) return "image/png";
  if (matchesHeader(bytes, RIFF_HEADER) && matchesHeader(bytes, WEBP_HEADER, WEBP_OFFSET))
    return "image/webp";
  return undefined;
}

async function normalizePhoto(file: File) {
  if (IMAGE_TYPES.includes(file.type)) return file;
  if (!GENERIC_TYPES.includes(file.type) && !JPEG_ALIASES.includes(file.type)) return undefined;
  const type = detectPhotoType(new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer()));
  return type ? new File([file], file.name, { type, lastModified: file.lastModified }) : undefined;
}

/** Filename extensions never substitute for image bytes; the server still verifies the full file. */
export async function chooseAnnotationPhoto(files: File[]): Promise<PhotoChoice> {
  for (const candidate of files) {
    const file = await normalizePhoto(candidate);
    if (!file) continue;
    if (file.size > MAX_IMAGE_BYTES) return { error: "labAnnotation.upload.tooLarge" };
    if (file.size === 0) return { error: "labAnnotation.upload.unsupported" };
    return { file };
  }
  return {
    error: files.length ? "labAnnotation.upload.unsupported" : "labAnnotation.upload.noFile",
  };
}

/** Read File objects synchronously while the drop data store is accessible. */
export function readPhotoDropFiles(transfer: DataTransfer | null): File[] {
  const items = Array.from(transfer?.items ?? []).filter((item) => item.kind === "file");
  const files = items.map((item) => item.getAsFile()).filter((file) => file !== null);
  return files.length ? files : Array.from(transfer?.files ?? []);
}
