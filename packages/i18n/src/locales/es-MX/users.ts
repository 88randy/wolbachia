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

  "users.new.action": "Nuevo usuario",
  "users.new.title": "Nuevo usuario",
  "users.new.sectionData": "Datos de la persona",
  "users.new.sectionAccess": "Centro y perfil",
  "users.new.name": "Nombre completo",
  "users.new.username": "Usuario para iniciar sesión",
  "users.new.email": "Correo de trabajo (opcional)",
  "users.new.center": "Centro",
  "users.new.centerPlaceholder": "Elige un centro",
  "users.new.profile": "Perfil",
  "users.new.profilePlaceholder": "Elige un perfil",
  "users.new.scope": "Alcance de centros",
  "users.new.scopeAll": "Todos los centros",
  "users.new.scopeSelected": "Solo los centros que elija",
  "users.new.scopeCenters": "Centros con acceso",
  "users.new.scopeHint":
    "El almacén al que accede la persona sale de su alcance de centros: no se asigna aparte.",
  "users.new.required": "Completa nombre, usuario, centro y perfil.",
  "users.new.scopeRequired": "Elige al menos un centro.",
  "users.new.submit": "Crear usuario",
  "users.new.creating": "Creando…",
  "users.new.created": "Se creó el usuario {name}.",
  "users.new.partial":
    "Se creó el usuario {name}, pero todavía no tiene perfil ni alcance y no puede trabajar. Reintenta la asignación.",
  "users.new.assigned": "Se asignaron el perfil y el alcance.",
  "users.new.retry": "Reintentar asignación",
  "users.new.close": "Cerrar",

  "users.password.action": "Generar contraseña temporal",
  "users.password.title": "Contraseña temporal de {name}",
  "users.password.label": "Contraseña temporal",
  "users.password.once":
    "Se muestra una sola vez. Cópiala ahora y entrégala a la persona por un medio seguro. Al cerrar esta ventana ya no se puede ver.",
  "users.password.expires": "Vence el {date}",
  "users.password.mustChange": "La persona debe cambiarla al iniciar sesión.",
  "users.password.copy": "Copiar",
  "users.password.copied": "Contraseña copiada",
  "users.password.copyFailed": "No se pudo copiar. Selecciónala y cópiala a mano.",
  "users.password.generate": "Generar",

  "users.action.changeScope": "Cambiar perfil y alcance",
  "users.action.deactivate": "Dar de baja",
  "users.action.reactivate": "Reactivar",
  "users.action.blockedInactive":
    "El usuario está de baja. Reactívalo para cambiar su perfil y alcance o generar su contraseña.",
  "users.deactivate.title": "¿Dar de baja a {name}?",
  "users.deactivate.consequence":
    "Termina su membresía y cierra sus sesiones, incluida la del teléfono. No se borra nada: queda en el historial.",
  "users.deactivate.confirm": "Dar de baja",
  "users.deactivate.reasonLabel": "Motivo de la baja",
  "users.deactivate.reasonHint": "Obligatorio. Mínimo {count} caracteres.",
  "users.record.deactivationReason": "Motivo de la baja",
  "users.deactivate.done": "{name} está de baja.",
  "users.reactivate.done": "{name} está activo de nuevo.",

  "users.members.profiles": "Perfiles",
  "users.members.user": "Usuario",
  "users.members.profilesField": "Perfiles de la membresía",
  "users.members.filterProfile": "Perfil",
  "users.roles.members": "Usuarios",
  "users.roles.membersCount": "{count} activos",
  "users.roles.membersLink": "Ver los usuarios activos del perfil {name}",
  "users.roles.copy": "Copiar perfil",
  "users.roles.copyTitle": "Copiar el perfil {name}",
  "users.roles.copyHint":
    "Crea un perfil nuevo con los mismos permisos y alcance. Después puedes editarlo.",
  "users.roles.copyLabelEs": "Nombre en español",
  "users.roles.copyLabelEn": "Nombre en inglés",
  "users.roles.copyRequired": "Escribe el nombre en español y en inglés.",
  "users.roles.copySubmit": "Crear copia",
  "users.roles.copyDone": "Se creó el perfil nuevo.",

  "users.error.ownAdministration":
    "No puedes quitarte tus propios permisos de administración ni darte de baja. Pídelo a otra persona administradora.",
  "users.error.ownAccount": "No puedes generar una contraseña temporal para tu propia cuenta.",
  "users.error.sharedAccount":
    "Esta persona también inicia sesión en otra organización o plataforma, así que su contraseña no se puede restablecer desde aquí.",
  "users.error.inactive": "El usuario está de baja. Reactívalo primero.",
} as const satisfies AreaCatalog<"users">;
