import type { AreaCatalog } from "../area.ts";
export const transferEvidence = {
  "transferEvidence.upload.hint":
    "Selecciona una imagen PNG o JPEG de hasta 10 MiB y verifica la carga antes de continuar.",
  "transferEvidence.upload.verify": "Verificar imagen",
  "transferEvidence.upload.pending": "Imagen pendiente de verificación",
  "transferEvidence.upload.verified": "Imagen verificada",
  "transferEvidence.upload.invalid": "Selecciona una imagen PNG o JPEG de hasta 10 MiB.",
  "transferEvidence.upload.failed":
    "No pudimos confirmar la imagen. Reintenta verificarla; conservamos el archivo.",
  "transferEvidence.upload.noPermission":
    "Tu perfil no permite cargar imágenes. Pide a administración el permiso de carga para completar la firma o la evidencia.",
} as const satisfies AreaCatalog<"transferEvidence">;
