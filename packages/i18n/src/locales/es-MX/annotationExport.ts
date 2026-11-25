export const annotationExport = {
  "annotationExport.permission.label": "Exportar datos de entrenamiento de anotaciones",
  "annotationExport.page.title": "Exportar datos de entrenamiento",
  "annotationExport.page.description":
    "Prepara un conjunto de imágenes verificadas y anotaciones manuales para AedesVision.",
  "annotationExport.page.card":
    "Genera archivos COCO o YOLO con imágenes, cajas y puntos separados.",
  "annotationExport.form.title": "Nueva exportación",
  "annotationExport.form.hint":
    "Las fechas incluyen ambos días y usan la zona horaria de la organización. Los puntos se guardan por separado, sin convertirlos en cajas.",
  "annotationExport.form.photoNotice":
    "No se incluyen datos personales en los metadatos, nombres de archivo ni manifiesto. Las fotos pueden mostrar códigos o etiquetas escritos a mano; revísalas antes de compartir el conjunto.",
  "annotationExport.form.disclosureNotice":
    "Generar la exportación revela los conteos incluidos: no podrás hacer reconteos ciegos de esas bolsas.",
  "annotationExport.form.from": "Fecha inicial",
  "annotationExport.form.to": "Fecha final",
  "annotationExport.form.author": "Autor (opcional)",
  "annotationExport.form.authorUnavailable":
    "Se incluirán todos los autores. Para elegir uno, solicita acceso al directorio de personas a un administrador.",
  "annotationExport.form.includeVoided": "Incluir anotaciones anuladas",
  "annotationExport.form.format": "Formato",
  "annotationExport.form.submit": "Generar exportación",
  "annotationExport.form.queued": "Exportación solicitada. Puedes revisar su estado en la tabla.",
  "annotationExport.format.coco": "COCO",
  "annotationExport.format.yolo": "YOLO",
  "annotationExport.list.title": "Exportaciones",
  "annotationExport.list.hint":
    "Las más recientes aparecen primero. Genera una exportación arriba y descárgala cuando esté lista.",
  "annotationExport.list.created": "Fecha",
  "annotationExport.list.filters": "Filtros",
  "annotationExport.list.period": "Periodo",
  "annotationExport.list.imageCount": "Imágenes",
  "annotationExport.list.boxCount": "Cajas",
  "annotationExport.list.pointCount": "Puntos",
  "annotationExport.list.status": "Estado",
  "annotationExport.list.download": "Descargar",
  "annotationExport.list.regenerate": "Volver a generar",
  "annotationExport.list.notReady": "Disponible cuando esté lista.",
  "annotationExport.status.queued": "En cola",
  "annotationExport.status.running": "En preparación",
  "annotationExport.status.ready": "Lista",
  "annotationExport.status.failed": "Fallida",
  "annotationExport.status.expired": "Expirada",
  "annotationExport.error.required": "Selecciona la fecha inicial y la fecha final.",
  "annotationExport.error.invalid": "Selecciona fechas válidas.",
  "annotationExport.error.range": "La fecha final debe ser igual o posterior a la inicial.",
  "annotationExport.error.tooLong":
    "Selecciona un periodo de hasta {maxDays} días, incluidos ambos días.",
  "annotationExport.error.tooMany":
    "El conjunto supera {maxImages} imágenes. Reduce el periodo o elige un autor y vuelve a generar.",
  "annotationExport.error.tooLarge":
    "El conjunto supera {maxBytes} bytes. Reduce el periodo o elige un autor y vuelve a generar.",
  "annotationExport.error.inProgress":
    "Hay exportaciones en preparación. Espera a que terminen y vuelve a generar.",
  "annotationExport.error.failed":
    "No se confirmó la solicitud. Revisa la tabla antes de volver a generar para evitar duplicados.",
  "annotationExport.error.task":
    "No se pudo preparar. Genera otra exportación o solicita ayuda a un administrador.",
  "annotationExport.error.download": "No se pudo descargar. Vuelve a intentarlo.",
} as const;
