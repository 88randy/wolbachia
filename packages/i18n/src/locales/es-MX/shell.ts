/** Mexican Spanish messages of the `shell` area. Source of the `shell.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const shell = {
  "shell.nav.notifications": "Notificaciones",
  // Web shell: brand, skip link, sidebar, top bar
  "shell.crumb.records": "Registros",
  "shell.brand.name": "AedesVision",
  "shell.brand.mark": "AV",
  "shell.a11y.skipToContent": "Saltar al contenido",
  "shell.nav.label": "Navegación principal",
  "shell.sidebar.collapse": "Colapsar menú",
  "shell.topBar.searchLabel": "Buscar",
  "shell.topBar.searchPlaceholder": "Buscar…",
  "shell.topBar.notificationsSoon": "Todavía no está disponible.",
  "shell.topBar.notifications": "Notificaciones",
  "shell.language.toEnglish": "ES: cambiar idioma a inglés",
  "shell.language.toSpanish": "EN: cambiar idioma a español",

  "shell.theme.dark": "Tema oscuro",

  // Web shell: sidebar groups and areas (one entry per area of web/README.md)
  "shell.group.operation": "Operación",
  "shell.group.resources": "Recursos",
  "shell.group.analysis": "Análisis y administración",
  "shell.group.platform": "Plataforma",
  "shell.nav.home": "Inicio",
  "shell.nav.incidents": "Incidentes",
  "shell.nav.operations": "Supervisión",
  "shell.nav.scheduling": "Programación",
  "shell.nav.quadrants": "Cuadrantes y muestreo",
  "shell.nav.releases": "Liberaciones",
  "shell.nav.community": "Comunidad",
  "shell.nav.inventory": "Inventario",
  "shell.nav.fleet": "Flota",
  "shell.nav.lab": "Laboratorio",
  "shell.nav.people": "Personal",
  "shell.nav.dashboards": "Análisis",
  "shell.nav.regulatory": "Regulatorio",
  "shell.nav.settings": "Configuración",
  "shell.nav.platform": "Organizaciones",
  "shell.nav.portal": "Portal público",

  // Web user menu (top bar)
  "shell.userMenu.button": "Menú de usuario",
  "shell.userMenu.organization": "Organización",
  "shell.userMenu.profiles": "Perfiles",
  "shell.userMenu.noProfile": "Sin perfil asignado",
  "shell.userMenu.changeOrganization": "Cambiar de organización",
  "shell.userMenu.signOut": "Cerrar sesión",
} as const satisfies AreaCatalog<"shell">;
