# Guía de pruebas de extremo a extremo (de la A a la Z)

Para el dueño del producto. Web `http://127.0.0.1:5173` (apunta por proxy a la API `http://127.0.0.1:8000`) y la app Android (APK debug) en tu teléfono.

Cómo usarla: marca la casilla de cada prueba. Si algo falla, anota el código de la pantalla (W/P), qué hiciste y qué viste. Las filas con "(por verificar)" son cosas que no se pudieron confirmar leyendo el repo; pruébalas y avisa qué pasó.

Convenciones: W = pantalla web (`docs/web-screens.md`), P = pantalla móvil (`design/mobile/README.md`). Los datos son sintéticos; no uses datos reales de personas.

**Contraseñas:** nunca van en esta guía. Para todos los usuarios: contraseña: ver `backend/demo-credentials.local.md` (archivo local fuera de git).

---

## 0. Requisitos y arranque

### 0.1 Servicios locales

Ya están levantados para la sesión desde el master final (web en 5173, API en 8000).

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 0.1 | Abre `http://127.0.0.1:8000/api/v1/health/` | Responde `{"status":"ok"}` | [ ] |
| 0.2 | Abre `http://127.0.0.1:5173` | Aparece la pantalla de inicio de sesión W1 | [ ] |

### 0.2 Usuarios y datos de prueba

Los datos salen de `python manage.py seed_demo` (organización `demo`), que ya se corrió en la base local. Usuarios sembrados (perfil entre paréntesis):

| Usuario | Perfil |
|---------|--------|
| `demo-admin` | admin |
| `demo-supervisor` | supervisor |
| `demo-courier-1`, `demo-courier-2` | courier |
| `demo-entomologist` | entomologist |
| `demo-promoter` | community_promoter |
| `demo-coordinator` | coordinator |
| `demo-warehouse` | warehouse |
| `demo-regulatory` | regulatory |
| `demo-government` | government |

Datos sembrados:

- Cuadrantes `Q-DEMO-01`, `Q-DEMO-02`, `Q-DEMO-03`. `demo-courier-1` cubre Q-DEMO-01 y Q-DEMO-02; `demo-courier-2` cubre Q-DEMO-03.
- Motos `M-DEMO-01`, `M-DEMO-02`. Ubicación `LOC-DEMO-01`.
- Insumos `S-DEMO-PADDLE`, `S-DEMO-BAG`, `S-DEMO-WOLB`; lotes `L-DEMO-PADDLE`, `L-DEMO-BAG`, `L-DEMO-WOLB`.
- Permiso de liberación `PERMIT-DEMO-01`, dispositivo `RD-DEMO-01`, capacitación `TR-DEMO-RELEASE` (ya certificada para ambos repartidores).
- Ovitrampas en bloque `Q-DEMO-01-B1`: P1, P2 y P3 ya tienen lectura esta semana (bolsas `B-DEMO-001` a `B-DEMO-003`); **P4 está lista para revisarse por QR**. El texto de cada QR está en `backend/demo-credentials.local.md`.
- Tarea de liberación de hoy: punto `Q-DEMO-01-REL-P1`.

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 0.3 | Confirma que existe `backend/demo-credentials.local.md` en tu equipo | Lista usuarios, contraseñas y textos QR (no lo compartas ni lo subas al repo) | [ ] |

### 0.3 Iniciar sesión en la web

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 0.4 | En W1 escribe `demo-admin` con contraseña equivocada | Mensaje de error claro; no dice cuál de los dos datos falló; no hay "crear cuenta" | [ ] |
| 0.5 | Entra con la contraseña correcta | Entras al shell con menú lateral; si perteneces a varias organizaciones, aparece `/select-organization` | [ ] |
| 0.6 | Escribe a mano `http://127.0.0.1:5173/ruta-que-no-existe` | Estado "no encontrado" dentro del shell | [ ] |
| 0.7 | Cierra sesión y abre `http://127.0.0.1:5173/settings/roles` | Te manda a `/login` y, tras entrar, regresa a la ruta pedida | [ ] |

