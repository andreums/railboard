# Documentación funcional de RailBoard

> Sistema de paneles informativos ferroviarios multiestación, inspirado en los paneles Gravita/ADIF de Renfe.
> Sitio web: [https://railboard.app](https://railboard.app)

---

## Funcionalidad: Panel de salidas/llegadas

**Objetivo:** Mostrar en pantalla completa los horarios de trenes de una estación, con un diseño inspirado en los paneles Gravita de ADIF.

**Actores:** Viajeros (público general), visitantes de la estación.

**Precondiciones:** Hay al menos un display configurado con una estación asignada y trenes creados.

**Flujo principal:**

1. El panel carga la configuración del display (`/config`), la lista de estaciones (`/stations`) y los lugares (`/places`).
2. Solicita los datos del tablero vía `GET /stations/:id/board?mode=departures|arrivals`.
3. Filtra los trenes con estado diferente de `Departed`/`Arrived`, los ordena por hora prevista y muestra hasta 12 filas.
4. Cada fila se distribuye en dos sub-rows: superior (60%) con TIME, DESTINATION, PRODUCT (logo + número), PLATFORM; inferior (40%) con estado estimado, paradas intermedias, observaciones y badge de Cercanías.
5. El footer muestra un texto configurable con animación `marquee`.
6. Si hay varios idiomas configurados, alterna cada 5 segundos entre ellos.
7. El reloj en modo real muestra la hora del sistema; en modo ficticio avanza a una velocidad configurable.

**Flujos alternativos:**

- Si el endpoint board falla, hace fallback a `GET /trains` (lista plana de trenes).
- Si no se encuentra ningún tren o está cargando, se muestra la animación `SteamTrain`.
- El error de carga muestra un botón "Reintentar ahora".

**Errores esperables:**

- `GET /stations/:id/board` retorna 404 si la estación no existe.
- Error de configuración: se muestra "Error al cargar la configuración".

**Permisos:** Público (sin autenticación).

**Datos implicados:** `Config` (estilo, idiomas, modo), `Train[]` (trenes), `Place[]` (destinos), `Station[]` (estaciones).

**Componentes técnicos:**

- `frontend/src/pages/Display.tsx` — Componente principal del panel.
- `frontend/src/components/Clock.tsx` — Reloj en modo real o ficticio.
- `frontend/src/components/SteamTrain.tsx` — Animación de locomotora de vapor durante carga.
- `frontend/src/components/StatusPill.tsx` — Indicador de estado visual.
- `frontend/src/lib/i18n.ts` — Sistema de traducciones (es, ca, en, fr, eu, gl).
- `frontend/src/lib/api.ts` — Conexión con API y WebSocket.
- `backend/src/routes.js:1563-1674` — Endpoint `GET /stations/:stationId/board`.
- `backend/src/ws.js` — Notificaciones WebSocket (`service_updated`).

**Riesgos o limitaciones:**

- La rotación de idiomas muestra textos en diferentes lenguas sin control de temporización por fila.
- El marquee de paradas se basa en `scrollWidth`, puede fallar si el texto cambia dinámicamente.

**Evidencias:** `frontend/src/pages/Display.tsx:1-841`, `frontend/src/components/Clock.tsx:1-45`, `frontend/src/components/SteamTrain.tsx:1-186`, `frontend/src/components/StatusPill.tsx:1-30`.

---

## Funcionalidad: Administración de trenes (CRUD)

**Objetivo:** Gestionar los trenes del sistema: crear, editar, eliminar, reordenar y exportar.

**Actores:** Administrador de la estación.

**Precondiciones:** El usuario se ha autenticado vía HTTP Basic Auth.

**Flujo principal:**

1. El usuario accede a `/trains` (página independiente) o a la pestaña "Trenes" del panel de administración.
2. Se carga la lista de trenes con datos enriquecidos (operador, tipo, estación).
3. El usuario puede:
   - **Crear:** Abre un modal con formulario: número, operador, tipo, origen, destino, paradas, hora programada/estimada, vía, sector, estado, observaciones, modo de icono.
   - **Editar:** Modal rellenado con datos del tren seleccionado.
   - **Eliminar:** Diálogo de confirmación `confirm()`.
   - **Reordenar:** Activa modo drag-and-drop con `@dnd-kit` y envía el orden vía `PUT /trains/reorder`.
   - **Anunciar:** Usa la Web Speech API para leer un anuncio de megafonía.
   - **Exportar:** `GET /trains/export` descarga un JSON.

**Flujos alternativos:**

- En modo reordenación, los IDs de los trenes se envían al backend para actualizar `sort_order`.
- El cálculo de retraso es automático a partir de la hora programada y la estimada.

**Errores esperables:**

- `DELETE /trains/:id` → 404 si el tren no existe.
- `POST /trains` → 400 si faltan campos obligatorios.

**Permisos:** Administrador (Basic Auth).

**Datos implicados:** `Trains` (tabla SQLite), `Operators`, `TrainTypes`, `Places`, `Stations`.

**Componentes técnicos:**

- `frontend/src/pages/Trains.tsx` — CRUD completo con formulario, lista, drag and drop.
- `frontend/src/pages/Admin.tsx` — Sección de gestión de trenes dentro del panel admin (líneas 639-696).
- `frontend/src/components/admin/GenerationPanel.tsx` — Generación rápida de trenes.
- `backend/src/routes.js:751-833` — Endpoints REST (`GET/POST/PUT/DELETE /trains`, `/trains/reorder`, `/trains/export`).
- `backend/src/db.js:57-301` — Tabla y operaciones CRUD.

**Riesgos o limitaciones:**

- El drag and drop solo funciona en modo reordenación; no hay reordenación por defecto.
- La eliminación masiva requiere header `X-Confirm: yes`.
- No hay paginación en listas largas.

**Evidencias:** `frontend/src/pages/Trains.tsx:1-556`, `backend/src/routes.js:751-833`, `backend/src/db.js:57-301`.

---

## Funcionalidad: Generación inteligente de trenes

**Objetivo:** Crear trenes automáticamente a partir de rutas reales del dataset ferroviario, con horarios, retrasos y observaciones realistas.

**Actores:** Administrador (generación manual o automática).

**Precondiciones:** El dataset de rutas (`railboard_routes.json`) debe estar cargado. Debe haber operadores, tipos de tren y lugares en el sistema.

**Flujo principal:**

1. El administrador presiona "Generar 1 tren" o activa la auto-generación con intervalo configurable.
2. El backend llama a `ensureLearnedRailData()` para asegurar que operadores, tipos y lugares base existen.
3. Selecciona una ruta del dataset con ponderación inversa a los usos recientes (favorece rutas menos usadas).
4. Determina dirección (ida/vuelta) basada en la posición de la estación dentro de la ruta.
5. Calcula el horario: respeta `headwayMin` de la ruta, con un 14% de probabilidad de tren "pasado" (hacia atrás).
6. Aplica perfil de retraso según el tipo de tren:
   - Cercanías/Rodalies: 16% retraso, 3% cancelado.
   - Media Distancia: 14% retraso, 3% cancelado.
   - AVE/AVANT/IRYO/OUIGO: 9% retraso, 2% cancelado.
   - Otros: 12% retraso, 3% cancelado.
7. Genera observaciones multilingües desde un banco de frases temáticas (genéricas, servicio, retraso, vía, estado, información).
8. Crea el tren en la base de datos y notifica vía WebSocket.

**Flujos alternativos:**

- Si no hay rutas disponibles para la estación/región, retorna error 400.
- Si la estación de destino es Xàtiva y la ruta es C-2, puede acortar el trayecto (55% probabilidad).
- Las paradas intermedias se limitan a un máximo de 9; para C-3 se incluyen todas.

**Errores esperables:**

- 400 "No routes available from backend data" — El dataset de rutas no está cargado.
- 400 "No routes available for this display" — La estación seleccionada no tiene rutas asociadas.

**Permisos:** Administrador (Basic Auth).

**Datos implicados:** `railboard_routes.json` (dataset), `routes` (servicio), `Trains`, `Operators`, `TrainTypes`, `Places`.

**Componentes técnicos:**

- `backend/src/routes.js:1084-1222` — `POST /generate-random-train`.
- `backend/src/routes.js:1225-1304` — `POST /trains/from-route/:code`.
- `backend/src/services/routeService.js/ts` — Servicio de rutas ferroviarias.
- `backend/src/fixtures/routes.js` — Datos de rutas (antiguas RODALIA_ROUTES).
- `backend/src/fixtures/seedTrains.js` — Fixtures de demostración.
- `frontend/src/components/admin/GenerationPanel.tsx` — Interfaz de auto-generación.

**Riesgos o limitaciones:**

- El cálculo de `headwayMin` puede generar trenes muy seguidos si el intervalo es demasiado pequeño.
- La generación no considera festivos ni temporadas.
- No hay validación de choque de horarios con el mismo número de tren.

**Evidencias:** `backend/src/routes.js:1084-1304`, `backend/src/fixtures/routes.js:1-74`, `backend/src/db.js:196-264`.

---

## Funcionalidad: Gestión de operadores y tipos de tren

**Objetivo:** Mantener un catálogo de operadores ferroviarios y tipos de tren con logotipos y audios de pre-anuncio.

**Actores:** Administrador.

**Precondiciones:** El usuario está autenticado.

**Flujo principal:**

1. El usuario accede a `/train-settings`.
2. Se muestran dos columnas: Operadores y Tipos de tren.
3. Para cada elemento, se puede:
   - **Editar:** Modal con campos (nombre, logo, audio de pre-anuncio).
   - **Eliminar:** Confirmación y eliminación directa.
   - **Crear:** Formulario inline en la parte inferior de cada catálogo.
4. Los logotipos se suben como imágenes (PNG, JPG, GIF, WebP, SVG).
5. Los audios de pre-anuncio se suben como OGG/Opus/MP3 (máximo 5 MB).

**Flujos alternativos:**

- Los operadores y tipos base se crean automáticamente vía `ensureLearnedRailData()` durante la generación de trenes.

**Errores esperables:**

- La subida de archivos inválidos retorna error `FILE_TYPE_NOT_ALLOWED`.
- La eliminación de un tipo usado por trenes existentes deja `train_type_id = NULL`.

**Permisos:** Administrador (Basic Auth).

**Datos implicados:** `Operators` (id, name, logo_url, pre_announce_ogg), `TrainTypes` (id, code, name, color, logo_url, destination_icon_url, pre_announce_ogg).

**Componentes técnicos:**

- `frontend/src/pages/TrainSettings.tsx` — Interfaz de gestión con modales y formularios.
- `backend/src/routes.js:835-966` — Endpoints REST para operadores y tipos de tren.
- `backend/src/db.js:316-374` — CRUD genérico para operadores, tipos, lugares e iconos.
- `backend/src/routes.js:55-69` — Configuración de `multer` para subida de audios.

**Riesgos o limitaciones:**

- No hay control de versiones para logotipos.
- Los audios de pre-anuncio no se reproducen automáticamente en el panel público.

**Evidencias:** `frontend/src/pages/TrainSettings.tsx:1-203`, `backend/src/routes.js:835-966`, `backend/src/db.js:316-374`.

---

## Funcionalidad: Servicios multi-parada

**Objetivo:** Gestionar servicios ferroviarios complejos con múltiples paradas a través de varias estaciones, con control de estados y trazabilidad.

**Actores:** Administrador, sistema de monitorización.

**Precondiciones:** Hay estaciones, operadores y tipos de tren configurados en el sistema.

**Flujo principal:**

1. El administrador crea un servicio con número, operador, tipo de tren, origen y destino.
2. Añade paradas al servicio, cada una con:
   - Tipo de parada: `Origin` (origen), `Stop` (detención), `Pass` (paso sin detención), `Destination` (destino final).
   - Horario programado de llegada y/o salida.
   - Vía y sector asignados.
3. Durante la operación, se marcan eventos sobre cada parada:
   - `POST /stops/:id/arrival` — Marca la llegada.
   - `POST /stops/:id/departure` — Marca la salida.
   - `POST /stops/:id/pass` — Marca paso sin detención.
4. El sistema propaga el retraso entre paradas consecutivas automáticamente, salvo que la parada tenga `delay_locked = true`.

**Flujos alternativos:**

- **Cancelación:** `POST /services/:id/cancel` — Cancela el servicio y todas sus paradas.
- **Retraso manual:** `POST /stops/:id/delay` — Añade retraso a una parada específica.
- **Reordenación:** `POST /services/:id/stops/reorder` — Reordena las paradas del servicio.

**Errores esperables:**

- 400 si faltan campos obligatorios (`number`, `station_id`, `stop_number`, `stop_type`).
- 404 si el servicio o la parada no existen.

**Permisos:** Administrador (Basic Auth).

**Datos implicados:**

- `services` — Servicio con estado (Scheduled → In Progress → Completed / Cancelled).
- `service_stops` — Paradas con estados (Scheduled → Arrived → Departed → Passed → Completed).
- `service_events` — Trazabilidad de eventos (audit trail).

**Componentes técnicos:**

- `frontend/src/components/admin/ServicesPanel.tsx` — Interfaz de gestión de servicios y paradas.
- `backend/src/routes.js:1306-1557` — Endpoints de servicios, paradas y operaciones.
- `backend/src/db.js:504-882` — Tablas `services`, `service_stops`, `service_events`, operaciones CRUD y máquina de estados.
- `backend/src/ws.js` — Notificaciones de cambios de estado.

**Riesgos o limitaciones:**

- La propagación de retraso no considera el tiempo de vuelta ni la disponibilidad de material.
- El audit trail (`service_events`) no es purgable; puede crecer indefinidamente.

**Evidencias:** `frontend/src/components/admin/ServicesPanel.tsx:1-501`, `backend/src/routes.js:1306-1557`, `backend/src/db.js:504-882`.

---

## Funcionalidad: Configuración multiestación (DisplayConfig)

**Objetivo:** Gestionar la configuración individual de cada display/estación del sistema, incluyendo aspectos visuales, idiomas, vías y modo de visualización.

**Actores:** Administrador.

**Precondiciones:** El usuario está autenticado.

**Flujo principal:**

1. El usuario accede a `/admin/displays` (ruta múltiple) o directamente a `/admin/displays/:id`.
2. En modo múltiple, se muestra una cuadrícula de todas las estaciones; en modo único, se muestra directamente la única estación.
3. Para cada display, se configuran:
   - **Config general:** Nombre de la estación, modo (salidas/llegadas), región/ciudad para filtrar rutas, idiomas (selección múltiple de es/ca/en/fr/eu/gl), URL del logotipo.
   - **Vías y sectores:** Rango mínimo/máximo, opción de permitir vacío, mostrar icono de destino.
   - **Estilo y reloj:** Colores (fondo, cabecera, texto de cabecera, fila principal, fila alterna), modo de reloj (real/ficticio), hora ficticia, avance (1s/2s/5s/10s/15s por segundo real), texto del footer.
   - **Trenes:** Lista de los trenes asociados al display, con acciones para añadir, generar, exportar o vaciar.
   - **Tipo de tren:** Asignación de iconos de destino por tipo de tren.

**Flujos alternativos:**

- Si el modo global es `single`, se ignora el parámetro de URL y se muestra siempre la misma estación.
- Se puede crear un nuevo display (estación) desde el panel.

**Errores esperables:**

- Error al guardar la configuración se muestra como notificación de error.
- Si no hay displays, se muestra un mensaje de aviso.

**Permisos:** Administrador (Basic Auth).

**Datos implicados:**

- `stations` — Tabla de estaciones (id, name, short, logo_url, color).
- `station_display_configs` — Configuración por estación almacenada como JSON.

**Componentes técnicos:**

- `frontend/src/pages/DisplayConfig.tsx` — Página completa de configuración de display.
- `backend/src/routes.js:727-749` — Endpoints `GET/PUT /stations/:id/config`.
- `backend/src/db.js:459-502` — Funciones `getStationDisplayConfig`, `setStationDisplayConfig`, `listStationDisplayConfigs`.

**Riesgos o limitaciones:**

- La configuración se guarda como JSON sin esquema fijo; cambios en el schema pueden requerir migraciones.
- No hay validación de rango para vías y sectores (se permiten valores no numéricos/alfabéticos).

**Evidencias:** `frontend/src/pages/DisplayConfig.tsx:1-981+`, `backend/src/routes.js:727-749`, `backend/src/db.js:459-502`.

---

## Funcionalidad: Locuciones y TTS (Text-to-Speech)

**Objetivo:** Gestionar locuciones de megafonía con soporte multilingüe y síntesis de voz vía Web Speech API.

**Actores:** Administrador, viajeros (escuchan los anuncios).

**Precondiciones:** El navegador admite Web Speech API.

**Flujo principal:**

1. El administrador accede a la pestaña "Voz" o "Locuciones" del panel de administración.
2. Configura las plantillas de anuncio para salidas y llegadas, con variables `{number}`, `{type_name}`, `{destination}`, `{platform}`, `{sector}`.
3. Cada idioma puede tener su propia plantilla vía el mapa `announce_templates_map`.
4. Se pueden definir presets de anuncios (bienvenida, cierre, retraso, etc.).
5. La configuración de voz incluye: velocidad (rate), tono (pitch), volumen y selección de voz por idioma.
6. El anuncio se dispara desde la interfaz de administración o desde la página de trenes, usando `window.speechSynthesis.speak()`.

**Flujos alternativos:**

- **Pre-anuncio:** Si el tipo de tren o el operador tiene un archivo de audio de pre-anuncio (OGG/Opus/MP3), se reproduce antes de la síntesis de voz.
- **Lista de voces:** Se carga automáticamente de `speechSynthesis.getVoices()`.

**Errores esperables:**

- Si el navegador no soporta Web Speech API, el botón de anunciar no hace nada visible.
- Las voces pueden no estar disponibles para todos los idiomas configurados.

**Permisos:** Administrador (Basic Auth).

**Datos implicados:**

- Config: `tts_rate`, `tts_pitch`, `tts_volume`, `tts_voice`, `tts_voice_map`, `announce_departure`, `announce_arrival`, `announce_templates_map`, `announce_presets`.
- Audios de pre-anuncio en `Operators.pre_announce_ogg`, `TrainTypes.pre_announce_ogg`, `Stations.pre_announce_ogg`.

**Componentes técnicos:**

- `frontend/src/lib/tts.ts` — Funciones `speak`, `renderTemplate`, `defaultTemplate`, `loadVoiceSettings`, `getVoices`, `getVoiceURIForLanguage`.
- `frontend/src/components/admin/LocutionsPanel.tsx` — Interfaz de gestión de plantillas y presets.
- `frontend/src/pages/Admin.tsx:698-757` — Configuración de voz y tests de anuncio.

**Riesgos o limitaciones:**

- Web Speech API no funciona en todos los navegadores (especialmente en iOS/chromium).
- No hay fallback si la voz seleccionada no está disponible (se queda en silencio).
- Los audios de pre-anuncio no tienen temporización sincronizada con la TTS.

**Evidencias:** `frontend/src/lib/tts.ts:1-258`, `frontend/src/components/admin/LocutionsPanel.tsx:1-73`, `frontend/src/pages/Admin.tsx:698-757`.

---

## Funcionalidad: PWA y modo offline

**Objetivo:** Permitir que RailBoard funcione como aplicación instalable y tenga resiliencia básica a fallos de red.

**Actores:** Viajeros (instalan y usan la app), administradores (en modo offline parcial).

**Precondiciones:** El navegador admite Service Workers.

**Flujo principal:**

1. En el primer acceso, el Service Worker (`sw.js`) se instala y almacena en caché recursos estáticos (`/`, `/manifest.json`, `/fonts/fonts.css`).
2. Para peticiones de archivos estáticos (JS, CSS, PNG, JPG, ICO, SVG, WOFF2, TTF, EOT): **cache-first** — si está en caché, sirve desde la caché; de lo contrario, hace fetch y lo almacena.
3. Para peticiones a `/api/` o `/admin/`: **network-first** — primero intenta red; si falla, sirve desde la caché.
4. Para navegación: network-first, con caída a la página principal en caché.

**Flujos alternativos:**

- Si todo falla en modo offline para una API, retorna `{"error": "Offline"}` con código 503.

**Errores esperables:**

- 503 "Offline" para peticiones de API cuando no hay caché ni conexión.

**Permisos:** Público (sin autenticación).

**Datos implicados:**

- `CACHE = "railboard-v1"` — Nombre de la caché.
- `manifest.json` — Configuración de instalación (name, short_name, description, icons).

**Componentes técnicos:**

- `frontend/public/sw.js` — Service Worker con estrategias cache-first / network-first.
- `frontend/public/manifest.json` — Manifest de aplicación web progresiva.
- `frontend/public/fonts/` — 6 familias de fuentes tipográficas locales (Oswald, Roboto Condensed, Roboto Mono, etc.).
- `frontend/src/pages/Display.tsx:36-42` — Inyección dinámica de la hoja de estilos de fuentes vía JavaScript.

**Riesgos o limitaciones:**

- Estrategia cache-first para estáticos: las actualizaciones requieren un nuevo `CACHE` versionado.
- Las peticiones de admin con Basic Auth no se cachean correctamente si la respuesta no incluye los headers adecuados.
- No hay caché para imágenes dinámicas (logotipos, iconos subidos por el usuario).
- La aplicación no puede funcionar completamente offline porque los datos de trenes requieren API.

**Evidencias:** `frontend/public/sw.js:1-82`, `frontend/public/manifest.json:1-16`, `frontend/public/fonts/fonts.css`.

---

## Funcionalidad: Panel de administración completo

**Objetivo:** Proporcionar una interfaz unificada para todas las operaciones de gestión del sistema RailBoard.

**Actores:** Administrador.

**Precondiciones:** El usuario está autenticado.

**Flujo principal:**

1. El administrador accede a `/admin` y ve un panel con barra lateral izquierda organizada en grupos:
   - **General:** Dashboard, Validación, Importación de datos.
   - **Infraestructura ferroviaria:** Rutas, Operadores, Trenes, Tipos de tren, Destinos, Servicios.
   - **Displays y señalética:** Displays, Estación actual, Estilos.
   - **Audio y locuciones:** Voz e idiomas, Locuciones.
2. Cada pestaña muestra su contenido específico:
   - **Dashboard:** KPIs (rutas, estaciones, redes, operadores, displays, trenes), estado del backend, resumen operativo.
   - **Estación:** Configuración general (nombre, modo, idioma, footer).
   - **Rutas:** Navegador de rutas con filtros por región/red/operador, generación de trenes desde ruta.
   - **Validation:** Análisis de consistencia de datos (rutas duplicadas, estaciones sin display).
   - **Import:** Validación y previsualización de importación JSON de rutas.
   - **Estilos:** Personalización visual (colores de fondo, cabecera, filas).
   - **Destinos:** CRUD de lugares/destinos.
   - **Servicios:** Gestión de servicios multi-parada.
   - **Displays:** Enlace a `DisplayConfig.tsx`.

**Flujos alternativos:**

- El panel muestra notificaciones toast para operaciones exitosas/fallidas.
- Los datos se refrescan automáticamente vía WebSocket y polling.

**Errores esperables:**

- Errores de API se capturan y se muestran como notificaciones o mensajes de error inline.
- La validación de rutas detecta erroros (faltan campos, rutas duplicadas) y warnings (sin estaciones, sin displays).

**Permisos:** Administrador (Basic Auth).

**Datos implicados:** Todas las tablas del sistema: Config, Stations, Trains, Operators, TrainTypes, Places, Routes, Services, ServiceStops.

**Componentes técnicos:**

- `frontend/src/pages/Admin.tsx` — Componente principal del panel de administración.
- `frontend/src/components/admin/GenerationPanel.tsx` — Generación y auto-generación de trenes.
- `frontend/src/components/admin/RoutesPanel.tsx` — Navegador de rutas con filtros.
- `frontend/src/components/admin/ServicesPanel.tsx` — Gestión de servicios multi-parada.
- `frontend/src/components/admin/StationPanel.tsx` — Configuración de la estación actual.
- `frontend/src/components/admin/StylesPanel.tsx` — Personalización de estilos.
- `frontend/src/components/admin/LocutionsPanel.tsx` — Plantillas de locuciones.
- `frontend/src/components/admin/PlacesPanel.tsx` — CRUD de destinos.
- `frontend/src/components/admin/WSLogPanel.tsx` — Log de WebSocket.
- `frontend/src/components/admin/StationPanel.tsx` — Configuración de display por estación.

**Riesgos o limitaciones:**

- La interfaz de administración no es responsiva para dispositivos móviles (sidebar oculto en `lg:`).
- La validación de rutas es básica (formato de campos, sin verificación de consistencia geográfica).

**Evidencias:** `frontend/src/pages/Admin.tsx:1-1121+`, `frontend/src/components/admin/GenerationPanel.tsx:1-35`, `frontend/src/components/admin/RoutesPanel.tsx:1-214`, `frontend/src/components/admin/ServicesPanel.tsx:1-501`, `frontend/src/components/admin/StylesPanel.tsx:1-43`, `frontend/src/components/admin/LocutionsPanel.tsx:1-73`, `backend/src/routes.js:1-1676`.
