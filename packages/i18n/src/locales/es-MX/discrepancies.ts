import type { AreaCatalog } from "../area.ts";
export const discrepancies = {
  "discrepancies.page.title": "Diferencias",
  "discrepancies.page.denied":
    "No tienes permiso o alcance para consultar discrepancias. Solicita acceso al administrador.",
  "discrepancies.page.readError": "No se pudo consultar la discrepancia. Vuelve a intentarlo.",
  "discrepancies.field.code": "Número",
  "discrepancies.field.search": "Buscar diferencias",
  "discrepancies.field.transfer": "Envío",
  "discrepancies.field.status": "Estado",
  "discrepancies.field.createdAt": "Registrada",
  "discrepancies.status.open": "Abierta",
  "discrepancies.status.closed": "Cerrada",
  "discrepancies.kind.missing": "Faltante",
  "discrepancies.kind.identifiedExtra": "Sobrante identificado",
  "discrepancies.kind.unidentifiedExtra": "Sobrante sin identificar",
  "discrepancies.holds.explanation":
    "Se muestran únicamente los bloqueos de esta discrepancia. Cerrarla conserva los bloqueos de otros registros; la disponibilidad se confirma al guardar.",
  "discrepancies.holds.active": "Bloqueo pendiente",
  "discrepancies.holds.released": "Bloqueo resuelto por esta discrepancia",
  "discrepancies.actions.back": "Volver a diferencias",
  "discrepancies.history.title": "Manifiestos e historial firmados",
  "discrepancies.history.hash": "Huella del manifiesto original",
  "discrepancies.history.bulk": "Por lote",
  "discrepancies.history.evidence": "Evidencia verificada",
  "discrepancies.history.received": "Recibido",
  "discrepancies.event.prepared": "Preparada",
  "discrepancies.event.dispatch": "Despacho firmado",
  "discrepancies.event.receive": "Recepción firmada",
  "discrepancies.event.resolution": "Resolución",
  "discrepancies.close.title": "Resolver la diferencia",
  "discrepancies.close.reason": "Motivo de la resolución",
  "discrepancies.close.reasonHint": "Describe cómo se resolvió. Longitud mínima: {min} caracteres.",
  "discrepancies.close.outcome": "¿Cómo se resolvió?",
  "discrepancies.close.signature": "Firma de quien recibe lo recuperado",
  "discrepancies.close.photo": "Foto de lo recuperado o devuelto",
  "discrepancies.close.requirements":
    "Para recuperar o devolver material hacen falta una firma y una foto. Dar por perdido solo pide el motivo.",
  "discrepancies.close.correctionPermission":
    "Un sobrante requiere una recepción correctiva real. Solicita a quien tenga permiso de transferencias que registre y vincule la corrección.",
  "discrepancies.close.offline":
    "Sin conexión. Conservamos tu captura; reconéctate y actualiza antes de resolver.",
  "discrepancies.close.confirmTitle": "Resolver la diferencia",
  "discrepancies.close.consequence":
    "Una vez resuelta ya no se puede cambiar. Dar por perdido no suma nada al inventario.",
  "discrepancies.close.action": "Resolver",
  "discrepancies.close.confirm": "Sí, resolver",
  "discrepancies.close.saved": "Resolución registrada",
  "discrepancies.close.uncertain":
    "No se confirmó la respuesta. Conservamos la resolución exacta; consulta el estado o reintenta la misma solicitud.",
  "discrepancies.close.failed":
    "La resolución necesita revisión. Conservamos la captura; actualiza el estado o vuelve a intentarlo.",
  "discrepancies.close.retry": "Reintentar la misma resolución",
  "discrepancies.close.review": "Actualizar y revisar el estado",
  "discrepancies.outcome.choose": "¿Qué pasó con esto?",
  "discrepancies.outcome.ackMissing": "Dar por perdido",
  "discrepancies.outcome.recoverDest": "Registrar lo que se recuperó en el destino",
  "discrepancies.outcome.returnOrigin": "Registrar lo que regresó al origen",
  "discrepancies.outcome.referenceSignedCorrection": "Ya hay una recepción firmada que lo corrige",
  "discrepancies.correction.code": "Código de la transferencia correctiva",
  "discrepancies.correction.find": "Consultar transferencia correctiva",
  "discrepancies.correction.receipt": "Recepción correctiva firmada",
  "discrepancies.correction.unavailable":
    "La transferencia o su recepción firmada no están disponibles. Revisa el código e intenta de nuevo.",
  "discrepancies.correction.requirements":
    "Se verifica el mismo destino, el material y la cantidad recibida disponible de la corrección. Vincularla no genera otro ingreso.",
  "discrepancies.history.piece": "Pieza",
  "discrepancies.record.subtitle": "Del envío {transfer}",
} as const satisfies AreaCatalog<"discrepancies">;