### 0.4 Instalar el APK en tu teléfono

Tú instalas el APK. Archivo: `C:/Users/Bravo17/Downloads/wolbachia-qa-2026-11-10/wolbachia-debug-apk-8c4fb48/app-debug.apk`, compilado desde `master` 8c4fb48, que incluye todos los cambios móviles.

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 0.8 | Pasa el `.apk` al teléfono (cable USB, Drive o correo) y ábrelo desde la app Archivos | Android pide permiso de **instalar apps de orígenes desconocidos** | [ ] |
| 0.9 | Concede el permiso solo a la app que usaste para abrir el archivo y confirma la instalación. Al terminar, vuelve a desactivarlo | App "wolbachia field" (id `mx.pyrobyte.wolbachia.field`) instalada | [ ] |
| 0.10 | Abre la app. En **Ajustes** (o **Configurar servidor** en P1) escribe la dirección del servidor: http://127.0.0.1:8000 (con el teléfono conectado por USB y `adb reverse tcp:8000 tcp:8000`). Guarda | Se guarda; el APK debug permite http en red privada | [ ] |
| 0.11 | Inicia sesión como `demo-courier-1` (con señal) y crea un PIN de 4 dígitos no trivial (P1/P2) | PIN aceptado; uno trivial como 1234 o 0000 se rechaza (por verificar la lista exacta) | [ ] |
| 0.12 | Manda la app a segundo plano o espera el bloqueo por inactividad y desbloquea con el PIN, sin señal | Desbloquea sin servidor | [ ] |

---

## 1. Administrador (web, `demo-admin`)

Contraseña: ver `backend/demo-credentials.local.md`.

### 1.1 Organización y parámetros (Ajustes)

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 1.1 | Abre **Ajustes** (`/settings`) | Tarjetas: Teléfonos, Parámetros de regla, Catálogos, Organización, Roles, Tipos de incidente | [ ] |
| 1.2 | `/settings/organization` (W68): revisa nombre, país, zona horaria, semana epi, idiomas | Datos de la organización `demo` | [ ] |
| 1.3 | `/settings/rule-parameters` (W62): abre un parámetro y cambia su valor con fecha efectiva de mañana | Se crea una **versión nueva**; ves antes/después y el historial; la anterior no se sobrescribe | [ ] |
| 1.4 | Un parámetro sin valor del brief | Aparece como "no configurado" hasta que le pongas una versión | [ ] |
| 1.5 | Guarda un valor inválido (texto en campo numérico, negativo en umbral) | Error de validación junto al campo; no se guarda | [ ] |

### 1.2 Catálogos y tipos de incidente

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 1.6 | `/settings/catalogs` (W63): abre un catálogo y agrega "Prueba A" | Aparece en la lista | [ ] |
| 1.7 | Busca una acción de **borrar** en cualquier catálogo | No existe; solo se desactiva | [ ] |
| 1.8 | Desactiva "Prueba A" | Queda inactivo, no desaparece | [ ] |
| 1.9 | En una lista abierta elige "Otro (especificar)" sin texto | El sistema exige el texto libre | [ ] |
| 1.10 | `/settings/incident-types` (W64): revisa los tipos sembrados e intenta desactivar "Otro" | Se ven los tipos de demo; "Otro" no se puede desactivar | [ ] |

### 1.3 Cuadrantes, flota y permiso de liberación

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 1.11 | `/quadrants` (W22): revisa Q-DEMO-01 a Q-DEMO-03 | Mapa y lista con los tres cuadrantes | [ ] |
| 1.12 | `/fleet/motorcycles` (W20): revisa M-DEMO-01 y M-DEMO-02 | Lista con km y estado | [ ] |
| 1.13 | Permiso `PERMIT-DEMO-01` con el dispositivo `RD-DEMO-01` | (por verificar) No hay ruta web propia: `/releases` es un marcador de posición. Anota dónde (si en algún lugar) se ve el permiso | [ ] |

