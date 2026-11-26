/** Mexican Spanish messages for W34 laboratory bag reception. */
import type { AreaCatalog } from "../area.ts";

export const labReception = {
  "labReception.page.title": "Recepción de bolsas",
  "labReception.page.subtitle": "Escanea cada bolsa y confirma su recepción en el laboratorio.",
  "labReception.page.scope":
    "Recepción de toda la organización. Usa el punto de muestreo y la semana epidemiológica para acotar las listas; el centro seleccionado no filtra esta vista.",
  "labReception.scan.label": "Código de bolsa",
  "labReception.scan.readingId": "Lectura",
  "labReception.scan.noPaddleHint":
    "Usa el identificador de una lectura que registró ausencia de papeleta. No puede entrar a la cola de conteo.",
  "labReception.scan.hint":
    "Usa el lector o escribe el código y presiona Enter. El foco vuelve aquí después de cada resultado.",
  "labReception.scan.submit": "Recibir bolsa",
  "labReception.scan.busy": "Registrando recepción…",
  "labReception.scan.queued": "Escaneos en espera",
  "labReception.scan.invalid": "Escribe un código de bolsa válido antes de continuar.",
  "labReception.scan.received": "Bolsa recibida. Puedes escanear la siguiente.",
  "labReception.scan.noPaddle": "Lectura recibida sin papeleta. No se agregó a la cola de conteo.",
  "labReception.scan.alreadyReceived": "Esta bolsa ya fue recibida. No se creó otra recepción.",
  "labReception.scan.unknown":
    "No encontramos una bolsa disponible con ese código. Revisa la etiqueta.",
  "labReception.scan.noReading":
    "La bolsa no tiene una lectura de campo vigente. Revisa la discrepancia.",
  "labReception.scan.missing": "Se registró el faltante. Revisa la discrepancia.",
  "labReception.scan.configurationPending":
    "La discrepancia quedó registrada, pero el incidente sigue pendiente de configuración. Pide a administración revisar la política de recepción.",
  "labReception.scan.conflict":
    "El estado de la bolsa cambió. Actualiza su información antes de continuar.",
  "labReception.scan.inProgress":
    "Otra operación está usando esta bolsa. Revisa su estado antes de volver a intentarlo.",
  "labReception.scan.uncertain":
    "No pudimos confirmar el resultado. Revisa las recepciones antes de volver a registrar esta bolsa.",
  "labReception.scan.review": "Revisar estado actual",
  "labReception.scan.reviewHint":
    "Actualiza las listas y revisa el resultado. Después continuarán los escaneos en espera; la operación incierta no se enviará de nuevo.",
  "labReception.table.received": "Recepciones registradas",
  "labReception.table.expected": "Bolsas esperadas",
  "labReception.table.discrepancies": "Discrepancias de recepción",
  "labReception.table.bag": "Bolsa",
  "labReception.table.reading": "Lectura",
  "labReception.table.block": "Manzana",
  "labReception.table.point": "Folio",
  "labReception.table.date": "Fecha",
  "labReception.table.collector": "Colector",
  "labReception.table.paddlePresent": "¿Hay papeleta?",
  "labReception.table.hasEggs": "¿Tiene huevos?",
  "labReception.table.status": "Estado",
  "labReception.table.actions": "Acciones",
  "labReception.table.noPaddle": "Sin papeleta",
  "labReception.table.yes": "Sí",
  "labReception.table.no": "No",
  "labReception.table.unknown": "No disponible",
  "labReception.summary.expected": "Por recibir",
  "labReception.summary.received": "Recibidas",
  "labReception.summary.hint":
    "Los totales son consultas independientes con los filtros indicados. No representan un cierre de entrega.",
  "labReception.filters.week": "Semana epidemiológica",
  "labReception.filters.point": "Punto de muestreo",
  "labReception.filters.code": "Código exacto de bolsa",
  "labReception.filters.status": "Estado de laboratorio",
  "labReception.filters.kind": "Tipo de recepción",
  "labReception.action.markMissing": "Marcar faltante",
  "labReception.action.reason": "Motivo del faltante",
  "labReception.action.confirmMissing": "Registrar faltante",
  "labReception.action.missingHint":
    "Esto registra una observación auditable de bolsa faltante y puede abrir un incidente. Escribe el motivo.",
  "labReception.action.receiveNoPaddle": "Recibir lectura sin papeleta",
  "labReception.action.openIncident": "Abrir incidente",
  "labReception.action.countQueue": "Ir a la cola de conteo",
  "labReception.action.refresh": "Actualizar recepción",
  "labReception.status.expected": "Por recibir",
  "labReception.status.missing": "Faltante",
  "labReception.status.noEffectiveReading": "Sin lectura vigente",
  "labReception.status.pendingCount": "Pendiente de conteo",
  "labReception.status.counted": "Contada",
  "labReception.status.awaitingIndependentQa": "Pendiente de revisión independiente",
  "labReception.status.rejected": "Rechazada",
  "labReception.status.voided": "Anulada",
  "labReception.status.received": "Recibida",
  "labReception.status.configurationPending": "Configuración pendiente",
  "labReception.metadata.unavailable": "Detalle no disponible con tu acceso actual.",
  "labReception.metadata.limited":
    "Se muestran los identificadores disponibles. Los datos de ubicación y colector requieren su propia autorización.",
  "labReception.incident.title": "Incidente de recepción",
} as const satisfies AreaCatalog<"labReception">;
