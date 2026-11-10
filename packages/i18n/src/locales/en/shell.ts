/** English messages of the `shell` area: exactly the keys of `../es-MX/shell.ts`. */
import type { shell as source } from "../es-MX/shell.ts";

export const shell: Record<keyof typeof source, string> = {
  "shell.nav.notifications": "Notifications",
  // Web shell: brand, skip link, sidebar, top bar
  "shell.brand.name": "AedesVision",
  "shell.brand.mark": "AV",
  "shell.a11y.skipToContent": "Skip to content",
  "shell.nav.label": "Main navigation",
  "shell.sidebar.collapse": "Collapse menu",
  "shell.topBar.searchLabel": "Search",
  "shell.topBar.searchPlaceholder": "Search or scan",
  "shell.topBar.notificationsSoon": "Not available yet.",
  "shell.topBar.notifications": "Notifications",
  "shell.language.toEnglish": "ES: change language to English",
  "shell.language.toSpanish": "EN: change language to Spanish",

  "shell.theme.dark": "Dark theme",

  // Web shell: sidebar groups and areas (one entry per area of web/README.md)
  "shell.group.operation": "Operation",
  "shell.group.resources": "Resources",
  "shell.group.analysis": "Analysis and administration",
  "shell.nav.home": "Home",
  "shell.nav.incidents": "Incidents",
  "shell.nav.operations": "Supervision",
  "shell.nav.scheduling": "Planning",
  "shell.nav.quadrants": "Quadrants and sampling",
  "shell.nav.releases": "Releases",
  "shell.nav.community": "Community",
  "shell.nav.inventory": "Inventory",
  "shell.nav.fleet": "Fleet",
  "shell.nav.lab": "Laboratory",
  "shell.nav.people": "People",
  "shell.nav.dashboards": "Dashboards",
  "shell.nav.regulatory": "Regulatory",
  "shell.nav.settings": "Settings",

  // Web user menu (top bar)
  "shell.userMenu.button": "User menu",
  "shell.userMenu.organization": "Organization",
  "shell.userMenu.profiles": "Profiles",
  "shell.userMenu.noProfile": "No profile assigned",
  "shell.userMenu.changeOrganization": "Change organization",
  "shell.userMenu.signOut": "Sign out",
};
