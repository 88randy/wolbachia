# CLAUDE.md — wolbachia-field

## Capa común (PYROBYTE)
- Respuestas en español de México; código, commits, ramas, issues técnicos y docs técnicas en inglés.
- Spec-first: nada se programa sin un GitHub Issue con: 1) Contexto 2) Objetivo 3) Alcance y fuera de alcance 4) Modelo de datos 5) Contrato (API/interfaces) 6) Comportamiento 7) Casos borde y errores 8) Criterios de aceptación + Notas. Un PR por issue, ligado con `Closes #N`.
- Stack: Django + DRF, PostgreSQL administrado, Redis, Celery, Channels/Daphne, S3; React / React Native; todo dockerizado; DigitalOcean; CI/CD con GitHub Actions.
- Seguridad: ORM o consultas parametrizadas, validación de entradas, control de acceso por objeto, rate limiting, nunca secretos en el repo (.env fuera de git).
- No inventar librerías ni APIs: si algo no está verificado, márcalo como supuesto en el issue.
- Antes de tocar una carpeta, lee su `README.md`; si el cambio afecta el contrato de la API, actualiza `docs/` y el cliente generado en el mismo PR.

## Capa del repositorio
### Decisiones vigentes
- **Multiorganización en una sola base de datos.** Toda tabla de negocio lleva `organization_id`; el aislamiento se aplica por fila (manager/queryset por organización + permisos DRF). Desviación consciente del estándar "BD por tenant": hoy hay una sola empresa, pero el modelo debe permitir separar organizaciones sin mezclar datos.
- **Offline-first.** El teléfono es la fuente de verdad local; el servidor recibe lotes de eventos idempotentes (UUID generado en el cliente). Ningún paso de UI espera al servidor.
- **Nada se borra.** Registros inmutables; corregir = evento de anulación con motivo que referencia al original.
- **Doble hora.** Cada evento guarda `device_time` y `server_received_at`; si la diferencia supera el umbral configurado, el evento queda `in_review`.
- **El repartidor no cuenta huevos.** Solo marca Sí/No (¿tiene huevos?) cuando la papeleta está presente; el conteo lo captura el entomólogo en la web.
- **La app muestra reglas, no las decide.** Reglas y catálogos vienen del backend por organización; el teléfono valida con la última copia descargada y el servidor revalida al sincronizar.
- **Distribución interna.** Sin Play Store. Teléfonos en modo dedicado administrados por personal interno; actualizaciones desde el servidor de la empresa (ideal: disparadas desde la propia app).
- **Monorepo.** Backend, móvil y web viven en este repo. Un issue = un PR, aunque toque varias carpetas.
- **El backend es la fuente del contrato.** El esquema OpenAPI (drf-spectacular) se genera en CI y de él sale `packages/api-client`. Si cambia la API, se regenera el cliente en el mismo PR; móvil y web no definen tipos de la API a mano.
- **Tokens e i18n compartidos.** Móvil y web consumen `packages/tokens` y `packages/i18n`; no se copian colores ni textos en cada app.
- **CI y despliegue por carpeta.** Cada carpeta tiene su workflow con filtros de ruta (`paths:`). Backend y web se despliegan en DigitalOcean; móvil se compila y se publica en el servidor interno de actualizaciones.
- **Convención de ramas y commits:** `feat/<issue>-<slug>`, `fix/<issue>-<slug>`; commits con prefijo de ámbito: `feat(mobile): ...`, `fix(backend): ...`, `chore(web): ...`.

### Estructura del monorepo
```
backend/        Django + DRF: API única para móvil y web
mobile/         React Native (Android): app del repartidor
web/            React: supervisor, entomólogo, promotor, admin
packages/
  api-client/   Cliente y tipos generados del OpenAPI del backend (no se editan a mano)
  tokens/       Tokens de diseño Codequim (color, tipografía, espaciado, radios)
  i18n/         Textos es-MX / en con claves compartidas
docs/           Decisiones (ADR), contratos y notas
```

### Lecciones aprendidas
- (vacío; agregar al cerrar cada épica)
