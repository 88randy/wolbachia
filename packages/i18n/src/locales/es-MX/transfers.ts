import type { AreaCatalog } from "../area.ts";
export const transfers = {
  "transfers.field.from": "Creada desde",
  "transfers.field.before": "Creada antes de",
  "transfers.write.review": "Revisar estado actual y editar el borrador",
  "transfers.page.title": "Transferencias",
  "transfers.page.preparedOnly":
    "Esta vista permite despachar y recibir transferencias ya preparadas.",
  "transfers.page.denied":
    "Tu alcance no incluye este inventario. Solicita acceso a la administración.",
  "transfers.page.readError":
    "No se pudo consultar la transferencia. Reintenta para revisar su estado actual.",
  "transfers.field.code": "Transferencia",
  "transfers.field.route": "Ruta",
  "transfers.field.origin": "Ubicación de origen",
  "transfers.field.destination": "Ubicación de destino",
  "transfers.state.prepared": "Preparada",
  "transfers.state.dispatched": "En tránsito",
  "transfers.state.received": "Recibida",
  "transfers.state.discrepancy": "Con discrepancia",
  "transfers.state.resolved": "Resuelta",
  "transfers.event.prepared": "Preparación",
  "transfers.event.dispatch": "Despacho firmado",
  "transfers.event.receive": "Recepción firmada",
  "transfers.event.resolution": "Resolución",
  "transfers.history.title": "Manifiesto original e historial",
  "transfers.history.revision": "Revisión {revision}",
  "transfers.history.evidence": "Evidencia {role}",
  "transfers.signature.sender": "Firma de quien entrega",
  "transfers.signature.receiver": "Firma de recibido",
  "transfers.action.dispatch": "Firmar y despachar",
  "transfers.action.receive": "Firmar recepción",
  "transfers.action.discrepancies": "Ver discrepancias",
  "transfers.scan.label": "Escanear identidad del manifiesto",
  "transfers.scan.hint":
    "Usa la identidad de línea, pieza o lote del manifiesto. Un código desconocido se registra como sobrante sin abonar inventario.",
  "transfers.scan.quantity": "Cantidad escaneada",
  "transfers.scan.add": "Registrar escaneo",
  "transfers.scan.ready": "Listo para escanear",
  "transfers.scan.accepted": "Escaneo registrado en el borrador. Falta firmar la recepción.",
  "transfers.scan.duplicate": "Pieza duplicada: ya estaba escaneada. No se contó otra vez.",
  "transfers.scan.extra":
    "Sobrante sin identificar. Queda sin abonar y abrirá una discrepancia al firmar.",
  "transfers.scan.invalid":
    "Revisa la cantidad: debe ser positiva y no superar lo esperado. Cada pieza se cuenta una vez.",
  "transfers.scan.ambiguous":
    "El lote tiene varias líneas. Escanea la identidad exacta de la línea o pieza.",
  "transfers.line.count": "Esperado: {expected} · escaneado: {received}",
  "transfers.line.photo": "Foto del faltante: {id}",
  "transfers.write.dispatchRule":
    "Verifica la firma antes de despachar. Se revisan existencias, caducidad y destino; administración o almacén debe resolver cualquier bloqueo.",
  "transfers.write.receiveRule":
    "Cada faltante necesita una foto verificada, separada de la firma. Al firmar se guardan las cantidades reales y las discrepancias; solo su resolución libera los bloqueos propios.",
  "transfers.write.committed": "Guardado",
  "transfers.write.retry": "Reintentar el mismo envío",
  "transfers.write.retained":
    "Se conservó el envío original. Reintentar usa la misma identidad y cantidades; no genera un segundo movimiento. Revisa el estado y los bloqueos antes de iniciar otra operación.",
  "transfers.write.failed":
    "No se confirmó el envío. Reintenta el mismo envío o revisa el historial y los bloqueos con almacén.",
  "transfers.write.wait": "Hay mucha actividad. Espera un momento antes de reintentar.",
} as const satisfies AreaCatalog<"transfers">;
