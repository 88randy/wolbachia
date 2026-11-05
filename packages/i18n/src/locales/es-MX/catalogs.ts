import type { AreaCatalog } from "../area.ts";
export const catalogs = {
  "catalogs.page.title": "Catálogos",
  "catalogs.page.empty": "Todavía no hay catálogos disponibles.",
  "catalogs.page.refreshFailed":
    "No pudimos actualizar los catálogos. Conservamos la información anterior. Reintenta.",
  "catalogs.page.tabs": "Catálogos disponibles",
  "catalogs.page.loading": "Cargando catálogos…",
  "catalogs.page.open":
    "Cada lista abierta conserva «Otro (especificar)» al final. Al elegirlo en un formulario se requiere texto libre. Los registros anteriores conservan los elementos desactivados.",
  "catalogs.page.closed":
    "Este catálogo es cerrado y no tiene «Otro (especificar)». Los registros anteriores conservan los elementos desactivados.",
  "catalogs.table.unknownAuthor": "—",
  "catalogs.table.usage": "En uso",
  "catalogs.table.item": "Elemento",
  "catalogs.table.code": "Código",
  "catalogs.table.created": "Desde",
  "catalogs.table.status": "Estado",
  "catalogs.table.actions": "Acciones",
  "catalogs.table.include": "Incluir desactivados",
  "catalogs.status.inUse": "En uso",
  "catalogs.status.inUseDescription":
    "Permanece en los registros anteriores y solo se puede desactivar.",
  "catalogs.status.active": "Activo",
  "catalogs.status.inactive": "Desactivado",
  "catalogs.status.fixed": "Fijo",
  "catalogs.actions.add": "Agregar elemento",
  "catalogs.actions.edit": "Editar",
  "catalogs.actions.up": "Mover arriba",
  "catalogs.actions.down": "Mover abajo",
  "catalogs.actions.deactivate": "Desactivar",
  "catalogs.actions.activate": "Reactivar",
  "catalogs.actions.moveUp": "Mover arriba: {name}",
  "catalogs.actions.moveDown": "Mover abajo: {name}",
  "catalogs.actions.movedUp": "Se movió {name} arriba.",
  "catalogs.actions.movedDown": "Se movió {name} abajo.",
  "catalogs.actions.saved": "Cambios guardados.",
  "catalogs.actions.busy": "Espera a que termine la operación.",
  "catalogs.actions.first": "Ya es el primer elemento activo.",
  "catalogs.actions.last": "Ya es el último elemento activo.",
  "catalogs.form.create": "Agregar elemento",
  "catalogs.form.edit": "Editar elemento",
  "catalogs.form.code": "Código",
  "catalogs.form.spanish": "Etiqueta en español (obligatoria)",
  "catalogs.form.english": "Etiqueta en inglés",
  "catalogs.form.fallback": "Si dejas el inglés vacío, se mostrará la etiqueta en español.",
  "catalogs.form.warning": "Sin etiqueta en inglés: se usa el español.",
  "catalogs.form.save": "Guardar",
  "catalogs.form.busy": "Guardando…",
  "catalogs.confirm.title": "Desactivar {name}",
  "catalogs.confirm.hint":
    "Dejará de aparecer en formularios nuevos. Los registros anteriores lo seguirán mostrando.",
  "catalogs.error.code":
    "Usa hasta 64 caracteres: letras minúsculas, números, guion o guion bajo; inicia con letra o número.",
  "catalogs.error.label": "Escribe una etiqueta de hasta 200 caracteres.",
  "catalogs.error.duplicate": "Este código ya existe. Elige otro.",
  "catalogs.error.reserved": "El código «other» está reservado. Elige otro.",
  "catalogs.error.sort":
    "No queda espacio en el orden. Reordena los elementos e inténtalo de nuevo.",
  "catalogs.error.limit":
    "El catálogo alcanzó el límite de 200 elementos activos. Desactiva uno antes de continuar.",
  "catalogs.error.other": "«Otro (especificar)» es fijo y no puede desactivarse.",
  "catalogs.error.versionConflict":
    "El catálogo cambió. Se recargó la lista; revisa el orden e intenta de nuevo.",
  "catalogs.error.reorder":
    "No se pudo completar el cambio de orden. Se recargó la lista; revísala antes de reintentar.",
} as const satisfies AreaCatalog<"catalogs">;
