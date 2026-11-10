import type { AreaCatalog } from "../area.ts";
export const discrepancies = {
  "discrepancies.page.title": "Discrepancias",
  "discrepancies.page.denied":
    "No tienes permiso o alcance para consultar discrepancias. Solicita acceso al administrador.",
  "discrepancies.page.readError": "No se pudo consultar la discrepancia. Vuelve a intentarlo.",
  "discrepancies.field.code": "Número",
  "discrepancies.field.search": "Buscar discrepancias",
  "discrepancies.field.transfer": "Transferencia",
  "discrepancies.field.status": "Estado",
  "discrepancies.field.createdAt": "Registrada",
  "discrepancies.status.open": "Abierta",
  "discrepancies.status.closed": "Cerrada",
  "discrepancies.kind.missing": "Faltante",
  "discrepancies.kind.identifiedExtra": "Sobrante identificado",
  "discrepancies.kind.unidentifiedExtra": "Sobrante sin identificar",
  "discrepancies.holds.explanation":
    "Se muestran únicamente los bloqueos de esta discrepancia. Cerrarla conserva los bloqueos de otros registros; el servidor confirma la disponibilidad.",
  "discrepancies.holds.active": "Bloqueo pendiente",
  "discrepancies.holds.released": "Bloqueo resuelto por esta discrepancia",
  "discrepancies.actions.back": "Volver a discrepancias",
  "discrepancies.history.title": "Manifiestos e historial firmados",
  "discrepancies.history.hash": "Huella del manifiesto original",
  "discrepancies.history.bulk": "Por lote",
  "discrepancies.history.evidence": "Evidencia verificada",
  "discrepancies.history.received": "Recibido",
  "discrepancies.event.prepared": "Preparada",
  "discrepancies.event.dispatch": "Despacho firmado",
  "discrepancies.event.receive": "Recepción firmada",
  "discrepancies.event.resolution": "Resolución",
  "discrepancies.close.title": "Resolver discrepancia",
  "discrepancies.close.reason": "Motivo de la resolución",
  "discrepancies.close.reasonHint": "Describe cómo se resolvió. Longitud mínima: {min} caracteres.",
  "discrepancies.close.outcome": "Cómo se resolvió esta línea",
  "discrepancies.close.signature": "Nueva firma de recibido",
  "discrepancies.close.photo": "Foto del material recuperado o devuelto",
  "discrepancies.close.requirements":
    "Elige una resolución para cada línea y explica el motivo. Recuperar o devolver material requiere firma y foto verificadas; lo registra quien tenga permiso de recepción y cierre.",
  "discrepancies.close.correctionPermission":
    "Un sobrante requiere una recepción correctiva real. Solicita a quien tenga permiso de transferencias que registre y vincule la corrección.",
  "discrepancies.close.offline":
    "Sin conexión. Conservamos tu captura; reconéctate y actualiza antes de resolver.",
  "discrepancies.close.confirmTitle": "Confirmar resolución de discrepancia",
  "discrepancies.close.consequence":
    "La resolución es definitiva. Solo dispone los bloqueos propios; no borra el manifiesto firmado ni elimina otros bloqueos. Reconocer un faltante no agrega existencias.",
  "discrepancies.close.action": "Revisar y cerrar discrepancia",
  "discrepancies.close.confirm": "Confirmar resolución",
  "discrepancies.close.saved": "Resolución registrada en el servidor",
  "discrepancies.close.uncertain":
    "No se confirmó la respuesta. Conservamos la resolución exacta; consulta el estado o reintenta la misma solicitud.",
  "discrepancies.close.failed":
    "La resolución necesita revisión. Conservamos la captura; actualiza el estado o vuelve a intentarlo.",
  "discrepancies.close.retry": "Reintentar la misma resolución",
  "discrepancies.close.review": "Actualizar y revisar el estado",
  "discrepancies.outcome.choose": "Elige una resolución",
  "discrepancies.outcome.ackMissing": "Reconocer faltante sin agregar existencias",
  "discrepancies.outcome.recoverDest": "Recibir material recuperado en destino",
  "discrepancies.outcome.returnOrigin": "Recibir devolución en origen",
  "discrepancies.outcome.referenceSignedCorrection": "Vincular recepción correctiva firmada",
  "discrepancies.correction.code": "Código de la transferencia correctiva",
  "discrepancies.correction.find": "Consultar transferencia correctiva",
  "discrepancies.correction.receipt": "Recepción correctiva firmada",
  "discrepancies.correction.unavailable":
    "La transferencia o su recepción firmada no están disponibles. Revisa el código e intenta de nuevo.",
  "discrepancies.correction.requirements":
    "El servidor verifica el mismo destino, el material y la cantidad recibida disponible de la corrección. Vincularla no genera otro ingreso.",
} as const satisfies AreaCatalog<"discrepancies">;