### 1.4 Permisos, teléfonos y notificaciones

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 1.14 | `/settings/roles` (W65): revisa la matriz perfiles x acciones | Perfiles externos fijos y en solo lectura | [ ] |
| 1.15 | Quita `incident.read` al perfil supervisor y vuelve a entrar como `demo-supervisor`; luego restáuralo | El menú "Incidentes" ya no aparece (oculto, no deshabilitado) | [ ] |
| 1.16 | Intenta quitar tu propio último permiso de administrador | Se bloquea con motivo (por verificar el texto) | [ ] |
| 1.17 | `/settings/phones` (W67), tras iniciar sesión en el APK (sección 3) | Aparece tu teléfono con su versión de app | [ ] |
| 1.18 | Revoca la sesión de ese teléfono desde la lista | La app pide iniciar sesión (con señal); el trabajo pendiente no se pierde | [ ] |
| 1.19 | `/notifications` (W5) | Sin leer primero, agrupadas por tipo; puedes marcar como leída; no hay borrar | [ ] |
| 1.20 | W48 (Usuarios), W49 (Persona), W66 (Llaves API), W3 y W4 (búsqueda y registro universal) | No hay ruta en `web/src/router/router.tsx`: al teclear la dirección debe salir "no encontrado". Confirmado en el router; basta con confirmar en pantalla | [ ] |

---

## 2. Supervisor (web, `demo-supervisor`) y bodega (`demo-warehouse`)

Contraseñas: ver `backend/demo-credentials.local.md`.

### 2.1 Cuadrantes y puntos (supervisor)

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 2.1 | `/quadrants` (W22) | Mapa con color y patrón (no solo color) y lista lateral | [ ] |
| 2.2 | Abre `/quadrants/Q-DEMO-01/versions` (W23): crea una versión nueva dejando un punto fuera del polígono | No deja guardar hasta resolver cada punto excluido | [ ] |
| 2.3 | W24 (bloques y puntos): dos puntos a menos de 50 m | (por verificar) No hay ruta propia de W24; ¿se ve dentro de W23? Si hay advertencia de cercanía, anótala | [ ] |

### 2.2 Operación del día (supervisor)

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 2.4 | `/operations` | Accesos a Turnos, Cola de revisión, Reubicaciones | [ ] |
| 2.5 | `/operations/shifts` y `/operations/shifts/<id>` (W29): abre el turno cerrado de `demo-courier-1` (después de la sección 3) | Resumen del turno; puedes "Observar" con motivo. El detalle usa `id`, no código humano (excepción conocida) | [ ] |
| 2.6 | Observa el turno sin motivo | No deja: el motivo es obligatorio | [ ] |
| 2.7 | `/operations/reviews` (W30): abre un evento `in_review` | Ves qué pasó y la evidencia; opciones Aceptar / Anular con motivo / Abrir incidente | [ ] |
| 2.8 | Anula un registro con motivo "Prueba de anulación E2E" | Queda tachado, con insignia "Anulado", motivo y autor; con "Incluir anulados" apagado se oculta | [ ] |
| 2.9 | Busca un botón "Eliminar" en cualquier tabla | No existe; corregir = anular con motivo | [ ] |
| 2.10 | `/operations/relocations` (W31): aprueba una reubicación propuesta desde el móvil y rechaza otra | Aprobar mueve el punto conservando el código; rechazar crea tarea para el día siguiente (por verificar) | [ ] |
| 2.11 | `/quadrants/Q-DEMO-01/closure` (W33) con una ovitrampa "No recuperada" | Cierre bloqueado y muestra el motivo | [ ] |
| 2.12 | W25, W26, W28 (asignación de cuadrantes, programación, turnos en vivo) | No hay ruta en el router; no deben existir como pantalla | [ ] |

