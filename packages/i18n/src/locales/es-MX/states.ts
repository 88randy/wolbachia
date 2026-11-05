/** Mexican Spanish messages of the `states` area. Source of the `states.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const states = {
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
  "states.sessionCheck.title": "No pudimos verificar tu sesión",
  "states.sessionCheck.body":
    "Otra pestaña cambió la sesión y no logramos confirmar quién eres. No mostramos datos de la organización hasta saberlo. Revisa tu conexión y reintenta.",
  "states.offline.banner":
    "Sin conexión. Lo que ves puede no estar actualizado; se actualizará cuando vuelva la red.",
} as const satisfies AreaCatalog<"states">;
