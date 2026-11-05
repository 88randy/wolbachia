import type { AreaCatalog } from "../area.ts";
export const fleet = {
  "fleet.page.title": "Motos",
  "fleet.page.gaps":
    "El filtro por centro, kilometraje, próximo servicio y rendimiento todavía no están disponibles. Requieren el backend de flota B-05 (#103).",
  "fleet.table.caption": "Motocicletas de la organización",
  "fleet.column.code": "Código",
  "fleet.column.plate": "Placa",
  "fleet.column.status": "Estado",
  "fleet.status.available": "Disponible",
  "fleet.status.blocked": "Fuera de servicio / Bloqueada",
  "fleet.status.voided": "Anulada",
  "fleet.reason.severeCheck": "Revisión con falla grave",
  "fleet.reason.serviceOverdue": "Servicio vencido",
  "fleet.reason.outOfService": "Fuera de servicio",
  "fleet.reason.unknown":
    "Motivo no disponible. Consulta a una persona autorizada para desbloquear motos.",
  "fleet.record.back": "Volver a motos",
  "fleet.record.loading": "Cargando la moto…",
  "fleet.record.refreshRequired":
    "No se ha confirmado el estado actual. Actualiza la ficha antes de realizar otra acción.",
  "fleet.tab.summary": "Resumen",
  "fleet.tab.services": "Servicios",
  "fleet.tab.responsibility": "Responsivas",
  "fleet.tab.fuel": "Combustible",
  "fleet.tab.incidents": "Incidentes",
  "fleet.tab.navigation": "Secciones de la ficha de moto",
  "fleet.gap.title": "Todavía no disponible",
  "fleet.gap.services":
    "Falta el historial de servicios y próximos servicios del backend de flota B-05 (#103).",
  "fleet.gap.responsibility": "Falta el historial de responsivas del backend de flota B-05 (#103).",
  "fleet.gap.fuel":
    "Faltan las cargas de combustible, kilometraje e intervalos comparables del backend de flota B-05 (#103). No se puede calcular el rendimiento.",
  "fleet.gap.incidents":
    "Falta el historial de incidentes y la liberación por falla del backend de flota B-05 (#103).",
  "fleet.gap.insufficient": "Datos insuficientes",
  "fleet.summary.unknown": "Sin dato",
  "fleet.summary.system": "Sistema / sin referencia de autor",
  "fleet.summary.createdAt": "Fecha de alta",
  "fleet.summary.createdBy": "Referencia de quien registró",
  "fleet.summary.voidedAt": "Fecha de anulación",
  "fleet.summary.voidedBy": "Referencia de quien anuló",
  "fleet.summary.historyGap":
    "El historial de bloqueos y desbloqueos aún no está disponible. Esta ficha muestra el estado actual; el historial completo requiere el backend B-05 (#103).",
  "fleet.unblock.title": "Desbloquear {record}",
  "fleet.unblock.hint":
    "Documenta la revisión y la evidencia en el motivo. Esta acción solo retira el bloqueo registrado por el servidor; debe realizarla una persona con permiso para desbloquear motos.",
  "fleet.unblock.confirm": "Desbloquear",
  "fleet.unblock.busy": "Desbloqueando…",
  "fleet.unblock.failure": "No pudimos desbloquear",
  "fleet.unblock.reason": "Motivo y evidencia",
  "fleet.action.voided":
    "La moto está anulada. No puede modificarse; una persona con permiso de administración puede registrar una nueva.",
  "fleet.action.notBlocked": "La moto no está bloqueada. No hay un bloqueo que retirar.",
  "fleet.action.saved": "Cambio guardado.",
  "fleet.create.title": "Alta de moto",
  "fleet.create.invalidCode": "Escribe un código de hasta 50 caracteres.",
  "fleet.create.invalidPlate": "La placa puede tener hasta 20 caracteres.",
  "fleet.create.failure": "No pudimos registrar la moto",
  "fleet.create.busy": "Guardando…",
} as const satisfies AreaCatalog<"fleet">;