### 2.3 Incidentes (supervisor)

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 2.13 | `/incidents` (W6): filtra por estado y gravedad | Chips removibles con "Limpiar filtros"; el filtro vive en la URL | [ ] |
| 2.14 | Abre `/incidents/<código>` (W7), reasigna y cambia la gravedad | Queda en la cronología inmutable | [ ] |
| 2.15 | Cierra un incidente sin la evidencia que pide su tipo | Bloqueado; indica qué falta | [ ] |

### 2.4 Bodega: inventario y plan de entrega (`demo-warehouse`)

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 2.16 | `/inventory/lots` (W9): revisa L-DEMO-PADDLE, L-DEMO-BAG, L-DEMO-WOLB en `LOC-DEMO-01` (`/inventory/locations`, W11) | Lotes con existencias; bloqueado muestra motivo | [ ] |
| 2.17 | `/inventory/assignments` (W15): abre el plan de entrega de `demo-courier-1` y **libéralo** (paso 1 de la liberación, ver 3.7) | El plan queda liberado; el repartidor lo recibe y firma en el teléfono | [ ] |
| 2.18 | `/inventory/reconciliations` (W16) al final del día | Asignado / usado / devuelto / merma / diferencia; diferencias en rojo con "Abrir discrepancia" o "Justificar" | [ ] |
| 2.19 | `/inventory/write-offs` (W17): baja de un lote biológico sin recibo RPBI | Pide el recibo RPBI; sin él no deja | [ ] |
| 2.20 | `/inventory/transfers` (W12) y `/inventory/discrepancies` (W14) | Transferencias con firmas; la discrepancia se cierra con motivo | [ ] |
| 2.21 | W13 (Recepción en centro) | No hay ruta propia en el router | [ ] |
| 2.22 | `/fleet/motorcycles/M-DEMO-01` (W21) tras la sección 3 | Pestañas Resumen, Servicios, Combustible, Incidentes; aparece la carga de combustible | [ ] |
| 2.23 | `/people/evaluations` (W51) y `/people/trainings` (W50) | Hoja de evaluación (Presentación, Ejecución, Cobertura); TR-DEMO-RELEASE con certificaciones | [ ] |

### 2.5 Permisos y estados bloqueados

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 2.24 | Como supervisor, teclea `/settings/roles` | Acceso denegado; el menú no muestra lo que no tienes | [ ] |
| 2.25 | Como supervisor, teclea `/lab/bags` (sin `bag.receive`) | Denegado | [ ] |
| 2.26 | Un botón permitido pero bloqueado por estado (cuadrante cerrado, permiso suspendido) | **Deshabilitado**, con la razón y quién lo desbloquea | [ ] |
| 2.27 | Cualquier tabla: ordena y pagina | La URL cambia; recargar conserva | [ ] |

---

## 3. Repartidor (app Android, `demo-courier-1`)

Contraseña: ver `backend/demo-credentials.local.md`. Haz primero el recorrido con señal y luego el bloque 3.9 sin señal. Pantallas en `mobile/src/features/`.

### 3.1 Inicio de turno (P3 a P8)

Antes: la bodega ya liberó el plan (2.17).

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 3.1 | Abre la app, desbloquea con PIN y llega al inicio (P3) | Chip de sincronización y botón para abrir turno | [ ] |
| 3.2 | Abre turno (P4 a P7) con la moto `M-DEMO-01`: odómetro `12450` con foto, lista de revisión de la moto | Cada paso guarda en el teléfono sin esperar al servidor | [ ] |
| 3.3 | En la lista de la moto marca una falla grave | Se bloquea la salida y se muestra el motivo (por verificar el texto) | [ ] |
| 3.4 | Intenta salir sin foto de odómetro | No deja y dice qué falta | [ ] |
| 3.5 | P8: recibe el plan liberado: confirma cantidades y **firma en pantalla** | Recibo guardado; "firma pendiente" y "enviado al servidor" son estados distintos. Sin recibir el plan no hay custodia del lote y la liberación no pasa | [ ] |
| 3.6 | Declara una cantidad distinta de la asignada | Pide explicar la diferencia | [ ] |

