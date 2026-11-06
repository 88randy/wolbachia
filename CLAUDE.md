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
- **Convención de ramas y commits:** `feat/<issue>-<slug>`, `fix/<issue>-<slug>`, `chore/<issue>-<slug>`; commits con prefijo de ámbito: `feat(mobile): ...`, `fix(backend): ...`, `chore(web): ...`.
- **Reglas de ingeniería y glosario.** Todo el código sigue [`docs/engineering-rules.md`](docs/engineering-rules.md) (limpieza, capas, tipado, errores, pruebas; los linters las aplican) y usa un solo nombre en inglés por término de dominio según [`docs/glossary.md`](docs/glossary.md). Los agentes del proyecto están en `.claude/agents/`.
- **Diseño:** antes de implementar una pantalla, lee `design/mobile/README.md`, su PNG en `design/mobile/screens/` y su HTML en `design/mobile/source/`. Los tokens salen de `design/mobile/source/codequim.css`. Si el código y el diseño no coinciden, gana el issue; avisa la diferencia en el PR.
- **Diseño web:** antes de implementar una pantalla W, lee `design/web/README.md`, su PNG en `design/web/screens/` y su fuente en `design/web/source/`. Los tokens se unifican en `packages/tokens`; si hay diferencias con `design/mobile/source/codequim.css`, se resuelven en un PR, no en el código de una pantalla.
- **Issues:** GitHub Issues son la fuente de verdad; `issues/NN-*.md` es un espejo con `NN` = número de GitHub (ver `issues/README.md`).
- **Términos del dominio:** un solo nombre en inglés en backend, móvil y web (glosario en `docs/glossary.md`, #16). Papeleta = **egg paddle** (`paddle_present`, `has_eggs`).
- **Textos al usuario:** la API nunca devuelve texto para el usuario; devuelve `code` + `params` y los clientes traducen con `packages/i18n`.

### Forma de trabajo (equipo de agentes)
El orquestador (sesión principal) planea, delega, revisa, integra y decide; no implementa a medias. Es responsable de todo lo que se entrega.

**Equipo** (`.claude/agents/`): `planner` (opus), `backend-dev`, `mobile-dev`, `web-dev`, `qa` (sonnet), `code-reviewer`, `security-reviewer` (opus), `docs-writer` (haiku). Antes de crear un agente nuevo se reutilizan los existentes (por ejemplo `ecc:django-reviewer`, `ecc:database-reviewer`, `ecc:react-reviewer`, `ecc:a11y-architect`). Modelo según la tarea: opus para planear, arquitectura y revisión final; sonnet para implementación acotada; haiku para tareas mecánicas.

**Flujo por issue**
1. `planner` parte el issue en tareas, interfaces y riesgos.
2. El implementador trabaja en su propio git worktree y rama (`feat|fix|chore/<n>-<slug>`). Solo se paralelizan issues sin dependencias entre sí ni archivos compartidos.
3. Cada delegación lleva: el issue, los archivos relevantes, el PNG y la fuente de diseño de la pantalla y los criterios de aceptación. Nada de instrucciones vagas.
4. Revisión, en paralelo: `code-reviewer` (siempre; incluye la auditoría de valor de las pruebas), `security-reviewer` (si toca datos, permisos, auth o entradas) y, en PRs con riesgo (sync, auth, permisos, migraciones, concurrencia), Codex (`/codex:adversarial-review`) desde la **primera** ronda, no al final. `qa` cuando falten pruebas de criterios. Las confirmaciones se piden al mismo revisor, que ya tiene contexto.
   - Una sola ronda consolidada por vez: se juntan los hallazgos de todos los revisores antes de regresarla al implementador.
   - Si un PR llega a 3 rondas por la misma clase de problema (carreras, sesión, orden), el orquestador cambia la regla de diseño (decisión nueva) en vez de seguir parchando casos.
5. Si algo no cumple, regresa al agente con observaciones concretas. Si un agente se atora dos veces en lo mismo: cambiar de enfoque o de modelo, o escalar al dueño con opciones.
6. Tablero en el PR: tarea · agente · estado.

**Definición de terminado:** criterios de aceptación cumplidos · pruebas · lint y formato limpios · reglas de `docs/engineering-rules.md` · documentación actualizada · CI en verde · revisión aprobada. Sin TODOs sueltos (lo que queda fuera se abre como issue con las 9 secciones y se liga en el PR), sin código muerto, cada dependencia nueva justificada en el PR.

**Codex** (autorizado por el dueño el 2026-11-03; desde el 2026-11-04 también **implementador en paralelo** para ahorrar límites de sesión de Claude, con las mismas reglas vía `AGENTS.md`): segundo revisor, implementador por rol y apoyo en tareas acotadas (`/codex:review`, `/codex:adversarial-review`, `/codex:rescue`; CLI `codex exec` solo si el plugin no cubre la tarea). Nunca se le envían secretos, `.env`, llaves ni datos reales de personas. Si contradice a otro revisor, se resuelve con evidencia (prueba o documentación oficial) y se anota en el PR. Si no está disponible, se sigue sin él.

**Git y reportes:** sin push forzado, sin borrar ramas ajenas, sin mezclar PRs, sin merge a `master` sin aprobación del dueño (o su autorización vigente para PRs que cumplen la definición de terminado). Al cerrar cada issue: 3–4 líneas (qué quedó y quién lo hizo, link del PR, pendientes, siguiente issue). Al cerrar cada fase: actualizar "Lecciones aprendidas", `docs/decisions.md` y `docs/glossary.md`, y proponer ajustes al equipo o al proceso.

**[PENDING] del cliente:** no se deciden; se dejan configurables o con un default documentado y se avisa al dueño.

### Web

**Scope:** `web/` is the React client for Supervisor, Entomologist, Promoter and Admin (plus the read-only public portal). It uses only the backend API through `packages/api-client`, plus `packages/tokens` and `packages/i18n`.

**Routes**
- Pattern: `/<area>/<resource>` for lists and `/<area>/<resource>/<code>` for records, with human codes, not database ids (e.g. `/incidents/I-0236`, `/lab/bags/B-4471`).
- Never put `organization_id` in a route or query string. The organization comes from the session.
- List filters, sorting and paging live in the query string, so every view can be shared and bookmarked.
- The public portal lives under its own prefix (`/portal/...`) with its own layout and its own read-only API (`/api/v1/portal/...`).
- Every screen has a code W1…W71 (see `docs/web-screens.md`). Reference it in the PR and in the route component name.

**Permissions per profile**
- The source of truth is `GET /api/v1/me/` (`permissions[]` + `scope`). Do not hard-code profile names in components; check permissions (e.g. `incidents.close`).
- No permission to see something: hide it (menu item, column, button).
- Allowed but blocked by state (closed quadrant, missing data, suspended permit): show the control disabled, with the reason and who can unblock it.
- The backend always re-checks. The UI check is for usability only.
- Revealing personal data (RFC) is an explicit action, it is logged, and its result is never cached.

**Tables and filters**
- Paging, sorting and filtering happen on the server. Never load a full table to filter it in the browser.
- Filters show as removable chips with a "Clear filters" action. The default filter is visible, never implicit.
- Voided rows: hidden by default and shown with an "Include voided" toggle. They render struck through with a "Voided" badge, the reason and the author.
- Number cells are right-aligned with tabular figures, and each one links to the filtered list behind it.
- Exports go through the backend (`/export/`), which applies data-transfer authorizations. An unauthorized personal-data column comes out empty with a note.
- No delete action anywhere. Correction = void with reason (required, minimum length per backend).
- Open option lists end with "Other (specify)", which requires the free text.

**Accessibility (WCAG 2.2 AA)**
- Everything works with the keyboard. Visible focus: 2px outline in `action` with 2px offset. The lab count screen (W35) is keyboard- and scanner-first.
- Target size of at least 24×24 px (2.5.8). Design controls are 32–44 px high.
- Never use color alone: status = color + icon/text, and map areas = color + pattern.
- Every chart has an equivalent data table.
- Contrast at least 4.5:1 for text, in both light and dark themes. Minimum text size 12px.
- Live regions for toasts and scan results. Modals trap focus and return it on close.
- Strings come from `packages/i18n` (es-MX default, en). No hard-coded copy. Layouts must survive +30 % text length.

**Formats**
- Dates and times in the organization's time zone. Weeks use the organization's epi week.
- Numbers use es-MX or en formatting according to the user's language.

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
- (web) The first design round assumed couriers send a field egg count. Wrong: mobile only records whether the egg paddle is present and, if so, whether it has eggs (Yes/No). Any comparison between a "field count" and the lab count must not exist.
- (repo) Los issues locales y los de GitHub se desfasaron porque un issue no se creó y el resto se corrió un número. Por eso GitHub es la fuente de verdad y el espejo usa su número.
- (proceso) Los agentes de `.claude/agents/` se cargan solo al iniciar la sesión de Claude Code: tras crearlos o cambiarlos, abrir una sesión nueva; mientras tanto se usan con `general-purpose` + "lee `.claude/agents/<nombre>.md`" y el mismo modelo.
- (git) `pre-commit install` escribe en `.git/hooks`, compartido por todos los worktrees: los agentes no instalan hooks; corren `pre-commit run --all-files` antes de cada commit.
- (herramientas) Versiones: la última no siempre es compatible. typescript-eslint 8.x exige TypeScript < 6.1 y los plugins de React piden ESLint 9; se fija la versión compatible y se anota el motivo en el PR.
- (Windows) Scripts que escriben archivos: `write_text(..., newline="\n")`; `.gitattributes` normaliza a LF.
- (seguridad) gitleaks marca como secreto texto tipo `clave=valor` en docs (p. ej. claves semilla de parámetros); se revisa y se agrega la huella a `.gitleaksignore` con el motivo.
- (mapas) La política de tiles de OpenStreetMap prohíbe uso offline y descarga masiva desde `tile.openstreetmap.org`: la fuente de tiles para el móvil es decisión del cliente (servidor propio con extracto OSM o proveedor que lo permita).
- (concurrency) Codex adversarial review encontró races reales en cada PR de riesgo (#2, #4, #5, #28). Se corrigen con reglas estructurales, no parches por caso: orden global de locks con try-lock que responde 429 (#4, #5), chequeos de FK diferidos dentro del mapeo 429 (#5), colas con timeout por petición donde las tareas solo esperan llamadas de red ligadas a una signal (#28) y un contador de `session revision` en lugar de relojes o booleanos (#28).
- (tests) Cada fix de race necesita un test de regresión determinista: promesas diferidas o barreras, nunca `setTimeout`. Los unit tests con historial en memoria no vieron un wrapper de router que sí detectó e2e (#28).
- (security) `Referrer-Policy: strict-origin-when-cross-origin` sigue filtrando la ruta completa en el mismo origen. Los tokens nunca van en paths de URL (#28; el reset por fragment queda en #58).
- (infra) Cada agente usa solo el Postgres del compose del proyecto, con su propio nombre de proyecto compose y un puerto único desde 55432 hacia arriba (el siguiente libre), nunca el 5432, que pertenece a otro proyecto.
- (proceso) Los revisores ya usados se reanudan con SendMessage: conservan contexto y sus confirmaciones son más rápidas. Los agentes nuevos se cargan solo al iniciar sesión (ver arriba).
- (schema) Database-free API export uses fixed, nonconnecting loopback placeholders and disabled dotenv reads; regenerate from backend source twice after contract integration, never hand-edit generated clients (#228, #224).
- (mobile) A valid server ETag/cursor does not hydrate a newly added local projection. Persist bootstrap readiness until a full body and cursor commit atomically; network errors, 304 and restart must retain recovery (#221).
- (tests) Bind cancellation to the exact started request, query the current DOM after replacement and create a fresh Response per request. A controlled regression does not establish an unreproduced historical CI cause (#235, #242).
- (tooling) Keep durable patches, proof manifests and commit-message files outside node_modules: npm ci removes that directory, including ignored temporary files (#217 integration).
- (planning) Check live issue contracts against actual missing interfaces. An OPEN umbrella acceptance issue alone does not prove a dependency is blocked; preserve existing route consumers when expanding a domain (#102/#104/#105 audit).
