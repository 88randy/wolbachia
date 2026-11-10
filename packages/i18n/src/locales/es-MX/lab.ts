import type { AreaCatalog } from "../area.ts";
export const lab = {
  "lab.count.title": "Conteo de huevos",
  "lab.count.value": "Huevos de laboratorio",
  "lab.count.replacement": "Nuevo conteo",
  "lab.count.integer": "Escribe un entero de cero o más, sin decimales.",
  "lab.count.save": "Guardar y siguiente",
  "lab.count.saved": "Conteo guardado.",
  "lab.count.retry": "Reintentar guardado",
  "lab.count.confirm": "Confirmar conteo alto",
  "lab.count.confirmHint":
    "El conteo supera el límite vigente. Confírmalo para guardarlo y solicitar la revisión independiente.",
  "lab.queue.title": "Cola de conteo",
  "lab.queue.bag": "Bolsa",
  "lab.queue.scan": "Escanear o buscar código de bolsa",
  "lab.queue.status": "Estado",
  "lab.queue.empty": "No hay bolsas recibidas pendientes de conteo.",
  "lab.shortcuts.title": "Atajos de conteo",
  "lab.shortcuts.enter": "Enter: guardar y pasar a la siguiente bolsa.",
  "lab.shortcuts.tab": "Tab: siguiente control; Mayús + Tab: control anterior.",
  "lab.shortcuts.scan":
    "Escanea el código en el filtro de bolsa y presiona Enter; después captura el conteo.",
  "lab.bag.title": "Datos de la bolsa",
  "lab.bag.block": "Manzana",
  "lab.bag.date": "Fecha de lectura",
  "lab.bag.collector": "Colector (ID)",
  "lab.bag.unavailable": "No disponible con los permisos actuales",
  "lab.bag.partial":
    "Faltan permisos para algunos datos de origen. La administración puede revisar los accesos de lectura.",
  "lab.bag.lagged": "Lectura desfasada",
  "lab.bag.onTime": "Lectura a tiempo",
  "lab.bag.excluded": "Lectura excluida de los índices; se puede contar.",
  "lab.history.title": "Historial de conteos",
  "lab.history.link": "Ver historial de esta bolsa",
  "lab.history.author": "Capturó (ID)",
  "lab.history.bag": "Bolsa (ID)",
  "lab.history.time": "Fecha de captura",
  "lab.history.attempt": "Intento",
  "lab.history.actions": "Acciones",
  "lab.history.voided": "Anulado",
  "lab.history.recorded": "Registrado",
  "lab.history.retained":
    "El conteo original se conserva. Esta información todavía no está disponible.",
  "lab.correction.title": "Corregir conteo",
  "lab.correction.hint":
    "Se anula el conteo original y se registra uno nuevo en la misma operación. Ambos quedan en el historial.",
  "lab.correction.reasonCode": "Motivo de anulación",
  "lab.correction.reason": "Explicación",
  "lab.correction.noteHint":
    "Elige un motivo y escribe entre 10 caracteres visibles y 1000 caracteres de explicación.",
  "lab.correction.catalogPermission":
    "Para corregir se necesita acceso al catálogo de motivos. Pide a la administración que revise el permiso de lectura de catálogos.",
  "lab.correction.catalog": "No se pudieron cargar los motivos. Reintenta antes de guardar.",
  "lab.correction.save": "Anular y guardar corrección",
  "lab.draft.restored": "Borrador restaurado.",
  "lab.draft.discard": "Descartar borrador",
  "lab.error.uncertain":
    "No se confirmó el guardado. Conservamos el valor: reintenta el mismo guardado antes de cambiarlo.",
  "lab.error.conflict":
    "Otra captura cambió esta bolsa. Conservamos tu valor; revisa el historial antes de continuar.",
  "lab.error.conflictHidden":
    "No tienes permiso para leer quién capturó el conteo. Pide a la administración que revise el acceso al historial.",
  "lab.error.conflictMissing":
    "No hay un conteo vigente visible. La bolsa pudo ser anulada o rechazada; actualiza la cola.",
  "lab.error.rejected": "No se pudo guardar. Revisa los datos o tus permisos y vuelve a intentar.",
} as const satisfies AreaCatalog<"lab">;
