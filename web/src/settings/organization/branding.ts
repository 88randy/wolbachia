import type { Schemas } from "@wolbachia/api-client";
export class InvalidLogoError extends Error {}
export const MAX_LOGO_BYTES = 1024 * 1024;
const MAX_DIMENSION = 1024;
const RASTER_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
export function isAllowedLogo(file: File): boolean {
  return RASTER_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_LOGO_BYTES;
}
/** Only the authenticated same-origin raster endpoint is consumed, never an arbitrary URL. */
export function isSafeLogoUrl(value: string | null): boolean {
  if (!value) return false;
  let url: URL;
  try {
    url = new URL(value, window.location.origin);
  } catch {
    return false;
  }
  return (
    url.origin === window.location.origin &&
    url.pathname === "/api/v1/organization/logo/" &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password
  );
}
/** Backend currently accepts PNG only. Browser raster decoding normalizes JPEG/WebP before upload. */
export async function prepareLogo(file: File): Promise<File> {
  if (!isAllowedLogo(file)) throw new InvalidLogoError("Invalid raster logo");
  if (file.type === "image/png") return file;
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION)
      throw new InvalidLogoError("Logo dimensions exceeded");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new InvalidLogoError("Raster decoding unavailable");
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new InvalidLogoError("Raster encoding failed"));
      }, "image/png");
    });
    if (blob.size > MAX_LOGO_BYTES) throw new InvalidLogoError("Encoded raster is oversized");
    return new File([blob], "organization.png", { type: "image/png" });
  } finally {
    bitmap.close();
  }
}
export function organizationBody(
  settings: Schemas["OrganizationSettings"],
): Schemas["PatchedOrganizationUpdateRequest"] {
  return {
    expected_revision: settings.revision,
    name: settings.name,
    timezone: settings.timezone,
    epi_week: settings.epi_week,
    languages: settings.languages.filter(
      (language): language is Schemas["LanguagesEnum"] => language === "en" || language === "es-MX",
    ),
    label_phone: settings.label_phone,
    support_contact: settings.support_contact,
  };
}
