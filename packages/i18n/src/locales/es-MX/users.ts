/** Mexican Spanish messages of the `users` area (W48 users, W49 person record). Source of the `users.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const users = {
  "users.page.title": "Usuarios",
  "users.page.description":
    "Las personas que trabajan en tu organización, su perfil, su centro y si están activas.",
  "users.page.retention": "Las bajas no se borran: quedan en el historial.",
  "users.table.caption": "Usuarios de la organización",
  "users.hub.description":
    "Personas, perfiles, RFC protegido y cierre de sesión en teléfonos perdidos.",
  "users.hub.notifications": "Avisos que recibes",
  "users.hub.notificationsDescription": "Elige qué avisos te llegan en la plataforma y por correo.",

  "users.filter.search": "Buscar por nombre, correo o teléfono",
  "users.filter.status": "Estado",
  "users.status.active": "Activo",
  "users.status.inactive": "De baja",

  "users.column.name": "Nombre",
  "users.column.profiles": "Perfiles",
  "users.column.center": "Centro",
  "users.column.rfc": "RFC",
  "users.column.status": "Estado",

  "users.rfc.hidden": "RFC oculto",
  "users.rfc.mask": "XXXX •••••• •••",
  "users.rfc.none": "Sin RFC",
  "users.rfc.show": "Mostrar",
  "users.rfc.hide": "Ocultar",
  "users.rfc.logged": "Mostraste el RFC. Quedó en la bitácora de accesos.",
  "users.rfc.failed": "No se pudo mostrar el RFC. Intenta otra vez.",

  "users.record.data": "Datos",
  "users.record.summary": "Resumen",
  "users.record.email": "Correo de trabajo",
  "users.record.phone": "Teléfono de trabajo",
  "users.record.privacy": "No se guardan datos de vecinos en ninguna parte de la plataforma.",

  "users.revoke.action": "Cerrar sesión en su teléfono",
  "users.revoke.title": "¿Cerrar la sesión de {name} en su teléfono?",
  "users.revoke.consequence":
    "Tendrá que volver a entrar. Lo que tenga pendiente de enviar se conserva y llega cuando el teléfono se conecte.",
  "users.revoke.confirm": "Cerrar sesión",
  "users.revoke.done": "Se cerró la sesión de {name} en su teléfono.",
  "users.revoke.failed": "No se pudo cerrar la sesión. Intenta otra vez.",
  "users.revoke.help":
    "«Cerrar sesión en su teléfono» sirve si se pierde un teléfono: la sesión se cierra en el próximo contacto y lo pendiente de enviar se conserva.",
} as const satisfies AreaCatalog<"users">;
