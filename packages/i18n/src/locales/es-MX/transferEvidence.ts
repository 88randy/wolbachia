import type { AreaCatalog } from "../area.ts";
export const transferEvidence = {
  "transferEvidence.upload.hint": "Elige una foto.",
  "transferEvidence.upload.verify": "Verificar imagen",
  "transferEvidence.upload.pending": "Guardando la foto…",
  "transferEvidence.upload.verified": "Foto guardada",
  "transferEvidence.upload.invalid": "Elige una foto en formato PNG o JPEG.",
  "transferEvidence.upload.failed": "No se pudo guardar la foto. Elígela otra vez.",
  "transferEvidence.upload.noPermission":
    "Tu perfil no permite cargar imágenes. Pide a administración el permiso de carga para completar la firma o la evidencia.",
} as const satisfies AreaCatalog<"transferEvidence">;