### 3.2 Día de trabajo (P9 y P10)

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 3.7 | Lista del día (P9) | Tareas ordenadas por riesgo, con progreso; incluye la liberación de `Q-DEMO-01-REL-P1` | [ ] |
| 3.8 | Cambia a mapa (P10) y toca un punto | Detalle del punto con historial y botón de navegación. Sin manifiesto de mapa (B-13) sale "mapa no disponible" y la lista sigue funcionando | [ ] |

### 3.3 Escaneo QR (P11, P12, P21)

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 3.9 | Escanea el QR de `Q-DEMO-01-B1-P4` (o teclea su texto de `demo-credentials.local.md`; acepta permiso de cámara) | Reconoce el código y te lleva al punto | [ ] |
| 3.10 | Escanea un QR ajeno (cualquier QR de tienda) | Código inválido (P21) con captura manual | [ ] |
| 3.11 | Escanea el mismo código dos veces seguidas | Aviso de duplicado | [ ] |
| 3.12 | Enciende la linterna del visor | Se prende y apaga | [ ] |
| 3.13 | P12: abre el detalle de un insumo escaneado | Lote, unidad y asignación reales; no inventa existencias ni caducidad | [ ] |

### 3.4 Ovitrampas con papeleta Sí/No (P13 a P17)

Regla clave: el repartidor **no cuenta huevos**. Solo marca si hay papeleta y, si la hay, Sí/No (¿tiene huevos?).

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 3.14 | P14: revisa `Q-DEMO-01-B1-P4` por QR, con **Papeleta presente = Sí** y **¿Tiene huevos? = Sí**, bolsa nueva | Se guarda `paddle_present = true`, `has_eggs = true`; no hay campo de número de huevos | [ ] |
| 3.15 | Intenta revisar P1, P2 o P3 | La app **bloquea** por ya tener lectura esta semana (comportamiento correcto) | [ ] |
| 3.16 | Con otra ovitrampa disponible: **Papeleta presente = No** | La pregunta de huevos desaparece o queda vacía | [ ] |
| 3.17 | Otra con papeleta presente y **¿Tiene huevos? = No** | Se guarda `has_eggs = false` | [ ] |
| 3.18 | Papeleta presente sin contestar Sí/No | No deja; pide responder | [ ] |
| 3.19 | P13, colocar: elige un punto libre con tarea "colocar", escanea la ovitrampa nueva | Evento guardado con la hora del dispositivo | [ ] |
| 3.20 | P15, reemplazar la ovitrampa de un punto | El **código del punto** se conserva; cambia la ovitrampa física; queda historial | [ ] |
| 3.21 | P16, reubicar: propone otra ubicación con foto y motivo | Queda como **propuesta** hasta que el supervisor la apruebe (2.10) | [ ] |
| 3.22 | P17, retirar con evidencia | Se registra; si queda "no recuperada" aparece la razón | [ ] |
| 3.23 | Corrige una revisión ya guardada | La original sigue; se crea un evento de corrección que la referencia | [ ] |

### 3.5 Combustible (P22)

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 3.24 | P22: carga de `8.5` litros, odómetro `12480`, foto del ticket | Guardado local; ligado a la moto del turno | [ ] |
| 3.25 | Cierra la app a la fuerza y reábrela | La captura sigue ahí | [ ] |
| 3.26 | Sin historial comparable | "Datos insuficientes"; no inventa rendimiento | [ ] |

### 3.6 Incidentes y emergencia (P23, P24)

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 3.27 | P23: incidente (tipo del catálogo, "Tapa de ovitrampa rota", foto) | Guardado offline y visible luego en `/incidents` (W6) | [ ] |
| 3.28 | P24: registra un accidente (emergencia) | Guardado; si falta la configuración de emergencia, la app lo dice | [ ] |
| 3.29 | Elige "Otro" sin escribir texto | Pide el texto libre | [ ] |

### 3.7 Liberación de Wolbachia (P18 a P20)

Flujo de punta a punta, **en este orden**:

