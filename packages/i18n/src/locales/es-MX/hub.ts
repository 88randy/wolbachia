/** Mexican Spanish messages of the `hub` area: area home pages (icon cards) and the Home dashboard. */
import type { AreaCatalog } from "../area.ts";

export const hub = {
  "hub.home.greeting": "Hola, {name}",
  "hub.home.subtitle": "Esto es lo que necesita tu atención hoy.",
  "hub.home.shortcuts": "Accesos rápidos",
  "hub.card.open": "Abrir",

  "hub.inventory.description":
    "Aquí ves el camino del material: llega, se guarda, se mueve y se entrega.",
  "hub.inventory.daily": "Trabajo de todos los días",
  "hub.inventory.setup": "Configuración",
  "hub.inventory.setupHint": "Se hace una vez, o cuando abres un almacén o un insumo nuevo.",
  "hub.inventory.setupMissing":
    "Antes de empezar, crea al menos un almacén y registra los insumos que manejas (abajo, en Configuración).",
  "hub.inventory.pill.waiting": "Por atender",
  "hub.inventory.pill.attention": "Necesita atención",
  "hub.inventory.step.receive.title": "Recibir insumos",
  "hub.inventory.step.receive.text":
    "Registra lo que llega: qué insumo es, cuánto, cuándo caduca y en qué almacén se guarda.",
  "hub.inventory.step.receive.empty": "Todavía no hay lotes. Registra el primero.",
  "hub.inventory.step.receive.count": "Lotes registrados: {count}",
  "hub.inventory.step.receive.action": "Recibir insumos",
  "hub.inventory.step.stock.title": "Existencias",
  "hub.inventory.step.stock.text":
    "Mira qué hay en cada almacén y todo lo que ha entrado y salido.",
  "hub.inventory.step.stock.count": "Almacenes y ubicaciones: {count}",
  "hub.inventory.step.stock.action": "Ver existencias",
  "hub.inventory.step.move.title": "Mover entre almacenes",
  "hub.inventory.step.move.text":
    "Manda material de un almacén a otro y confirma lo que llegó, pieza por pieza.",
  "hub.inventory.step.move.count": "Por enviar: {toSend}. Por recibir: {toReceive}.",
  "hub.inventory.step.move.action": "Mover material",
  "hub.inventory.step.differences.title": "Diferencias",
  "hub.inventory.step.differences.text":
    "Cuando lo que llegó no coincide con lo que salió, aquí se revisa y se resuelve.",
  "hub.inventory.step.differences.none": "No hay diferencias abiertas.",
  "hub.inventory.step.differences.count": "Diferencias sin resolver: {count}",
  "hub.inventory.step.differences.action": "Ver diferencias",
  "hub.inventory.step.deliver.title": "Entregar a repartidores",
  "hub.inventory.step.deliver.text":
    "Elige al repartidor, revisa lo que le toca ese día y entrégale los lotes.",
  "hub.inventory.step.deliver.action": "Entregar material",
  "hub.inventory.step.reconcile.title": "Cuadrar entregas",
  "hub.inventory.step.reconcile.text":
    "Al final del día compara lo que se entregó con lo que se usó y lo que regresó.",
  "hub.inventory.step.reconcile.action": "Cuadrar el día",
  "hub.inventory.step.writeOff.title": "Mermas y bajas",
  "hub.inventory.step.writeOff.text":
    "Da de baja el material caducado, dañado o perdido, con su motivo y su evidencia.",
  "hub.inventory.step.writeOff.action": "Registrar una baja",
  "hub.inventory.setup.locations.title": "Almacenes",
  "hub.inventory.setup.locations.text":
    "Los lugares donde se guarda el material, con su responsable y su mapa.",
  "hub.inventory.setup.locations.empty": "No hay almacenes. Crea el primero.",
  "hub.inventory.setup.locations.count": "Registrados: {count}",
  "hub.inventory.setup.supplies.title": "Catálogo de insumos",
  "hub.inventory.setup.supplies.text":
    "Los tipos de insumo que manejas: paletas, bolsas, huevos y sus reglas de uso.",
  "hub.inventory.setup.supplies.empty": "No hay insumos. Registra el primero.",
  "hub.inventory.setup.supplies.count": "Registrados: {count}",

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
  "hub.releases.records": "Liberaciones registradas, con su permiso, lote y punto en el mapa.",
  "hub.releases.devices": "Dispositivos de liberación, su lote de origen y su estado.",
  "hub.community.description": "Actividades con la comunidad: avisos, pláticas y reuniones.",
  "hub.releases.permits": "Permisos vigentes, por vencer y suspendidos.",
  "hub.releases.permitTypes": "Tipos de permiso y sus requisitos.",

  "hub.quadrants.description": "Mapa de cuadrantes, puntos y cierres.",
  "hub.notifications.description": "Avisos y alertas para ti.",
  "hub.incidents.description": "Incidencias abiertas y su seguimiento.",
  "hub.portal.summary": "Indicadores generales del programa.",
  "hub.portal.trends": "Liberaciones por semana.",
  "hub.portal.map": "Cobertura por cuadrante.",
  "hub.settings.description": "Organización, roles, teléfonos y reglas.",
  "hub.settings.incidentTypes": "Tipos de incidencia, gravedad y responsables.",
} as const satisfies AreaCatalog<"hub">;
