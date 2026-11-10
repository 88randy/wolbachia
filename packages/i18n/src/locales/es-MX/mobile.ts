/** Mexican Spanish messages of the `mobile` area (courier app shell and sync inbox). Source of the `mobile.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const mobile = {
  "mobile.scanner.title": "Escanear código",
  "mobile.scanner.hint": "Apunta al código QR del programa.",
  "mobile.scanner.start": "Usar cámara",
  "mobile.scanner.manual": "Escribir código",
  "mobile.scanner.code": "Código impreso debajo del QR",
  "mobile.scanner.lookup": "Buscar código",
  "mobile.scanner.torchOn": "Encender linterna",
  "mobile.scanner.torchOff": "Apagar linterna",
  "mobile.scanner.denied":
    "La app no puede usar la cámara. Actívala en Ajustes del teléfono › Permisos › Cámara, o escribe el código.",
  "mobile.scanner.settings": "Abrir ajustes del teléfono",
  "mobile.scanner.cameraFailed":
    "No pudimos abrir la cámara. Intenta de nuevo o escribe el código impreso.",
  "mobile.scanner.damaged":
    "Si el código no se lee, limpia la etiqueta, enciende la linterna o escribe el código impreso.",
  "mobile.scanner.retry": "Escanear de nuevo",
  "mobile.scanner.resume": "Continuar captura guardada en el teléfono",
  "mobile.scanner.loading": "Buscando en la copia descargada…",
  "mobile.scanner.report": "Reportar daño o caducidad",
  "mobile.scanner.invalid":
    "No pudimos reconocer este código. Busca la etiqueta del programa o escribe el código impreso.",
  "mobile.scanner.version":
    "Esta versión de código no es compatible. Escribe el código impreso o consulta a tu supervisor.",
  "mobile.scanner.kind":
    "Este tipo de código no corresponde a esta captura. Escanea la etiqueta solicitada o escribe su código.",
  "mobile.scanner.unavailable":
    "Este registro no está disponible en tu copia descargada. Escanea otro código o consulta a tu supervisor.",
  "mobile.scanner.retired":
    "Esta ovitrampa está retirada. Escanea otra etiqueta o avisa a tu supervisor si la encontraste en campo.",
  "mobile.scanner.duplicate":
    "Ya se leyó este código. Puedes continuar la captura o escanear de nuevo; no se agregó otro registro.",
  "mobile.scanner.storage":
    "No pudimos guardar el cambio en el teléfono. Conserva tu captura e intenta de nuevo.",
  "mobile.scanner.supplyTitle": "Detalle de insumo",
  "mobile.scanner.lot": "Identificador del lote",
  "mobile.scanner.quantity": "Cantidad prevista en el plan descargado",
  "mobile.scanner.unit": "Identificador de la versión de unidad",
  "mobile.scanner.assignment": "Asignación de origen",
  "mobile.scanner.date": "Fecha de la asignación",
  "mobile.scanner.revision": "Revisión del plan descargado",
  "mobile.scanner.sourceLine": "Renglón de origen",
  "mobile.scanner.missingMetadata":
    "La copia descargada no incluye nombres de insumo o unidad, código impreso del lote ni caducidad. Esta cantidad es del plan; no confirma recepción ni existencias. Consulta la etiqueta o a tu supervisor.",
  "mobile.shiftClose.refreshSupplies": "Actualizar recepciones descargadas",
  "mobile.shiftClose.sourceFrame":
    "Saldo confirmado descargado; las declaraciones adicionales se muestran debajo.",

  "mobile.shiftClose.title": "Cerrar jornada",
  "mobile.shiftClose.closedTitle": "Jornada cerrada",
  "mobile.shiftClose.phoneClosed": "Cerrada en el tel?fono",
  "mobile.shiftClose.serverReceived": "El servidor recibi? los registros de cierre",
  "mobile.shiftClose.inReview": "El servidor recibi? un registro para revisi?n",
  "mobile.shiftClose.rejected":
    "Un registro fue rechazado. Revisa la bandeja; la jornada sigue cerrada en el tel?fono.",
  "mobile.shiftClose.pending": "Puntos pendientes",
  "mobile.shiftClose.noPending": "No hay puntos pendientes en la copia descargada.",
  "mobile.shiftClose.goNow": "Ir al d?a",
  "mobile.shiftClose.leavePending": "Cerrar sin completar este punto",
  "mobile.shiftClose.leftPending": "Confirmado: el punto queda pendiente",
  "mobile.shiftClose.planned": "Asignado por almac?n",
  "mobile.shiftClose.equation": "Recibido ? usado ? devuelto ? merma",
  "mobile.shiftClose.difference": "Diferencia",
  "mobile.shiftClose.unknown": "Sin dato confirmado",
  "mobile.shiftClose.supplies": "Conciliaci?n de insumos",
  "mobile.shiftClose.differenceAllowed":
    "Las diferencias quedan para revisi?n y no impiden cerrar. La devoluci?n es una declaraci?n; almac?n confirma su recepci?n.",
  "mobile.shiftClose.suppliesUnavailable":
    "No hay una recepci?n descargada vinculada a esta jornada. Los saldos y la conciliaci?n quedan sin confirmar; puedes cerrar.",
  "mobile.shiftClose.returnQuantity": "Cantidad adicional que devuelves",
  "mobile.shiftClose.returnDestination": "Devoluci?n al almac?n de origen",
  "mobile.shiftClose.odometer": "Od?metro al cerrar (km)",
  "mobile.shiftClose.note": "Nota de cierre (opcional)",
  "mobile.shiftClose.lowOdometer":
    "El od?metro es menor que al abrir. Se conservar? para revisi?n; puedes cerrar en el tel?fono.",
  "mobile.shiftClose.confirmTitle": "?Cerrar la jornada?",
  "mobile.shiftClose.confirmHint":
    "Se guardar? en este tel?fono y dejar?s de capturar y recopilar ubicaci?n en esta jornada. Los puntos pendientes no se completar?n.",
  "mobile.shiftClose.close": "Cerrar jornada en el tel?fono",
  "mobile.shiftClose.continue": "Revisar y confirmar cierre",
  "mobile.shiftClose.retryHint":
    "Lo pendiente se reintentar? al recuperar la sesi?n y la conexi?n. No desinstales la app. Los adjuntos pendientes y los rechazos se consultan en la bandeja.",
  "mobile.shiftClose.reviewHistory": "Historial de revisi?n",
  "mobile.shiftClose.notReviewed": "Sin decisi?n de supervisor descargada.",
  "mobile.shiftClose.observed": "Observada por supervisor",
  "mobile.shiftClose.approved": "Aprobaci?n vigente",
  "mobile.shiftClose.staleApproval": "Aprobaci?n anterior; requiere nueva revisi?n",
  "mobile.shiftClose.noShift": "No hay una jornada local para cerrar. Vuelve al inicio.",
  "mobile.shiftClose.saveFailed":
    "No se guard? el cambio. Conservamos tus entradas. Revisa los pendientes, cantidades y motivos, y vuelve a intentar; si contin?a, revisa el almacenamiento con tu supervisor.",
  "mobile.shiftClose.shrinkageQuantity": "Cantidad adicional de merma",
  "mobile.shiftClose.reason": "Motivo de merma (10 a 1000 caracteres)",
  "mobile.shiftClose.photo": "Tomar foto de merma",
  "mobile.shiftClose.photoRequired": "La merma requiere una foto y un motivo de cat?logo.",
  "mobile.shiftClose.photoSaved": "Foto guardada en el tel?fono; pendiente de entrega",
  "mobile.shiftOpen.closed": "La jornada est? cerrada en este tel?fono. Consulta su resumen.",

  "mobile.unlock.greetingNeutral": "Hola",
  "mobile.shiftOpen.severeSaved":
    "No puedes salir con esta moto por una falla grave. Avisa a tu supervisor para que gestione la liberación de flota.",
  "mobile.shiftOpen.receivedRejected": "Recibido por el servidor · Apertura rechazada",
  "mobile.shiftOpen.receivedInReview": "Recibido por el servidor · En revisión",
  "mobile.preview.title": "Vista de estilos",
  "mobile.preview.sample": "Ejemplo",
  "mobile.preview.intro":
    "Ejemplos de interfaz sin datos reales. No guardan cambios ni envían registros.",
  "mobile.preview.themeHint": "Sigue el teléfono o elige una apariencia.",
  "mobile.preview.textScaleHint":
    "Para revisar texto al 130 %, usa el tamaño de texto del teléfono.",
  "mobile.preview.system": "Sistema",
  "mobile.preview.light": "Claro",
  "mobile.preview.dark": "Oscuro",
  "mobile.preview.toggleTheme": "Cambiar apariencia",
  "mobile.preview.primary": "Terminar revisión",
  "mobile.preview.data": "Datos de ejemplo",
  "mobile.preview.progress": "Puntos revisados · meta del día",
  "mobile.preview.received": "Recibido",
  "mobile.preview.onPhone": "En el teléfono",
  "mobile.preview.problem": "Con problema",
  "mobile.preview.review": "En revisión",
  "mobile.preview.inactive": "Sin actividad",
  "mobile.preview.fields": "Captura",
  "mobile.preview.code": "Código de ejemplo",
  "mobile.preview.disabled": "Acción no disponible",
  "mobile.preview.disabledHint":
    "Ejemplo: falta una configuración. Tu supervisor puede habilitar esta acción.",
  "mobile.preview.loading": "Cargando en el teléfono",
  "mobile.preview.empty": "Aún sin registros",
  "mobile.preview.partial": "El resto sigue disponible",
  "mobile.preview.error":
    "No se pudo actualizar este ejemplo. Reintenta; lo que capturaste sigue aquí.",
  "mobile.preview.retryResult": "Reintento de ejemplo completado. No se contactó al servidor.",
  "mobile.lifecycle.replace": "Sustituir ovitrampa",
  "mobile.lifecycle.relocate": "Proponer reubicaci?n",
  "mobile.lifecycle.remove": "Retirar ovitrampa",
  "mobile.lifecycle.fixedCode":
    "El folio del punto se conserva. La sustituci?n usa una nueva identidad f?sica.",
  "mobile.lifecycle.source": "Ovitrampa de origen",
  "mobile.lifecycle.replacement": "Nueva identidad f?sica",
  "mobile.lifecycle.proposalOnly":
    "Se guardar? como propuesta. La ubicaci?n autorizada del punto permanece igual hasta una decisi?n sincronizada.",
  "mobile.lifecycle.proposedLocation": "Ubicaci?n propuesta (longitud, latitud)",
  "mobile.lifecycle.closedWeeks": "Semanas consecutivas con casa cerrada (regla descargada):",
  "mobile.lifecycle.confirmedCount": "Incidencias conocidas (regla descargada):",
  "mobile.lifecycle.noIncidentHistory":
    "Sin historial local de incidencias; no se calcula esa sugerencia.",
  "mobile.lifecycle.inspectHistory":
    "Revisa el historial antes de proponer. La sugerencia es orientativa.",
  "mobile.lifecycle.gpsRequired":
    "Falta GPS. Int?ntalo de nuevo; no se puede guardar sin ubicaci?n.",
  "mobile.lifecycle.gpsCaptured": "GPS capturado en el tel?fono",
  "mobile.lifecycle.captureGps": "Capturar ubicaci?n GPS",
  "mobile.lifecycle.recovery": "?Recuperaste la ovitrampa? Elige una opci?n.",
  "mobile.lifecycle.recovered": "Recuperada: la llevo de regreso",
  "mobile.lifecycle.unrecovered": "No recuperada: no la encontr?",
  "mobile.lifecycle.unconfirmed": "Recuperaci?n sin confirmar",
  "mobile.lifecycle.recoveryNotice":
    "La recuperaci?n queda pendiente. Sin confirmar se conserva en el tel?fono y se reporta como no recuperada al servidor.",
  "mobile.lifecycle.reason": "Motivo del cat?logo descargado",
  "mobile.lifecycle.chooseReason": "Elegir motivo",
  "mobile.lifecycle.other": "Otro: describe el motivo (m?ximo 1000 caracteres)",
  "mobile.lifecycle.incidentNotice":
    "El servidor vincular? el hallazgo con una incidencia cuando aplique la captura. El tel?fono no crea una incidencia.",
  "mobile.lifecycle.photoRequired": "Agrega al menos una foto de esta captura antes de guardar.",
  "mobile.lifecycle.capturePhoto": "Agregar foto de evidencia",
  "mobile.lifecycle.discardPhoto": "Quitar foto del borrador",
  "mobile.lifecycle.photoDiscarded": "Foto retirada del borrador. Puedes deshacerlo.",
  "mobile.lifecycle.undo": "Deshacer",
  "mobile.lifecycle.reviewAcknowledge":
    "Entiendo que el GPS, distancia o reglas desactualizadas requieren revisi?n del servidor.",
  "mobile.lifecycle.download": "Descargar cat?logos y reglas de ciclo de vida",
  "mobile.lifecycle.adopt": "Revisar y usar cat?logos y reglas descargados",
  "mobile.lifecycle.begin": "Iniciar captura para este punto",
  "mobile.lifecycle.loading": "Cargando borrador local?",
  "mobile.lifecycle.empty":
    "Inicia la captura desde la ovitrampa seleccionada. Si falta configuraci?n, desc?rgala primero.",
  "mobile.lifecycle.confirmRemove": "Revisar y confirmar retiro",
  "mobile.lifecycle.removeConsequence":
    "El punto quedar? sin esta ovitrampa. Para corregir se agrega una anulaci?n con motivo; la evidencia se conserva.",
  "mobile.lifecycle.save": "Guardar en el tel?fono",
  "mobile.lifecycle.incomplete":
    "Captura incompleta: revisa motivo, Otro, GPS, foto y recuperaci?n. El borrador se conserva.",
  "mobile.lifecycle.proposed": "Propuesta",
  "mobile.lifecycle.approved": "Aprobada",
  "mobile.lifecycle.rejected": "Rechazada",
  "mobile.lifecycle.reviewAccepted":
    "Resultado del servidor: aceptado. Revisi?n del supervisor: sin confirmaci?n.",
  "mobile.lifecycle.reviewRejected":
    "Resultado del servidor: rechazado. Conserva la evidencia y consulta al supervisor.",
  "mobile.lifecycle.decisionPending": "Decisi?n del supervisor: pendiente de sincronizar",
  "mobile.lifecycle.nextTask": "Tarea recibida al sincronizar",
  "mobile.lifecycle.noTask": "Sin tarea sincronizada; no hay asignaci?n local anticipada.",
  "mobile.lifecycle.history": "Historial de ciclo de vida y correcciones",
  "mobile.lifecycle.voided": "Anulaci?n registrada; se conserva el original",
  "mobile.lifecycle.correctionReason":
    "Motivo de correcci?n (de 10 caracteres visibles a 1000 caracteres)",
  "mobile.lifecycle.correct": "Anular con motivo conservando evidencia",
  "mobile.lifecycle.scopeBlocked":
    "Este punto ya no est? en tu alcance descargado. El borrador se conserva; consulta al supervisor.",
  "mobile.lifecycle.noCamera":
    "La c?mara no est? disponible. Conserva el borrador e intenta de nuevo en un equipo habilitado.",
  "mobile.lifecycle.noReasons": "Falta el cat?logo de motivos. Desc?rgalo antes de continuar.",

  "mobile.ovitrap.pendingDraft":
    "Ya tienes un borrador de otra captura. Continúa ese borrador antes de cambiar de ovitrampa.",
  // M-08: P13, P14 and P21
  "mobile.ovitrap.open": "Colocar o revisar ovitrampas",
  "mobile.ovitrap.place": "Colocar ovitrampa",
  "mobile.ovitrap.check": "Revisar ovitrampa",
  "mobile.ovitrap.next": "Continuar",
  "mobile.ovitrap.save": "Guardar en el teléfono",
  "mobile.ovitrap.point": "Elige un punto de tu asignación",
  "mobile.ovitrap.finding": "¿Cómo la encontraste?",
  "mobile.ovitrap.paddle": "¿Todavía tiene papeleta?",
  "mobile.ovitrap.eggs": "¿Tiene huevos?",
  "mobile.ovitrap.yes": "Sí",
  "mobile.ovitrap.no": "No",
  "mobile.ovitrap.conditions": "Condiciones del sitio",
  "mobile.ovitrap.temperature": "Temperatura (°C, opcional)",
  "mobile.ovitrap.humidity": "Humedad (%, opcional)",
  "mobile.ovitrap.paddleType": "Tipo de papeleta",
  "mobile.ovitrap.other": "Especifica qué encontraste (obligatorio para Otro)",
  "mobile.ovitrap.bag": "Código humano de la bolsa",
  "mobile.ovitrap.scanBag": "Escanear bolsa",
  "mobile.ovitrap.bagHint":
    "Una bolsa por lectura. Escribe el folio y la fecha; dobla hacia dentro. El laboratorio cuenta los huevos.",
  "mobile.ovitrap.lagged": "Marcar lectura desfasada",
  "mobile.ovitrap.laggedHint":
    "La papeleta desfasada sí va al laboratorio y se puede contar. El servidor determina su exclusión de los índices.",
  "mobile.ovitrap.prepare": "Preparar y reinstalar",
  "mobile.ovitrap.clean": "Lavé y tallé el bote",
  "mobile.ovitrap.water": "Agua limpia a tres cuartas partes, sin cloro ni larvicida",
  "mobile.ovitrap.liner": "Papeleta cubre todo el interior",
  "mobile.ovitrap.shade": "A la sombra, entre plantas",
  "mobile.ovitrap.height": "Hasta 1.5 m de altura",
  "mobile.ovitrap.containers": "Lejos de otros recipientes con agua",
  "mobile.ovitrap.safe": "Fuera del alcance de niños y animales",
  "mobile.ovitrap.marked": "Marqué la fachada con OV y el folio",
  "mobile.ovitrap.newPaddle": "Papeleta nueva",
  "mobile.ovitrap.reuse": "Papeleta reutilizada autorizada",
  "mobile.ovitrap.reuseUnavailable":
    "Solo se ofrece reutilización con elegibilidad descargada. Nunca una tercera reutilización.",
  "mobile.ovitrap.supplies": "Referencias UUID de insumos, separadas por coma",
  "mobile.ovitrap.photo": "Agregar evidencia fotográfica",
  "mobile.camera.undo": "Quitar esta foto del borrador",
  "mobile.ovitrap.concurrentEdit":
    "El borrador cambió mientras se guardaba. Tus cambios siguen pendientes; vuelve a intentar guardarlos.",
  "mobile.camera.ownerRequired":
    "Vuelve a iniciar sesión para confirmar la cuenta antes de tomar la foto. Tu borrador sigue en el teléfono.",
  "mobile.camera.fileType":
    "La foto tiene un formato no compatible. Vuelve a tomarla en JPEG o PNG; tu borrador sigue en el teléfono.",
  "mobile.camera.fileSize":
    "La foto no tiene un tamaño válido. Ajusta la resolución de la cámara y vuelve a tomarla; tu borrador sigue en el teléfono.",
  "mobile.camera.permissionDenied":
    "No se agregó una foto. Permite usar la cámara e inténtalo de nuevo; tu borrador sigue en el teléfono.",
  "mobile.camera.permissionBlocked":
    "La cámara está bloqueada. Habilítala en los ajustes de la aplicación o pide ayuda; tu borrador sigue en el teléfono.",
  "mobile.camera.resultInvalid":
    "La cámara no entregó una foto válida. Inténtalo de nuevo; tu borrador sigue en el teléfono.",
  "mobile.camera.busy": "Hay una captura en curso. Regresa de la cámara y vuelve a intentarlo.",
  "mobile.camera.unlockRequired":
    "Desbloquea la aplicación y vuelve a tomar la foto. Tu borrador sigue en el teléfono.",
  "mobile.camera.fileFailed":
    "No se pudo guardar la foto en el teléfono. Revisa el espacio disponible e intenta tomarla de nuevo; tu borrador sigue en el teléfono.",
  "mobile.ovitrap.photoUnavailable":
    "La cámara de evidencia no está disponible en esta compilación. Conserva el borrador y pide ayuda si el catálogo requiere foto.",
  "mobile.ovitrap.refresh": "Descargar catálogos y reglas",
  "mobile.ovitrap.adopt": "Revisar y usar las versiones descargadas",
  "mobile.ovitrap.catalogChanged":
    "Hay un catálogo nuevo. Conservamos tus respuestas y etiquetas históricas; revisa antes de cambiar de versión.",
  "mobile.ovitrap.confirm": "Revisa antes de guardar",
  "mobile.ovitrap.phoneSaved": "Guardado en el teléfono",
  "mobile.ovitrap.serverPending": "Recepción del servidor: pendiente",
  "mobile.ovitrap.serverReceived": "Recibido por el servidor",
  "mobile.ovitrap.reviewPending": "Revisión: pendiente; pide ayuda a tu supervisor",
  "mobile.ovitrap.reviewUnknown": "Revisión del supervisor: sin confirmación",
  "mobile.ovitrap.repeat":
    "Ya registraste esta ovitrampa en la misma semana. Puedes anular con motivo y registrar una lectura nueva. La evidencia original se conserva.",
  "mobile.ovitrap.correct": "Anular con motivo y registrar nueva",
  "mobile.ovitrap.reason": "Motivo: de 10 caracteres visibles a 1000 caracteres",
  "mobile.ovitrap.reasonCode": "Motivo del catálogo",
  "mobile.ovitrap.newBag":
    "Usa un código de bolsa nuevo: los códigos anteriores quedan reservados.",
  "mobile.ovitrap.scan": "Escanear ovitrampa",
  "mobile.ovitrap.manual": "Escribir código manualmente",
  "mobile.ovitrap.manualHint":
    "La captura manual queda marcada. Usa el UUID físico de la ovitrampa o el código humano de la bolsa.",
  "mobile.ovitrap.code": "Código",
  "mobile.ovitrap.lookup": "Usar código",
  "mobile.ovitrap.invalid": "Este código no es válido para esta operación",
  "mobile.ovitrap.invalidHint":
    "Busca la etiqueta correcta del programa y vuelve a intentar, o escribe el código manualmente.",
  "mobile.ovitrap.retry": "Escanear de nuevo",
  "mobile.ovitrap.scannerUnavailable":
    "El escáner no está disponible en esta compilación. Escribe el código manualmente.",
  "mobile.ovitrap.gps":
    "La ubicación falta o su precisión no cumple las reglas descargadas. Intenta obtener GPS o guarda para revisión si la política lo permite.",
  "mobile.ovitrap.stale":
    "Las reglas cambiaron o vencieron. Descarga la versión vigente o conserva la captura para revisión si la política lo permite.",
  "mobile.ovitrap.distance":
    "Estás lejos del punto según las reglas descargadas. Acércate o conserva la captura para revisión.",
  "mobile.ovitrap.location":
    "No conocemos el punto de esta ovitrampa en el teléfono. El servidor revisará ubicación y alcance; no confirmamos cumplimiento.",
  "mobile.ovitrap.acknowledge": "Entiendo que la captura requiere revisión del servidor",
  "mobile.ovitrap.retryGps": "Intentar GPS de nuevo",
  "mobile.ovitrap.shiftBlocked":
    "La jornada no permite capturar ni guardar. Revisa la apertura con tu supervisor; el borrador se conserva.",
  "mobile.ovitrap.staleWeekContext":
    "Falta la configuraci?n vigente de semana y zona horaria de la organizaci?n. Actualiza el contexto antes de guardar; el borrador se conserva.",
  "mobile.ovitrap.staleView":
    "La captura que ves cambió. No se aplicó esta acción. Actualiza la vista y vuelve a intentarlo.",
  "mobile.ovitrap.immutableEdit":
    "La edición tardía no se guardó y se descartó. Inicia una nueva captura o usa una corrección.",
  "mobile.ovitrap.gateShift": "Abre una jornada antes de guardar. El borrador se conserva.",
  "mobile.ovitrap.gateAssignment":
    "Falta la asignación con alcance explícito y semana epidemiológica. Descárgala antes de guardar.",
  "mobile.ovitrap.gateCatalog": "Falta el catálogo. Descárgalo antes de guardar.",
  "mobile.ovitrap.gateRules": "Faltan reglas utilizables. Descárgalas antes de guardar.",
  "mobile.ovitrap.gatePoint": "Elige un punto permitido y verifica las referencias de insumos.",
  "mobile.ovitrap.gateFinding": "Elige un hallazgo del catálogo guardado.",
  "mobile.ovitrap.gatePaddle": "Confirma la presencia y el tipo de papeleta.",
  "mobile.ovitrap.gateEggs": "Confirma Sí o No: ¿tiene huevos?",
  "mobile.ovitrap.gateBag": "Escribe el código humano de la bolsa.",
  "mobile.ovitrap.gateConditions":
    "Revisa temperatura y humedad. La humedad debe estar entre 0 y 100 %.",
  "mobile.ovitrap.gateOther": "Otro requiere una descripción de hasta 1000 caracteres.",
  "mobile.ovitrap.gatePrepare": "Completa la preparación antes de guardar.",
  "mobile.ovitrap.gateEvidence":
    "Este catálogo requiere evidencia fotográfica. Conserva el borrador y pide ayuda.",
  "mobile.ovitrap.gateReuse":
    "Esta papeleta no tiene una reutilización autorizada. Elige una nueva.",
  "mobile.ovitrap.gateReason":
    "Elige un motivo y escribe al menos 10 caracteres visibles, hasta 1000.",
  "mobile.ovitrap.gateReview":
    "Revisa los avisos de GPS y reglas. Solo puedes guardar para revisión cuando la política descargada lo permite.",
  "mobile.ovitrap.resume": "Continuar borrador",
  "mobile.ovitrap.nextTarget": "Siguiente punto",
  "mobile.ovitrap.edit": "Volver a revisar respuestas",
  "mobile.ovitrap.permission":
    "Consulta a tu supervisor para reemplazar, reubicar o retirar esta ovitrampa. Conserva esta lectura.",
  // M-06: P9-P10 day list and offline map
  "mobile.day.loading": "Cargando puntos guardados…",
  "mobile.day.updating": "Actualizando…",
  "mobile.day.readFailed": "No pudimos leer los puntos guardados. Intenta leerlos otra vez.",
  "mobile.day.mapFailed": "No pudimos verificar el mapa guardado. Intenta de nuevo o usa la lista.",
  "mobile.day.actionFailed":
    "No pudimos completar la acción local. Intenta otra vez; tus registros siguen guardados.",
  "mobile.day.backHome": "Volver al inicio",
  "mobile.day.showDetails": "Ver detalles del error",
  "mobile.day.hideDetails": "Ocultar detalles del error",
  "mobile.day.errorCode": "Código: {code}",

  "mobile.day.historyEntry": "{date} · {summary}",
  "mobile.day.title": "Mi día",
  "mobile.day.open": "Ver puntos del día",
  "mobile.day.list": "Lista",
  "mobile.day.map": "Mapa",
  "mobile.day.progress": "{completed} de {total} tareas completadas",
  "mobile.day.pending": "Pendientes · Alto Riesgo primero",
  "mobile.day.closedSection": "Casas cerradas por volver hoy",
  "mobile.day.completedSection": "Tareas completadas",
  "mobile.day.empty":
    "No tienes puntos asignados guardados. Cuando haya señal, actualiza la lista.",
  "mobile.day.ready":
    "Listo por hoy. Puedes ir al inicio para cerrar tu jornada cuando esté disponible.",
  "mobile.day.refresh": "Actualizar lista",
  "mobile.day.refreshFailed":
    "No pudimos actualizar. Puedes usar los puntos guardados e intentar otra vez.",
  "mobile.day.unreadable":
    "Filas que no se pudieron leer: {count}. Actualiza o pide ayuda al supervisor.",
  "mobile.day.keptNotice":
    "Cambió la asignación. Conservamos estos puntos por trabajo pendiente: {codes}. Consulta al supervisor.",
  "mobile.day.kept": "Conservado: trabajo pendiente",
  "mobile.day.highRisk": "Alto Riesgo",
  "mobile.day.pendingStatus": "Pendiente hoy",
  "mobile.day.doneStatus": "Completada",
  "mobile.day.closedStatus": "Casa cerrada · volver",
  "mobile.day.relocateStatus": "Por reubicar",
  "mobile.day.unknownStatus": "Estado por confirmar",
  "mobile.day.phoneSaved": "Guardado en el teléfono",
  "mobile.day.serverReceived": "Recibido por el servidor · revisión aparte",
  "mobile.day.receiptRejected":
    "Captura rechazada. Consulta el detalle en la bandeja de pendientes.",
  "mobile.day.captureInReview": "Captura en revisión del servidor",
  "mobile.day.reviewUnconfirmed": "Revisión del servidor sin confirmar",
  "mobile.day.place": "Colocar",
  "mobile.day.check": "Revisar",
  "mobile.day.replace": "Reemplazar",
  "mobile.day.relocate": "Reubicar",
  "mobile.day.remove": "Retirar",
  "mobile.day.block": "Manzana {code}",
  "mobile.day.distance": "{distance} m",
  "mobile.day.navigate": "Cómo llegar",
  "mobile.day.go": "Ir",
  "mobile.day.history": "Historial reciente",
  "mobile.day.historyEmpty": "No hay historial guardado.",
  "mobile.day.historyUnknown": "Detalle de visita no disponible",
  "mobile.day.historyOk": "Bien · papeleta entregada",
  "mobile.day.historyDry": "Sin agua · reinstalada",
  "mobile.day.reference": "Referencia: {reference}",
  "mobile.day.noReference": "No hay referencia guardada.",
  "mobile.day.scanHint":
    "Para registrar, escanea el QR de la ovitrampa cuando el escáner esté disponible.",
  "mobile.day.backList": "Ver lista de puntos",
  "mobile.day.closeDetail": "Cerrar detalle",
  "mobile.day.accessRevoked":
    "Los puntos descargados ya no est\u00e1n disponibles. Actualiza la jornada.",
  "mobile.day.noLocation": "Este punto todav\u00eda no tiene ubicaci\u00f3n. Puedes usar la lista.",
  "mobile.day.noMap": "No tienes el mapa guardado",
  "mobile.day.noMapHint":
    "No hay un archivo de mapa verificado disponible. Intenta verificar de nuevo o usa la lista de puntos.",
  "mobile.day.retryMap": "Verificar mapa otra vez",
  "mobile.day.outsideCoverage": "Fuera de la cobertura descargada",
  "mobile.day.attribution": "© OpenStreetMap contributors",
  "mobile.day.mapLabel": "Mapa sin conexión de puntos asignados",
  "mobile.day.locationDenied": "Ubicación no autorizada. Puedes seguir con la lista.",
  "mobile.day.locationUnavailable": "Ubicación no disponible. Puedes seguir con la lista.",
  "mobile.day.locationStale":
    "Ubicación desactualizada · hace {seconds} s. No se muestran distancias.",
  "mobile.day.locationFix": "Ubicación · hace {seconds} s · precisión ±{accuracy} m",
  "mobile.day.locationUnknownAccuracy": "Ubicación · hace {seconds} s · precisión no disponible",
  "mobile.day.locationWeak": "Ubicación aproximada · hace {seconds} s · precisión ±{accuracy} m",
  "mobile.day.launched": "Se abrió el navegador. Al volver, este punto seguirá seleccionado.",
  "mobile.day.noHandler":
    "No hay una app de navegación disponible. Usa las coordenadas y la referencia; la lista sigue disponible.",
  "mobile.day.denied":
    "No se pudo abrir el navegador. Pide al administrador que revise el acceso. Puedes usar las coordenadas y la referencia.",
  "mobile.day.invalidCoordinates":
    "Las coordenadas no son válidas. Usa la lista y consulta al supervisor.",
  "mobile.day.coordinates": "Coordenadas: {coordinates}",
  // M-04: P3-P7 shift opening
  "mobile.shiftOpen.catalogChanged":
    "El catálogo cambió. Revisa los puntos y confirma la nueva versión. Si una falla registrada ya no aparece, pide ayuda a tu supervisor; conservamos la evidencia.",
  "mobile.shiftOpen.confirmCatalog": "Confirmar catálogo y volver a revisar",
  "mobile.shiftOpen.start": "Abrir jornada",
  "mobile.shiftOpen.resume": "Retomar apertura",
  "mobile.shiftOpen.noShift": "Aún no abres jornada",
  "mobile.shiftOpen.opened": "Jornada guardada en este teléfono",
  "mobile.shiftOpen.noAssignment":
    "La asignación de zona aún no está disponible en esta versión. Puedes preparar tu jornada.",
  "mobile.shiftOpen.inbox": "Ver envíos",
  "mobile.shiftOpen.motorcycleTitle": "Paso 1 de 4 · Elige tu moto",
  "mobile.shiftOpen.motorcycleHint":
    "Escribe y confirma el código de la moto. El servidor comprobará si existe, está bloqueada o está en uso al sincronizar.",
  "mobile.shiftOpen.motorcycleCode": "Código de la moto",
  "mobile.shiftOpen.continue": "Continuar",
  "mobile.shiftOpen.checklistTitle": "Paso 2 de 4 · Revisa tu moto",
  "mobile.shiftOpen.unconfigured":
    "La lista de seguridad no está configurada. Descarga el catálogo o pide a tu supervisor que lo configure. No puedes salir.",
  "mobile.shiftOpen.catalogUnavailable":
    "No se pudo actualizar el catálogo. Conservamos la última copia guardada. Revisa tu sesión y conexión y vuelve a intentar.",
  "mobile.shiftOpen.refreshCatalog": "Actualizar catálogo de seguridad",
  "mobile.shiftOpen.ok": "Bien",
  "mobile.shiftOpen.minor": "Falla leve",
  "mobile.shiftOpen.severeResult": "Falla grave",
  "mobile.shiftOpen.note": "Observación (opcional)",
  "mobile.shiftOpen.requiredNote": "Observación obligatoria",
  "mobile.shiftOpen.odometerTitle": "Paso 3 de 4 · Km inicial",
  "mobile.shiftOpen.photoHint":
    "La foto del odómetro es opcional, salvo que el catálogo requiera evidencia. Las fotos guardadas permanecen en este teléfono.",
  "mobile.shiftOpen.capturePhoto": "Tomar foto",
  "mobile.shiftOpen.photoUnavailable":
    "La cámara no está disponible en esta versión. Conservamos tu captura; si se requiere foto, no podrás salir.",
  "mobile.shiftOpen.photoCount": "Fotos guardadas en este teléfono:",
  "mobile.shiftOpen.odometerKm": "Km que marca el odómetro (entero)",
  "mobile.shiftOpen.lastOdometer": "Último km conocido por este teléfono:",
  "mobile.shiftOpen.unknownOdometer":
    "Sin referencia local; el servidor la comprobará al sincronizar.",
  "mobile.shiftOpen.odometerWarning":
    "Es menor que el último km conocido. Revisa la lectura; puedes continuar sin perderla. El servidor podrá ponerla en revisión.",
  "mobile.shiftOpen.mapsTitle": "Paso 4 de 4 · Preparar mapa",
  "mobile.shiftOpen.mapReady":
    "Mapa verificado y con cobertura. Puedes continuar si la revisión de la moto está completa.",
  "mobile.shiftOpen.mapUnavailable":
    "El mapa aún no está listo. Esta versión no tiene el manifiesto de mapas. No puedes salir; vuelve a intentar cuando esté disponible.",
  "mobile.shiftOpen.mapPreparing":
    "Preparando mapa. La salida sigue bloqueada hasta verificar archivos y cobertura.",
  "mobile.shiftOpen.mapFailed":
    "No se pudo preparar el mapa. Conservamos el avance. Revisa la conexión y vuelve a intentar.",
  "mobile.shiftOpen.mapIncomplete":
    "Faltan archivos verificados o cobertura. Vuelve a preparar el mapa antes de salir.",
  "mobile.shiftOpen.mapProgress": "Avance de preparación (%):",
  "mobile.shiftOpen.recordSevere": "Guardar falla grave · No salir",
  "mobile.shiftOpen.severe":
    "No puedes salir con esta moto. Guarda la falla grave y avisa a tu supervisor para que gestione la liberación de flota. Guardarla no confirma que el servidor la recibió.",
  "mobile.shiftOpen.editChecklist": "Volver a elegir moto y revisar",
  "mobile.shiftOpen.motorcycle":
    "Confirma el código de la moto. Si la copia local indica un bloqueo, pide ayuda a tu supervisor.",
  "mobile.shiftOpen.checklist": "Contesta todos los puntos de seguridad antes de continuar.",
  "mobile.shiftOpen.noteGate": "Describe la falla grave o el motivo de Otro antes de guardar.",
  "mobile.shiftOpen.photo":
    "El catálogo exige una foto. Captúrala antes de salir; en esta versión no hay cámara disponible.",
  "mobile.shiftOpen.odometer":
    "Escribe los kilómetros como un número entero. Conservamos lo que escribiste.",
  "mobile.shiftOpen.map":
    "La salida requiere un mapa con archivos verificados y cobertura completa. Vuelve a intentar la preparación.",
  "mobile.shiftOpen.rejected":
    "El servidor rechazó la apertura. Revisa el resultado en Envíos y consulta a tu supervisor antes de salir.",
  "mobile.shiftOpen.phoneSaved": "Guardado en el teléfono · Recepción del servidor pendiente",
  "mobile.shiftOpen.serverReceived": "Recibido por el servidor · Consulta el resultado",
  "mobile.shiftOpen.reviewPending":
    "Revisión posterior: sin confirmación de resolución en esta versión.",
  "mobile.shiftOpen.correctAndRetry": "Corregir e intentar de nuevo",
  "mobile.shiftOpen.retrySave": "Reintentar guardar los datos",

  // Boot
  "mobile.boot.loading": "Preparando la app",
  "mobile.boot.storageFailed":
    "No se pudo abrir el almacenamiento del teléfono. Cierra y abre la app; si sigue igual, avisa a soporte.",
  "mobile.storage.saveFailed":
    "No se pudo guardar en el teléfono. Libera espacio e inténtalo de nuevo; nada se envió.",

  "mobile.storage.actionFailed":
    "No se pudo actualizar el almacenamiento del teléfono. Libera espacio e inténtalo de nuevo; tus registros siguen guardados.",

  // Navigation
  "mobile.nav.back": "Atrás",
  "mobile.nav.settings": "Ajustes",

  // Home (placeholder until the epics bring the real screens)
  "mobile.home.title": "Inicio",
  "mobile.home.placeholder":
    "Aquí irá tu jornada. Esta versión solo prepara el envío de registros.",
  "mobile.home.serverMissing":
    "La dirección del servidor no está configurada. Configúrala en Ajustes para poder enviar tus registros.",

  // Top-bar sync chip
  "mobile.chip.allSent": "Todo enviado",
  "mobile.chip.toUpload": "{count} por subir",
  "mobile.chip.noSignal": "Sin señal · {count} por subir",
  "mobile.chip.noSignalEmpty": "Sin señal",
  "mobile.chip.error": "Error: revisar",
  "mobile.chip.hint": "Abre la bandeja de envíos",

  // Sync inbox (P28)
  "mobile.inbox.title": "Envíos",
  "mobile.inbox.lastConnection": "Última conexión: {time}",
  "mobile.inbox.neverConnected": "Aún no hay conexión con el servidor",
  "mobile.inbox.problems": "Con problema",
  "mobile.inbox.onPhone": "En el teléfono · {count}",
  "mobile.inbox.sent": "Enviados · {count}",
  "mobile.inbox.tryNow": "Intentar ahora",
  "mobile.inbox.evidencePending":
    "Referencias de fotos pendientes: {count}. Esto no confirma la recepción del registro.",
  "mobile.inbox.evidenceError":
    "Algunas referencias de fotos siguen incompletas. Usa Intentar ahora; si el archivo no está disponible, contacta a tu coordinador.",
  "mobile.inbox.empty": "No hay registros todavía. Lo que captures aparecerá aquí.",
  "mobile.inbox.groupTitle": "{count} · {label}",
  "mobile.inbox.timeRange": "{from} a {to}",
  "mobile.inbox.offline":
    "Sin señal. Tus registros están guardados y se enviarán cuando vuelva la conexión.",
  "mobile.inbox.rejectionQuota":
    "Se alcanz? el l?mite diario de registros por revisar. Tus registros siguen guardados; se enviar?n despu?s de la espera indicada por el servidor.",
  "mobile.inbox.waitingRetry":
    "No pudimos conectar con el servidor. La app lo intentará de nuevo sola.",
  "mobile.inbox.parkedHint":
    "Este registro no se pudo enviar tal como está. Pulsa «Intentar ahora»; si se repite, avisa a tu supervisor.",

  // Why sending is paused
  "mobile.blocked.needsLogin":
    "Tu sesión terminó. Inicia sesión para que se envíen tus registros; no se perdió nada.",
  "mobile.blocked.clockWrong":
    "La fecha y la hora del teléfono no son correctas. Corrígelas en los ajustes del teléfono y tus registros se enviarán solos.",
  "mobile.blocked.noServer":
    "La dirección del servidor no está configurada. Configúrala en Ajustes para que se envíen tus registros; no se perdió nada.",
  "mobile.blocked.forbidden":
    "Tu cuenta no puede enviar registros por ahora. Avisa a tu supervisor; tus registros están guardados.",

  // Status badges (sent, rejected and in review reuse `sync.inbox.*Title`)
  "mobile.status.pending": "Por subir",
  "mobile.status.sending": "Enviando",
  "mobile.status.error": "No se pudo enviar",

  // Record types (the `type` of an event)
  "mobile.eventType.recordVoid": "Anulaciones",
  "mobile.eventType.shiftOpen": "Aperturas de jornada",
  "mobile.eventType.shiftClose": "Cierres de jornada",
  "mobile.eventType.locationPing": "Ubicaciones",
  "mobile.eventType.suppliesReceive": "Recepciones de insumos",
  "mobile.eventType.suppliesReconcile": "Conciliaciones de insumos",
  "mobile.eventType.ovitrapPlace": "Ovitrampas colocadas",
  "mobile.eventType.ovitrapCheck": "Ovitrampas revisadas",
  "mobile.eventType.ovitrapReplace": "Ovitrampas reemplazadas",
  "mobile.eventType.ovitrapRelocate": "Ovitrampas reubicadas",
  "mobile.eventType.ovitrapRemove": "Ovitrampas retiradas",
  "mobile.eventType.releaseRecord": "Liberaciones",
  "mobile.eventType.sampleCollect": "Muestras",
  "mobile.eventType.fuelLoad": "Cargas de gasolina",
  "mobile.eventType.incidentReport": "Incidentes",
  "mobile.eventType.emergencyAccident": "Emergencias",
  "mobile.eventType.communityActivity": "Actividades con la comunidad",
  "mobile.eventType.unknown": "Otros registros",

  // Settings
  "mobile.settings.title": "Ajustes",
  "mobile.settings.darkMode": "Modo oscuro",
  "mobile.settings.darkModeHint": "Para noche o interiores",
  "mobile.settings.language": "Idioma",
  "mobile.settings.languageEs": "Español (México)",
  "mobile.settings.languageEn": "English",
  "mobile.settings.server": "Servidor",
  "mobile.settings.serverHint": "Dirección de la API, por ejemplo https://api.ejemplo.com",
  "mobile.settings.serverSave": "Guardar dirección",
  "mobile.settings.serverReset": "Usar la del build",
  "mobile.settings.serverIdentityBound":
    "El servidor forma parte de la identidad de este tel\u00e9fono y no se puede cambiar aqu\u00ed. Llama a tu supervisor.",
  "mobile.settings.serverSaved": "Dirección guardada",
  "mobile.settings.serverInvalid":
    "La dirección no es válida. Escríbela completa, sin ruta, por ejemplo https://api.ejemplo.com",
  "mobile.settings.serverCleartext":
    "Usa https. Solo los builds de desarrollo permiten http en redes privadas, por ejemplo http://192.168.1.20:8000.",

  // Test tools (development builds only)
  "mobile.dev.title": "Pruebas (solo builds de desarrollo)",
  "mobile.dev.deviceId": "ID de este teléfono",
  "mobile.dev.addEvent": "Agregar registro de prueba",
  // P1/P2 authentication and local unlock
  "mobile.login.logo": "[Logo Codequim]",
  "mobile.login.title": "Entra a tu cuenta",
  "mobile.login.username": "Usuario",
  "mobile.login.password": "Contraseña",
  "mobile.login.showPassword": "Mostrar",
  "mobile.login.hidePassword": "Ocultar",
  "mobile.login.forgotPassword": "¿Olvidaste tu contraseña?",
  "mobile.login.callSupervisor": "Llama a tu supervisor. Él puede cambiarla desde la oficina.",
  "mobile.login.understood": "Entendido",
  "mobile.login.enter": "Entrar",
  "mobile.login.waitingSignal": "Entrar · esperando señal",
  "mobile.login.noSignal": "Necesitas señal la primera vez. Después podrás entrar sin señal.",
  "mobile.login.wrongCredentials": "Usuario o contraseña no coinciden. Revisa y vuelve a intentar.",
  "mobile.login.sessionEnded": "Tu sesión se cerró por seguridad. Entra de nuevo.",
  "mobile.login.deviceRevoked": "Este teléfono fue dado de baja. Llama a tu supervisor.",
  "mobile.login.cleanupFailed":
    "El teléfono no pudo preparar el inicio de sesión. Reintenta; tus registros capturados siguen guardados.",
  "mobile.login.genericError":
    "No pudimos iniciar sesión. Inténtalo de nuevo o llama a tu supervisor.",
  "mobile.login.throttled": "Demasiados intentos. Espera {minutes} min y vuelve a intentar.",
  "mobile.login.throttledUnknown": "Demasiados intentos. Espera un momento y vuelve a intentar.",
  "mobile.login.clockSkew": "La hora del teléfono no coincide.",
  "mobile.login.differentUser":
    "Este teléfono tiene registros de otra cuenta. Llama a tu supervisor antes de cambiar de usuario.",
  "mobile.login.onlineRequired":
    "Por seguridad necesitas entrar de nuevo con señal. Lo que capturaste sigue guardado en el teléfono.",
  "mobile.login.serverMissing":
    "Falta configurar el servidor. Abre la configuración del servidor o llama a tu supervisor.",
  "mobile.login.serverSettings": "Configurar servidor",
  "mobile.login.version": "Versión {version}",
  "mobile.unlock.greeting": "Hola, {name}",
  "mobile.unlock.enterPin": "Escribe tu PIN",
  "mobile.unlock.wrongPin": "PIN incorrecto. Te quedan {count} intentos.",
  "mobile.unlock.passwordTitle": "Escribe tu contraseña",
  "mobile.unlock.passwordRequired":
    "Se alcanzó el límite de {count} intentos de PIN. Por seguridad, entra con tu contraseña completa.",
  "mobile.unlock.savedWork": "Lo que capturaste sigue guardado en el teléfono.",
  "mobile.unlock.wrongSecret": "No coincide. Revisa y vuelve a intentar.",
  "mobile.unlock.biometric": "Usar huella",
  "mobile.unlock.biometricPrompt": "Desbloquea con tu huella",
  "mobile.unlock.cancel": "Cancelar",
  "mobile.unlock.erase": "Borrar",
  "mobile.unlock.createTitle": "Crea tu PIN",
  "mobile.unlock.createPin": "Escribe un PIN de 4 dígitos.",
  "mobile.unlock.confirmPin": "Confirma tu PIN.",
  "mobile.unlock.trivialPin": "Elige 4 dígitos que no sean iguales ni consecutivos.",
  "mobile.unlock.pinMismatch": "Los PIN no coinciden. Crea tu PIN de nuevo.",
  "mobile.unlock.pinProgress": "Dígitos capturados: {count} de 4.",
  "mobile.unlock.idleWarning": "Se bloqueará en 1 minuto.",
  "mobile.unlock.keepWorking": "Seguir trabajando",
  "mobile.unlock.resumeSetup": "Para terminar de crear tu PIN, escribe tu contraseña.",
  "mobile.unlock.wrongPinLast": "PIN incorrecto. Te queda 1 intento.",
  "mobile.lifecycle.advisoryUnavailable":
    "Recomendación no disponible para este instante y estas reglas. Puedes continuar la captura.",
  "mobile.lifecycle.advisoryFuture":
    "El instante de captura aún es futuro para el servidor. Reintenta después.",
  "mobile.lifecycle.advisoryAt":
    "Hechos observados hasta {at}. Una llegada tardía o anulación puede cambiar esta consulta.",
  "mobile.lifecycle.advisoryCounts":
    "Semanas de casa cerrada: {weeks}. Incidentes del punto: {incidents}.",
  "mobile.lifecycle.advisorySuggested":
    "Las reglas sugieren revisar una reubicación. Guardarla sólo crea una propuesta.",
  "mobile.lifecycle.advisoryNotSuggested":
    "La observación disponible no alcanza los umbrales de sugerencia.",
  "mobile.lifecycle.legacyAdvisory":
    "Sólo hay historia local parcial; no confirma el total de incidentes del punto.",
  "mobile.lifecycle.decisionReasonUnknown": "Motivo histórico no disponible.",
  "mobile.lifecycle.decisionTimeUnknown": "Fecha histórica de decisión no disponible.",
  "mobile.lifecycle.sourceVoided":
    "La fuente fue anulada: {at}. La propuesta y su evidencia se conservan.",
  "mobile.lifecycle.legacyDecision":
    "Registro local anterior conservado como auditoría; no confirma una revisión del servidor.",
  "mobile.lifecycle.taskReferenceOnly":
    "Referencia programada; todavía no es una tarea vigente asignada a ti.",
  "mobile.lifecycle.taskAssigned": "Tarea vigente asignada a ti y pendiente de completar.",
  "mobile.lifecycle.openTask": "Ver tarea asignada",
  "mobile.lifecycle.ingestAccepted": "Resultado original de recepción: aceptado.",
  "mobile.lifecycle.ingestRejected": "Resultado original de recepción: rechazado.",
  "mobile.lifecycle.ingestReview": "Resultado original de recepción: en revisión.",
  "mobile.lifecycle.reviewedTitle": "Decisión posterior del servidor",
  "mobile.lifecycle.effectApplied": "Efecto aplicado tras revisión.",
  "mobile.lifecycle.effectAdopted": "Efecto anterior reconocido; conserva su procedencia original.",
  "mobile.lifecycle.effectDiscarded": "Trabajo descartado por decisión; conserva su historia.",
  "mobile.lifecycle.effectIncident": "Incidente abierto; esto no acepta la captura original.",
  "mobile.lifecycle.effectApproved": "Jornada revisada; no concede permiso nuevo de captura.",
  "mobile.lifecycle.effectObserved": "Observación de jornada registrada.",
  "mobile.lifecycle.approvalNotCurrent": "Esta validación ya no es la aprobación vigente.",
  "mobile.lifecycle.nonterminalDecision": "Decisión informativa; la revisión puede continuar.",
  "mobile.lifecycle.limitsUnavailable":
    "Selecciona un motivo del catálogo descargado con límites conocidos antes de corregir.",
  "mobile.lifecycle.reasonLimits":
    "Caracteres visibles mínimos para esta opción: {min}. Límite de la nota: {max} caracteres.",
  "mobile.lifecycle.epochClosed":
    "El cuadrante está cerrado. No se pueden guardar nuevas capturas en este marco.",
  "mobile.lifecycle.epochUnknown":
    "Falta un marco actual verificable. Actualiza; el borrador se conserva.",
  "mobile.lifecycle.recoveryBlocked":
    "El borrador se conserva, pero su propiedad no está probada para esta sesión. Entra con la cuenta original o pide ayuda a soporte.",
  "mobile.lifecycle.remoteProposal":
    "Propuesta descargada del servidor; no es una captura local editable.",
  "mobile.supplyReceipt.title": "Recibir insumos",
  "mobile.supplyReceipt.subtitle": "Firma solo lo que recibiste físicamente",
  "mobile.supplyReceipt.start": "Revisar esta entrega",
  "mobile.supplyReceipt.resume": "Abrir recibo guardado",
  "mobile.supplyReceipt.assignment": "Asignación",
  "mobile.supplyReceipt.release": "Salida de almacén",
  "mobile.supplyReceipt.lot": "Lote",
  "mobile.supplyReceipt.piece": "Pieza",
  "mobile.supplyReceipt.unit": "Unidad declarada",
  "mobile.supplyReceipt.expected": "Cantidad esperada",
  "mobile.supplyReceipt.actual": "Cantidad recibida",
  "mobile.supplyReceipt.declaredUnits":
    "Usa la unidad declarada en esta entrega. No conviertas cajas a piezas. Los códigos y nombres de unidad aún no están disponibles; verifica los identificadores con almacén.",
  "mobile.supplyReceipt.noAssignments":
    "No hay entregas asignadas disponibles en la copia descargada. Puedes actualizar o volver a tu jornada.",
  "mobile.supplyReceipt.unavailable":
    "Falta una copia actual autorizada de tus entregas. Actualiza con señal o pide ayuda a tu supervisor. Tus recibos se conservan.",
  "mobile.supplyReceipt.refresh": "Actualizar entregas",
  "mobile.supplyReceipt.working": "Guardando en el teléfono…",
  "mobile.supplyReceipt.save": "Guardar recibo firmado en el teléfono",
  "mobile.supplyReceipt.saved":
    "Recibo firmado guardado en el teléfono. Esto aún no confirma su recepción en el servidor.",
  "mobile.supplyReceipt.serverReceived":
    "Acuse inicial: el servidor recibió el recibo. Consulta por separado cualquier revisión de tu supervisor.",
  "mobile.supplyReceipt.review":
    "Acuse inicial: el servidor recibió el recibo para revisión. Se conserva lo que firmaste; este acuse por sí solo no confirma inventario acreditado.",
  "mobile.supplyReceipt.rejected":
    "El servidor no aplicó el recibo. La captura y tu firma se conservan; revisa la bandeja o pide ayuda a tu supervisor.",
  "mobile.supplyReceipt.pendingSignature":
    "La firma está guardada en el teléfono y su archivo sigue pendiente de carga. Puedes consultar o reintentar en la bandeja.",
  "mobile.supplyReceipt.inbox": "Abrir bandeja de sincronización",
  "mobile.supplyReceipt.scanLabel": "Código QR del lote",
  "mobile.supplyReceipt.scanHint":
    "También puedes pegar el contenido completo del QR o capturar el UUID del lote. Un código de etiqueta sin identificación confirmada no se agrega.",
  "mobile.supplyReceipt.scan": "Validar QR del lote",
  "mobile.supplyReceipt.manual": "Validar UUID del lote manualmente",
  "mobile.supplyReceipt.duplicate": "Este código ya fue registrado. No se agregó otra pieza.",
  "mobile.supplyReceipt.added":
    "Código reconocido. Revisa la cantidad en la unidad declarada antes de firmar.",
  "mobile.supplyReceipt.invalid":
    "No pudimos validar este código para tu entrega. No se agregó. Verifica el identificador con almacén o tu supervisor.",
  "mobile.supplyReceipt.discrepancy": "Explica cualquier diferencia",
  "mobile.supplyReceipt.missing": "Falta material",
  "mobile.supplyReceipt.damaged": "Llegó dañado",
  "mobile.supplyReceipt.other": "Otro (especificar)",
  "mobile.supplyReceipt.discrepancyText": "Explicación de la diferencia",
  "mobile.supplyReceipt.discrepancyHint":
    "Firma las cantidades reales. El servidor conservará la diferencia para revisión; no cambies las cantidades para hacerlas coincidir.",
  "mobile.supplyReceipt.photo": "Fotografiar el daño",
  "mobile.supplyReceipt.photoSaved":
    "Foto del daño conservada solo en el teléfono. Aún no puede enviarse junto con este recibo; pide ayuda a tu supervisor.",
  "mobile.supplyReceipt.signatureTitle": "Firma de recibido",
  "mobile.supplyReceipt.signatureHint":
    "Firma aquí con el dedo o fotografía tu firma manuscrita. La firma corresponde a las cantidades y diferencias que aparecen arriba.",
  "mobile.supplyReceipt.signatureCapture": "Conservar esta firma",
  "mobile.supplyReceipt.signaturePhoto": "Fotografiar mi firma manuscrita",
  "mobile.supplyReceipt.signatureSaved": "Firma conservada en el teléfono",
  "mobile.supplyReceipt.undo": "Deshacer último trazo",
  "mobile.supplyReceipt.clear": "Empezar la firma de nuevo",
  "mobile.supplyReceipt.signatureRequired":
    "Falta tu firma. Firma con el dedo o fotografía tu firma manuscrita antes de guardar.",
  "mobile.supplyReceipt.quantityInvalid":
    "Revisa las cantidades en su unidad declarada. Una pieza solo admite cero o uno; el resto admite hasta seis decimales dentro de la entrega.",
  "mobile.supplyReceipt.discrepancyRequired":
    "Declara el motivo de la diferencia antes de firmar el recibo.",
  "mobile.supplyReceipt.otherRequired": "Escribe una explicación para Otro antes de guardar.",
  "mobile.supplyReceipt.evidenceRequired":
    "Falta la foto del daño. Tómala antes de firmar; el resto de tu captura se conserva.",
  "mobile.supplyReceipt.staleDraft":
    "La captura cambió mientras trabajabas. Revisa el recibo conservado y vuelve a intentar.",
  "mobile.supplyReceipt.shiftRequired":
    "Abre una jornada autorizada antes de recibir insumos. Tu borrador se conserva.",
  "mobile.supplyReceipt.configurationRequired":
    "Faltan catálogos o reglas descargados. Actualiza con señal antes de firmar.",
  "mobile.supplyReceipt.startScanner": "Escanear QR con la cámara",
  "mobile.supplyReceipt.scannerTitle": "Escanear lote de esta entrega",
  "mobile.supplyReceipt.scannerHint":
    "Apunta al código QR del lote. El lector se cierra después de cada lectura; revisa la cantidad antes de firmar.",
  "mobile.supplyReceipt.stopScanner": "Cerrar lector y volver al recibo",
  "mobile.supplyReceipt.scannerPermission":
    "El permiso de cámara no está disponible. Puedes activarlo en Ajustes o usar la captura manual del identificador.",
  "mobile.supplyReceipt.scannerRetry":
    "Desbloquea el teléfono y vuelve a abrir el lector desde este recibo. La captura manual sigue disponible.",
  "mobile.supplyReceipt.scannerUnavailable":
    "No pudimos abrir la cámara. Vuelve a intentar o usa la captura manual del identificador.",
  "mobile.supplyReceipt.reviewedAccepted": "Revisión posterior: recibo aceptado por el supervisor.",
  "mobile.supplyReceipt.reviewedVoided":
    "Revisión posterior: recibo anulado por el supervisor. La captura firmada se conserva.",
  "mobile.supplyReceipt.incidentOpen":
    "Revisión posterior: se abrió una incidencia. Esto no acepta ni anula el recibo.",
  "mobile.fuel.title": "Cargar gasolina",
  "mobile.fuel.subtitle": "Captura sin señal · moto de tu jornada",
  "mobile.fuel.motorcycle": "Moto",
  "mobile.fuel.motorcycleFixed": "La moto es la de tu jornada abierta; no se puede cambiar aquí.",
  "mobile.fuel.litres": "Litros (L)",
  "mobile.fuel.amount": "Monto (MXN)",
  "mobile.fuel.odometer": "Odómetro actual (km)",
  "mobile.fuel.fullRefill": "¿Llenaste el tanque?",
  "mobile.fuel.fullRefillYes": "Sí · tanque lleno",
  "mobile.fuel.fullRefillNo": "No · carga parcial",
  "mobile.fuel.receipt": "Foto del ticket",
  "mobile.fuel.receiptPreview": "Vista previa privada del ticket de esta carga",
  "mobile.fuel.receiptCheck":
    "Revisa que se lean los números. Si está borrosa, repite la foto con más luz y sin moverte; tus cantidades se conservan.",
  "mobile.fuel.receiptSaved": "La foto original del ticket se conserva con esta carga.",
  "mobile.fuel.noReceiptSaved":
    "Esta carga se guardó sin foto del ticket; el recibo queda pendiente.",
  "mobile.fuel.noReceipt":
    "Sin foto del ticket. Puedes intentar tomarla o guardar la carga con el recibo pendiente.",
  "mobile.fuel.takePhoto": "Tomar foto del ticket",
  "mobile.fuel.retake": "Repetir foto del ticket",
  "mobile.fuel.previewUnavailable":
    "No pudimos mostrar la vista previa. La referencia se conserva; revisa la foto antes de guardar o vuelve a tomarla.",
  "mobile.fuel.photoUnavailable":
    "No pudimos abrir la cámara. Vuelve a intentar; tus cantidades y la foto anterior se conservan.",
  "mobile.fuel.insufficient":
    "Datos insuficientes para calcular el rendimiento: se necesitan cargas completas consecutivas con distancia conocida. Puedes guardar la carga y cerrar tu jornada.",
  "mobile.fuel.unconfigured":
    "No hay límites de rendimiento descargados para este intervalo. Puedes guardar; el servidor revisará la carga al recibirla.",
  "mobile.fuel.decreased":
    "El odómetro es menor que la lectura anterior. Revisa el número; puedes conservarlo y guardar la carga.",
  "mobile.fuel.efficiencyOk":
    "Rendimiento del intervalo comparable dentro de los límites informativos.",
  "mobile.fuel.efficiencyReview":
    "El rendimiento queda fuera del rango informativo. Revisa litros y odómetro; puedes guardar así y cerrar tu jornada.",
  "mobile.fuel.saved": "Guardada en el teléfono · pendiente de recibir por el servidor.",
  "mobile.fuel.serverReceived": "Carga recibida por el servidor.",
  "mobile.fuel.reviewPending":
    "Carga recibida por el servidor · pendiente de revisión. Las cantidades se conservan.",
  "mobile.fuel.rejected":
    "El servidor rechazó esta carga. La captura se conserva; revisa el motivo en la bandeja y avisa a tu supervisor.",
  "mobile.fuel.receiptPending":
    "Ticket pendiente de envío o verificación; no es una revisión de la carga.",
  "mobile.fuel.receiptVerified":
    "Foto del ticket verificada por el servidor; no es una revisión de la carga.",
  "mobile.fuel.reviewedAccepted": "Revisión posterior: carga aceptada por el supervisor.",
  "mobile.fuel.reviewedVoided":
    "Revisión posterior: carga anulada. La captura original se conserva.",
  "mobile.fuel.incidentOpen":
    "Revisión posterior: se abrió una incidencia; la carga no queda aceptada ni anulada.",
  "mobile.fuel.litresInvalid":
    "Escribe litros mayores que cero, con hasta tres decimales y sin separadores de miles.",
  "mobile.fuel.amountInvalid":
    "Escribe un monto mayor que cero, con hasta dos decimales y sin separadores de miles.",
  "mobile.fuel.odometerInvalid":
    "Escribe kilómetros enteros entre 0 y 999999, sin separadores de miles.",
  "mobile.fuel.unavailable":
    "La jornada o los datos descargados no autorizan esta captura. Revisa tu jornada y vuelve a intentar; el borrador se conserva.",
  "mobile.fuel.shiftRequired":
    "Abre una jornada autorizada antes de cargar gasolina. Tu borrador se conserva.",
  "mobile.fuel.staleDraft":
    "La captura cambió mientras trabajabas. Revisa el borrador conservado y vuelve a intentar.",
  "mobile.fuel.draftSaved":
    "Borrador en este teléfono · revisa los datos antes de guardar la carga.",
  "mobile.fuel.draftPending":
    "Hay cambios pendientes de guardar en el teléfono. Vuelve a intentar antes de salir.",
  "mobile.fuel.empty":
    "Todavía no hay una captura de gasolina. Inicia una para la moto de tu jornada.",
  "mobile.fuel.begin": "Iniciar captura de gasolina",
  "mobile.fuel.beginAnother": "Capturar otra carga",
  "mobile.fuel.save": "Guardar carga",
  "mobile.fuel.working": "Guardando en el teléfono…",
  "mobile.fuel.saveHint":
    "Guardar conserva la carga en este teléfono. El envío y la revisión ocurren después.",
  "mobile.fuel.inbox": "Ver envío y revisión en la bandeja",
  "mobile.incidents.title": "Reportar incidente",
  "mobile.incidents.subtitle": "Captura local y conversación con tu equipo",
  "mobile.incidents.emergency": "Emergencia",
  "mobile.incidents.emergencyHint":
    "Ponte a salvo. La captura no confirma que alguien recibió el aviso.",
  "mobile.incidents.report": "Incidente",
  "mobile.incidents.accident": "Accidente",
  "mobile.incidents.unavailable":
    "La captura no está habilitada con el contexto actual. Conservamos tus borradores; desbloquea la app o actualiza tu jornada.",
  "mobile.incidents.shiftRequired":
    "Abre o revisa tu jornada para reportar. La llamada de apoyo no requiere guardar un reporte.",
  "mobile.incidents.staleDraft":
    "La captura cambió mientras trabajabas. Conservamos lo anterior; vuelve a abrirla antes de reintentar.",
  "mobile.incidents.typeRequired": "Selecciona un tipo de incidente.",
  "mobile.incidents.descriptionRequired": "Describe lo ocurrido para guardar el incidente.",
  "mobile.incidents.descriptionLong": "Acorta la descripción a 4000 caracteres y vuelve a guardar.",
  "mobile.incidents.evidenceLimit":
    "La captura admite hasta 100 fotos. Conserva el resto en el teléfono.",
  "mobile.incidents.photoUnavailable":
    "No se pudo abrir la cámara. Conservamos la captura; reintenta cuando estás a salvo.",
  "mobile.incidents.saved": "Guardado en el teléfono: pendiente de envío.",
  "mobile.incidents.serverReceived": "Recibido por el servidor.",
  "mobile.incidents.reviewPending":
    "Recibido por el servidor: requiere revisión. La captura original se conserva.",
  "mobile.incidents.rejected":
    "El servidor no aceptó el reporte. Se conserva en el teléfono; revisa el motivo en la bandeja.",
  "mobile.incidents.evidencePending":
    "Hay fotos pendientes de verificación. La captura sigue guardada; revisa la bandeja para reintentar el envío.",
  "mobile.incidents.noDeliveryPromise":
    "Recibir el reporte no confirma que tu supervisor lo leyó ni que la ayuda va en camino.",
  "mobile.incidents.description": "Descripción de lo ocurrido",
  "mobile.incidents.optionalDescription": "Detalle opcional del accidente",
  "mobile.incidents.searchTypes": "Buscar tipo de incidente",
  "mobile.incidents.noTypeMatches": "No hay tipos que coincidan. Cambia la búsqueda.",
  "mobile.incidents.noTypes":
    "No hay tipos descargados disponibles. Actualiza los tipos con conexión o pide al administrador que revise la configuración.",
  "mobile.incidents.chooseType": "Elegir tipo",
  "mobile.incidents.type": "Tipo de incidente",
  "mobile.incidents.otherHint": "Otro requiere que expliques lo ocurrido en la descripción.",
  "mobile.incidents.evidence": "Fotos de evidencia",
  "mobile.incidents.evidenceMinimum": "Mínimo de fotos configurado para este tipo:",
  "mobile.incidents.evidenceMissing":
    "Falta evidencia requerida. Puedes conservar el reporte; el servidor puede enviarlo a revisión.",
  "mobile.incidents.uploadUnavailable":
    "Tu contexto actual no permite adjuntar fotos. Conserva los detalles y pide apoyo al supervisor.",
  "mobile.incidents.takePhoto": "Agregar foto",
  "mobile.incidents.photoPreview": "Vista previa de evidencia del incidente",
  "mobile.incidents.previewUnavailable":
    "No se pudo mostrar esta foto. El archivo se conserva; revisa la captura antes de guardar.",
  "mobile.incidents.originalTime": "Hora original de captura (UTC)",
  "mobile.incidents.gpsCaptured": "Se guardó la ubicación disponible con la captura.",
  "mobile.incidents.noGps":
    "Sin ubicación disponible. No se inventó una ubicación para este reporte.",
  "mobile.incidents.mine": "Mis incidentes y comentarios",
  "mobile.incidents.pageHint":
    "Solo tus reportes disponibles en la página descargada. Actualiza con conexión para consultar respuestas; esta lista puede estar incompleta.",
  "mobile.incidents.repliesUnavailable":
    "Los comentarios del equipo se consultan con conexión. La respuesta desde el móvil aún no está disponible.",
  "mobile.incidents.noIncidents":
    "Todavía no hay reportes tuyos en esta página. Guarda un reporte o actualiza con conexión.",
  "mobile.incidents.readUnavailable":
    "El contexto actual no permite consultar esta conversación. Los borradores siguen guardados.",
  "mobile.incidents.readFailed":
    "No se pudo actualizar. Conservamos la captura y lo que aún está autorizado en este teléfono. Reintenta con conexión.",
  "mobile.incidents.refreshing": "Actualizando tipos y comentarios...",
  "mobile.incidents.refresh": "Actualizar tipos, contacto y comentarios",
  "mobile.incidents.onPhone": "Capturas guardadas en este teléfono",
  "mobile.incidents.draftPending":
    "Hay texto pendiente de guardar. Reintenta antes de cerrar la captura.",
  "mobile.incidents.draftSaved":
    "Borrador guardado en el teléfono. Falta guardar el reporte para enviarlo.",
  "mobile.incidents.empty":
    "Inicia un reporte para elegir su tipo, describir lo ocurrido y adjuntar evidencia.",
  "mobile.incidents.accidentHint":
    "Puedes guardar un accidente sin foto ni detalle. La falta de señal nunca confirma aviso entregado.",
  "mobile.incidents.saveHint":
    "Guardar conserva el reporte en este teléfono. El envío y la revisión son pasos posteriores.",
  "mobile.incidents.working": "Guardando en el teléfono...",
  "mobile.incidents.save": "Guardar reporte en el teléfono",
  "mobile.incidents.begin": "Iniciar reporte",
  "mobile.incidents.beginAccident": "Capturar accidente",
  "mobile.incidents.safeClose": "Continuar al cierre de jornada",
  "mobile.incidents.callWorkContact": "Llamar al contacto laboral configurado",
  "mobile.incidents.dialerOpened":
    "Se abrió el teléfono. Esto no confirma una llamada ni que alguien recibió el aviso; depende del dispositivo y la red.",
  "mobile.incidents.dialerUnavailable":
    "No se pudo abrir la llamada. Usa la app Teléfono del dispositivo y busca ayuda cuando sea seguro. El reporte se conserva.",
  "mobile.incidents.contactMissing":
    "No hay un teléfono laboral validado disponible. No se configuró un número de emergencias para esta app.",
  "mobile.incidents.callFallback":
    "Si necesitas ayuda inmediata, usa la app Teléfono del dispositivo y el contacto de emergencia que conozcas. La llamada depende del dispositivo y la red.",
  "mobile.history.title": "Mi historial",
  "mobile.history.search": "Buscar código o referencia",
  "mobile.history.partial":
    "Copia local parcial: los registros guardados, recibidos y revisados tienen estados distintos.",
  "mobile.history.failed":
    "No pudimos actualizar. Conservamos tus capturas; reintenta con conexión.",
  "mobile.history.refresh": "Actualizar historial",
  "mobile.history.allShifts": "Volver a jornadas",
  "mobile.history.noMatches":
    "No hay coincidencias en esta copia. Cambia la búsqueda o actualiza con conexión.",
  "mobile.history.unavailable":
    "Historial no disponible. Actualiza con conexión o pide a tu supervisor revisar el acceso.",
  "mobile.history.unknownTime": "Fecha no disponible",
  "mobile.history.shift": "Jornada",
  "mobile.history.openShift": "Ver eventos y observaciones",
  "mobile.history.reviewed": "Revisado",
  "mobile.history.voided": "Anulado",
  "mobile.history.observed": "Con observaciones",
  "mobile.history.received": "Recibido por el servidor",
  "mobile.history.serverFact": "Observación del servidor",
  "mobile.history.author": "Autor (nombre o referencia)",
  "mobile.history.unavailableValue": "No disponible",
  "mobile.history.reference": "Referencia original",
  "mobile.history.reason": "Motivo u observación",
  "mobile.history.voids": "Corrige la referencia",
  "mobile.settings.textSize": "Tamaño de texto",
  "mobile.settings.textSystem": "Igual que el teléfono",
  "mobile.settings.textLarge": "Texto adicionalmente 30 % más grande",
  "mobile.settings.saveFailed":
    "No pudimos guardar tu preferencia. Conservamos la selección anterior; vuelve a elegir para reintentar.",
  "mobile.settings.readFailed":
    "No pudimos consultar el estado local. Reintenta; puedes bloquear el acceso sin borrar tus capturas.",
  "mobile.settings.version": "Versión de la app en ejecución",
  "mobile.settings.updaterUnavailable":
    "Actualizador no disponible. No hay un manifiesto ni un recibo de instalación verificado; consulta a soporte.",
  "mobile.settings.support": "Contacto de soporte de la organización",
  "mobile.settings.supportUnavailable": "No hay contacto configurado. Pide apoyo a tu supervisor.",
  "mobile.settings.pendingWork": "Trabajo conservado en el teléfono",
  "mobile.settings.events": "Registros pendientes de recepción",
  "mobile.settings.files": "Archivos pendientes de verificación o vínculo",
  "mobile.settings.drafts": "Borradores sin guardar como registro",
  "mobile.settings.lockHint":
    "Cerrar el acceso bloquea este teléfono. Conserva borradores, archivos y envíos; desbloquea con tu PIN para continuar. La sesión del servidor mantiene su vigencia original.",
  "mobile.settings.viewUploads": "Ver envíos y observaciones",
  "mobile.settings.lockAccess": "Cerrar acceso local y conservar trabajo",
} as const satisfies AreaCatalog<"mobile">;