1. La bodega libera el plan de entrega en la web (2.17).
2. `demo-courier-1` inicia turno con `M-DEMO-01` y recibe el plan con firma (3.2 y 3.5).
3. `demo-courier-1` libera en `Q-DEMO-01-REL-P1` con el lote `L-DEMO-WOLB`.
4. El supervisor acepta la revisión de tránsito en la web (3.34).

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 3.30 | P18: abre la tarea de liberación de `Q-DEMO-01-REL-P1`: permiso `PERMIT-DEMO-01`, dispositivo `RD-DEMO-01`, lote `L-DEMO-WOLB` | Pantalla de liberación con los datos reales; la capacitación `TR-DEMO-RELEASE` ya está certificada | [ ] |
| 3.31 | Confírmala | La liberación queda **pendiente de revisión de tránsito** | [ ] |
| 3.32 | Prueba el caso bloqueado (P19), por ejemplo sin haber recibido el plan | Liberación bloqueada con motivo (P19 vive dentro de la pantalla de liberación; por verificar si se puede provocar con estos datos) | [ ] |
| 3.33 | **Tras liberar, revisa que la siguiente sincronización funcione normal** (chip sin error, inbox sin rechazos, turno sigue cerrando). Punto de riesgo conocido, ver #360 | Sincroniza sin quedarse trabada; si falla, anota el código del inbox | [ ] |
| 3.34 | Como `demo-supervisor`, abre `/operations/reviews` (W30) y acepta la revisión de tránsito de la liberación | Liberación aceptada; sale de la cola (por verificar que la revisión de tránsito aparece en W30) | [ ] |
| 3.35 | P20 (muestra) | Pantalla de muestra con datos reales o aviso claro si no hay | [ ] |

