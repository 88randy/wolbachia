/** Mexican Spanish messages of the `hub` area: area home pages (icon cards) and the Home dashboard. */
import type { AreaCatalog } from "../area.ts";

export const hub = {
  "hub.home.greeting": "Hola, {name}",
  "hub.home.subtitle": "Esto es lo que necesita tu atención hoy.",
  "hub.home.shortcuts": "Accesos rápidos",
  "hub.card.open": "Abrir",

  "hub.inventory.description": "Insumos, lotes, ubicaciones y movimientos del almacén.",
  "hub.inventory.transfers": "Envía y recibe material entre ubicaciones.",
  "hub.inventory.discrepancies": "Diferencias entre lo enviado y lo recibido.",
  "hub.inventory.assignments": "Entrega material a repartidores y centros.",
  "hub.inventory.reconciliations": "Cuadra lo entregado contra lo usado.",
  "hub.inventory.writeOffs": "Da de baja material dañado o vencido.",
  "hub.inventory.supplies": "Tipos de insumo y sus reglas de uso.",
  "hub.inventory.lots": "Lotes recibidos, caducidad y condiciones.",
  "hub.inventory.locations": "Almacenes, centros y puntos de resguardo.",

  "hub.operations.description": "Turnos, revisiones y reubicaciones del trabajo de campo.",
  "hub.operations.reviews": "Registros que necesitan una decisión.",
  "hub.operations.relocations": "Solicitudes para mover ovitrampas.",
  "hub.operations.live": "Quién está en campo ahora y por dónde.",
  "hub.operations.shifts": "Turnos cerrados y su resumen del día.",

  "hub.lab.description": "Recepción de bolsas, conteo de huevos y bajas del laboratorio.",
  "hub.lab.bags": "Recibe las bolsas que llegan de campo.",
  "hub.lab.eggCounts": "Cuenta los huevos de cada papeleta.",
  "hub.lab.writeOffs": "Desecha bolsas y material del laboratorio.",
  "hub.lab.history": "Consulta y corrige conteos anteriores.",

  "hub.people.description": "Capacitaciones y evaluaciones del personal.",
  "hub.people.trainings": "Cursos, asistentes y vigencia.",
  "hub.people.evaluations": "Observaciones en campo con su rúbrica.",

  "hub.fleet.description": "Motos, revisiones y servicios.",
  "hub.fleet.motorcycles": "Estado de cada moto, revisiones y servicios.",

  "hub.releases.description": "Permisos de liberación y sus tipos.",
  "hub.releases.permits": "Permisos vigentes, por vencer y suspendidos.",
  "hub.releases.permitTypes": "Tipos de permiso y sus requisitos.",

  "hub.quadrants.description": "Mapa de cuadrantes, puntos y cierres.",
  "hub.notifications.description": "Avisos y alertas para ti.",
  "hub.incidents.description": "Incidencias abiertas y su seguimiento.",
  "hub.settings.description": "Organización, roles, teléfonos y reglas.",
  "hub.settings.incidentTypes": "Tipos de incidencia, gravedad y responsables.",
} as const satisfies AreaCatalog<"hub">;
