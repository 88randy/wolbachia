/**
 * Mexican Spanish catalog. This file is the SOURCE of the key list:
 * `MessageKey` is derived from it and `en.ts` must provide the same keys.
 *
 * Keys follow `area.screen.element` (see README). Placeholders are `{name}`.
 */
export const esMX = {
  // Common actions
  "common.actions.save": "Guardar",
  "common.actions.cancel": "Cancelar",
  "common.actions.retry": "Reintentar",
  "common.actions.close": "Cerrar",
  "common.actions.goHome": "Ir al inicio",
  "common.actions.void": "Anular",

  // Common fields
  "common.fields.voidReason": "Motivo de la anulación",
  "common.fields.otherSpecify": "Otro (especificar)",

  // API errors: the API returns `code` + `params`, never text
  "errors.api.generic": "No pudimos completar la acción. Inténtalo de nuevo.",
  "errors.api.network": "No hay conexión con el servidor. Revisa tu señal e inténtalo de nuevo.",
  "errors.api.validation": "Hay datos que no son válidos. Revisa los campos marcados y corrígelos.",
  "errors.api.notFound": "No encontramos lo que buscas. Regresa e inténtalo de nuevo.",
  "errors.api.permissionDenied":
    "No tienes permiso para hacer esto. Pídele acceso a tu supervisor.",
  "errors.api.blocked": "Esta acción está bloqueada por ahora. Quien puede desbloquearla: {role}.",
  "errors.api.sessionRevoked": "Tu sesión terminó. Inicia sesión de nuevo para continuar.",
  "errors.api.rateLimited":
    "Hiciste muchas solicitudes seguidas. Espera un momento e inténtalo de nuevo.",
  "errors.api.serverError":
    "Algo falló de nuestro lado. Inténtalo en unos minutos; si sigue igual, avisa a soporte.",

  // Web shell: brand, skip link, sidebar, top bar
  "shell.brand.name": "Wolbachia",
  "shell.brand.mark": "CQ",
  "shell.a11y.skipToContent": "Saltar al contenido",
  "shell.nav.label": "Navegación principal",
  "shell.sidebar.collapse": "Colapsar menú",
  "shell.topBar.searchLabel": "Buscar",
  "shell.topBar.searchPlaceholder": "Busca o escanea",
  "shell.topBar.notificationsSoon": "Todavía no está disponible.",
  "shell.topBar.notifications": "Notificaciones",
  "shell.language.toEnglish": "ES: cambiar idioma a inglés",
  "shell.language.toSpanish": "EN: cambiar idioma a español",

  // Web shell: sidebar groups and areas (one entry per area of web/README.md)
  "shell.group.operation": "Operación",
  "shell.group.resources": "Recursos",
  "shell.group.analysis": "Análisis y administración",
  "shell.nav.home": "Inicio",
  "shell.nav.incidents": "Incidentes",
  "shell.nav.operations": "Supervisión",
  "shell.nav.quadrants": "Cuadrantes y muestreo",
  "shell.nav.releases": "Liberaciones",
  "shell.nav.community": "Comunidad",
  "shell.nav.inventory": "Inventario",
  "shell.nav.fleet": "Flota",
  "shell.nav.lab": "Laboratorio",
  "shell.nav.people": "Personal",
  "shell.nav.dashboards": "Tableros",
  "shell.nav.regulatory": "Regulatorio",
  "shell.nav.settings": "Configuración",

  // Web global states
  "states.placeholder.body": "Esta sección todavía está en construcción.",
  "states.loading.label": "Cargando contenido",
  "states.notFound.title": "No encontramos esta página",
  "states.notFound.body":
    "La dirección no existe o ya no está disponible. Regresa al inicio e inténtalo de nuevo.",
  "states.error.title": "Algo salió mal en esta pantalla",
  "states.error.body": "Puedes reintentar o regresar al inicio. Si sigue igual, avisa a soporte.",
  "states.noPermission.title": "No tienes acceso a esta sección",
  "states.noPermission.area": "Sección",
  "states.noPermission.body":
    "Tu perfil actual no permite abrirla. Pide acceso al administrador de tu organización.",
  "states.config.title": "La aplicación no está lista",
  "states.config.missingApiUrl":
    "La dirección del servidor no está configurada o no es válida. Avisa a soporte técnico para que la corrijan.",
  "states.offline.banner":
    "Sin conexión. Lo que ves puede no estar actualizado; se actualizará cuando vuelva la red.",

  // Web sign-in (W1), password reset, organization choice and session expiry (#28)
  "auth.login.title": "Inicia sesión",
  "auth.login.username": "Usuario",
  "auth.login.password": "Contraseña",
  "auth.login.showPassword": "Mostrar contraseña",
  "auth.login.submit": "Entrar",
  "auth.login.submitting": "Entrando…",
  "auth.login.forgot": "Olvidé mi contraseña",
  "auth.login.noSignUp": "Las cuentas las da de alta el administrador de tu organización.",
  "auth.login.usernameRequired": "Escribe tu usuario.",
  "auth.login.passwordRequired": "Escribe tu contraseña.",
  "auth.login.invalidCredentials": "El usuario o la contraseña no coinciden.",
  "auth.login.invalidCredentialsHint": "Revísalos e inténtalo de nuevo.",
  "auth.login.noMembership":
    "Tu cuenta no tiene acceso activo a una organización. Contacta a tu administrador.",
  "auth.login.passwordChanged": "Tu contraseña se actualizó. Inicia sesión con la nueva.",
  "auth.login.program": "Programa Wolbachia",
  "auth.login.headline": "Plataforma de operación y vigilancia entomológica",
  "auth.login.tagline": "Aquí la oficina prepara, controla y analiza lo que pasa en campo.",
  "auth.login.standards": "NOM-032-SSA2-2014 · Guías CENAPRECE 2024",
  "auth.lockout.message": "Demasiados intentos. Espera {minutes} min e inténtalo de nuevo.",
  "auth.lockout.noWait": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  "auth.lockout.hint":
    "Si olvidaste tu contraseña, puedes restablecerla desde el enlace de abajo o pedir ayuda a tu administrador.",
  "auth.forgot.title": "Restablece tu contraseña",
  "auth.forgot.body":
    "Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.",
  "auth.forgot.email": "Correo electrónico",
  "auth.forgot.emailInvalid": "Escribe un correo válido, por ejemplo nombre@empresa.com.",
  "auth.forgot.submit": "Enviar enlace",
  "auth.forgot.sentTitle": "Revisa tu correo",
  "auth.forgot.sent":
    "Si ese correo está registrado, te enviamos un enlace para restablecer tu contraseña. Puede tardar unos minutos; revisa también la carpeta de spam.",
  "auth.forgot.backToLogin": "Volver a iniciar sesión",
  "auth.reset.title": "Elige una contraseña nueva",
  "auth.reset.newPassword": "Contraseña nueva",
  "auth.reset.confirmPassword": "Confirma la contraseña",
  "auth.reset.hint": "Usa una contraseña larga y que no sea fácil de adivinar.",
  "auth.reset.submit": "Guardar contraseña",
  "auth.reset.required": "Escribe una contraseña.",
  "auth.reset.mismatch": "Las contraseñas no coinciden.",
  "auth.reset.passwordTooShort": "La contraseña es demasiado corta. Usa una más larga.",
  "auth.reset.passwordTooCommon": "Esa contraseña es muy común. Elige otra.",
  "auth.reset.passwordEntirelyNumeric": "La contraseña no puede ser solo números.",
  "auth.reset.passwordTooSimilar": "La contraseña se parece demasiado a tus datos. Elige otra.",
  "auth.reset.invalidLinkTitle": "Este enlace ya no sirve",
  "auth.reset.invalidLinkBody":
    "El enlace venció, ya se usó o no es válido. Pide uno nuevo para continuar.",
  "auth.reset.requestNew": "Pedir un enlace nuevo",
  "auth.organization.title": "Elige tu organización",
  "auth.organization.body":
    "Tu cuenta pertenece a varias organizaciones. Elige con cuál quieres trabajar ahora.",
  "auth.organization.legend": "Organizaciones disponibles",
  "auth.organization.submit": "Continuar",
  "auth.session.title": "Tu sesión terminó",
  "auth.session.body":
    "Por seguridad cerramos tu sesión. Escribe tu contraseña para continuar; lo que tenías sin guardar se conserva.",
  "auth.session.submit": "Continuar",
  "auth.session.signOut": "Cerrar sesión",

  // Web user menu (top bar)
  "shell.userMenu.button": "Menú de usuario",
  "shell.userMenu.organization": "Organización",
  "shell.userMenu.profiles": "Perfiles",
  "shell.userMenu.noProfile": "Sin perfil asignado",
  "shell.userMenu.changeOrganization": "Cambiar de organización",
  "shell.userMenu.signOut": "Cerrar sesión",

  // Result of sending a record to the server (phone inbox)
  "sync.inbox.acceptedTitle": "Enviado",
  "sync.inbox.acceptedHint": "El servidor ya recibió este registro. No tienes que hacer nada más.",
  "sync.inbox.rejectedTitle": "No aceptado",
  "sync.inbox.rejectedHint":
    "El servidor no pudo aceptar este registro. Pídele a tu supervisor que lo revise.",
  "sync.inbox.inReviewTitle": "En revisión",
  "sync.inbox.inReviewHint":
    "Un supervisor revisará este registro. Mientras tanto no tienes que hacer nada.",
} as const;

/** Every key of the catalog. */
export type MessageKey = keyof typeof esMX;