### 3.8 Cierre de turno (P26, P27) y ajustes

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 3.36 | P26: cierra turno con odómetro final `12520`, devuelve insumos sobrantes | Resumen del turno; pendientes sin enviar se listan | [ ] |
| 3.37 | Cierra con una diferencia de insumos sin explicar | **No** bloquea el cierre; se abre una discrepancia visible en W16 | [ ] |
| 3.38 | P27: confirmación | Turno cerrado en el teléfono; luego aparece en W29 | [ ] |
| 3.39 | Ajustes (P31): English, apariencia oscura, texto más grande | Se aplica y se conserva al reiniciar | [ ] |
| 3.40 | P29 historial y P30 capacitaciones propias | Muestran lo local; sin inventar totales | [ ] |
| 3.41 | P32 bloqueo por velocidad | Existe `P32Screen`; requiere moverse o simular (#145); solo si es práctico | [ ] |
| 3.42 | P25 (comunidad) | No existe en el código del móvil | [ ] |

### 3.9 Modo sin conexión y sincronización

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 3.43 | **Modo avión**. Captura (turno abierto o nuevo, p. ej. con `demo-courier-2`, `M-DEMO-02`, Q-DEMO-03): 2 revisiones, 1 combustible, 1 incidente | Nada espera al servidor; el chip muestra eventos pendientes | [ ] |
| 3.44 | Abre el inbox tocando el chip (P28) | Pendientes con estado; **no hay opción de borrar** | [ ] |
| 3.45 | Apaga el modo avión | Sincroniza sola (o "Intentar ahora"); los eventos pasan a enviados | [ ] |
| 3.46 | En la web, como supervisor, revisa los eventos del móvil | Aparecen con **hora del dispositivo** y **hora de recepción** | [ ] |
| 3.47 | Cambia la hora del teléfono 2 horas atrás, captura y sincroniza | Si la diferencia supera el umbral, queda `in_review` en W30; si el reloj está muy mal, el envío se detiene y el inbox lo explica | [ ] |
| 3.48 | Cierra y reabre la app justo al sincronizar | No se duplica nada (UUID del cliente, idempotente) | [ ] |
| 3.49 | Un evento rechazado por el servidor (p. ej. `void_target_not_found`) | El inbox muestra el código del rechazo y qué hacer, sin perder el original | [ ] |
| 3.50 | Anulación con motivo de un registro propio | Evento de anulación que referencia al original; el original no se borra | [ ] |

---

## 4. Entomólogo / laboratorio (web, `demo-entomologist`)

Contraseña: ver `backend/demo-credentials.local.md`. Bolsas sembradas: `B-DEMO-001` a `B-DEMO-003`; la bolsa de P4 sale de la revisión 3.14.

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 4.1 | `/lab` | Accesos a Recepción de bolsas, Conteo de huevos, Historial, Bajas | [ ] |
| 4.2 | `/lab/bags` (W34): escanea o teclea `B-DEMO-001` | Código, bloque, lectura, fecha, colector y **papeleta presente + ¿tiene huevos? (Sí/No)** tal como lo capturó el repartidor | [ ] |
| 4.3 | Recibe una bolsa de revisión con papeleta **No** (3.16) | "Sin lectura" y abre un incidente | [ ] |
| 4.4 | Escanea un código de bolsa que no llegó ("faltante") | Registra faltante y abre incidente | [ ] |
| 4.5 | Escaneo continuo: `B-DEMO-001` a `B-DEMO-003` sin tocar el mouse | Cada escaneo se agrega sin perder el foco | [ ] |
| 4.6 | `/lab/egg-counts` (W35): captura `37` y Enter | Guarda y salta a la siguiente bolsa; foco fijo en el campo grande; atajos visibles | [ ] |
| 4.7 | Conteo con letras (`3a`) o negativo (`-4`) | Rechaza con error junto al campo | [ ] |
| 4.8 | La bolsa 3.17 ("no tiene huevos") capturada con 12 | Aviso o revisión (por verificar la regla exacta). **No** debe existir comparación "conteo de campo vs laboratorio" | [ ] |
| 4.9 | Con la API apagada (el orquestador lo hace) | No avanza a la siguiente bolsa y muestra el error | [ ] |
| 4.10 | `/lab/count-history`: busca tu conteo | Historial de intentos; sin borrar. Corregir = anular con motivo | [ ] |
| 4.11 | Anula un conteo con motivo de una letra | Rechaza por motivo muy corto | [ ] |
| 4.12 | `/lab/write-offs` (W39): baja de bolsas biológicas con motivo, fecha y recibo RPBI | Sin recibo RPBI no deja | [ ] |
| 4.13 | W36, W37, W40 (recuentos, papeletas recicladas, resultados Wolbachia) | No hay ruta en el router; no deben existir | [ ] |
| 4.14 | `/inventory/lots/<código>/conditions` (W18): dos lecturas fuera de rango | Lote "Bloqueado" con motivo y enlace al incidente | [ ] |
| 4.15 | `/quadrants` (W22) como entomólogo | Ve mapa; puede abrir versiones (W23) | [ ] |
| 4.16 | `/operations/shifts` como entomólogo | Denegado si no tiene `shift.read` | [ ] |

---

## 5. Promotor, coordinador, regulatorio y gobierno

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 5.1 | Entra con `demo-promoter` | Ve Inicio y Notificaciones; el menú solo muestra lo que su perfil permite | [ ] |
| 5.2 | Abre `/community` (W52) | Marcador de posición (`AreaPlaceholder`); sin pantalla real | [ ] |
| 5.3 | Teclea `/settings/roles`, `/lab/bags` o `/inventory/lots` como promotor | Denegado | [ ] |
| 5.4 | Entra con `demo-coordinator` y revisa su menú | Solo ve lo que su perfil permite (por verificar qué pantallas tiene hoy) | [ ] |
| 5.5 | Entra con `demo-regulatory` y abre `/regulatory` (W57 a W61) | Marcador de posición; sin pantallas reales | [ ] |
| 5.6 | Entra con `demo-government` | Debe ver solo el portal público (ver sección 6) | [ ] |
| 5.7 | Móvil P25 (comunidad) | No existe en el código del móvil | [ ] |

Contraseñas: ver `backend/demo-credentials.local.md`.

---

## 6. Portal público (W69 a W71)

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 6.1 | Abre `http://127.0.0.1:5173/portal` | No hay ruta `/portal` en `web/src/router/router.tsx`: debe salir "no encontrado" o redirigir a login | [ ] |
| 6.2 | Entra con `demo-government` y busca el portal | (por verificar) La nota de la semilla dice que solo ve el portal, pero el router no lo expone; anota qué ves | [ ] |
| 6.3 | Sin sesión, abre cualquier ruta del back-office | Siempre te manda a `/login` | [ ] |

---

## 7. Pruebas transversales

| # | Qué hacer | Resultado esperado | OK |
|---|-----------|--------------------|----|
| 7.1 | Aislamiento: ¿alguna URL lleva `organization_id`? | No; la organización sale de la sesión | [ ] |
| 7.2 | Rutas con código humano | `/incidents/I-...`, `/fleet/motorcycles/M-DEMO-01`; el detalle de turno usa `$id` (excepción conocida) | [ ] |
| 7.3 | Cambia la web a English | Textos cambian; no quedan textos sueltos en español | [ ] |
| 7.4 | Tema oscuro y texto +30 % (zoom 130 %) | El diseño aguanta sin cortar texto | [ ] |
| 7.5 | Solo teclado: tabula por una pantalla | Foco visible (borde de 2 px), todo se alcanza | [ ] |
| 7.6 | Exportaciones (`/export/`) | No hay pantalla de exportación en el router (por verificar el comportamiento de la API) | [ ] |
| 7.7 | Anulados | El interruptor "Incluir anulados" aparece y oculta/muestra | [ ] |
| 7.8 | Un error de la API | Texto traducido, no un código crudo ni texto del servidor | [ ] |
| 7.9 | 11 logins fallidos en un minuto | Bloqueo por límite de intentos (10/min por usuario e IP por defecto) | [ ] |

---

## 8. Qué aún no está

Fuentes: `docs/web-screens.md`, `web/src/router/router.tsx` y `areas.ts`, `mobile/README.md`, `docs/api-conventions.md` y la lista de pendientes del orquestador.

### Issues abiertos conocidos

| Issue | Pendiente |
|-------|-----------|
| #354 | Selector de PDF en web y móvil, y descarga del PDF oficial de un permiso |
| #357 | Selección de piezas, bajas anuladas, enlace exacto a la discrepancia y e2e con Playwright para W15 a W17 |
| #360 | Desempeño de la sincronización y la prueba de regresión del arreglo de sync tras liberar |
| #146 | Aprovisionamiento de teléfonos en modo dedicado y actualizaciones desde la app; los estados de batería y de actualización son marcadores de posición |

### Pantallas y flujos que no existen en el código

| Área | Falta |
|------|-------|
| Web | Marcadores de posición sin pantalla real: Liberaciones (W43 a W47), Comunidad (W52), Dashboards (W53 a W56), Regulatorio (W57 a W61) |
| Web | Sin ruta: W3, W4, W13, W19, W24 (por verificar), W25, W26, W27, W28, W32, W36, W37, W38, W40, W41, W42, W48, W49, W66 |
| Web | Portal público W69 a W71: sin ruta |
| Móvil | Sin pantalla: P25 (comunidad). P19 (liberación bloqueada) vive dentro de la pantalla de liberación (P18) |
| Mapa | El mapa del día depende del manifiesto B-13; las pruebas de mosaicos offline están pendientes (decisión de fuente de tiles abierta, OpenStreetMap prohíbe descarga masiva offline) |

### Sin probar en dispositivo

- **Batería y actualizaciones:** marcadores de posición; la instalación real depende de #146.
- **Lector USB físico** (W35 con escáner de código de barras).
- **TalkBack** (web y móvil) y texto al 130 % en el teléfono.
- **SQLCipher nativo y cámara física** en el aparato.
- **Desempeño:** el APK debug es lento; no lo uses para medir velocidad.
