# Backend

**Stack:** Node.js + Express 4 + SQLite (better-sqlite3) + WebSocket (ws)

**Puerto:** `4000` (configurable vía `PORT` env)

## Estructura

```
backend/
├── src/
│   ├── index.js             # Entry point: Express app, CORS, helmet, rate-limit, static, WS
│   ├── db.js                # Inicialización BD, acceso a datos (CRUD)
│   ├── routes.js            # API administrativa montada en /admin
│   ├── railRoutesApi.js     # API pública montada en /api (panel, rutas, estaciones)
│   ├── ws.js                # Servidor WebSocket (broadcast, suscripciones, dispositivos)
│   ├── migrations.js        # Runner de migraciones SQL (directorio migrations/)
│   ├── logger.js            # Logger pino + request logger
│   ├── middleware/
│   │   └── auth.js          # Basic Auth (admin)
│   ├── services/
│   │   ├── routeService.js          # Dataset de rutas ferroviarias (57 rutas)
│   │   ├── boardService.js          # Compose de station board (departures/arrivals)
│   │   ├── trainGeneratorService.js # Generación de trenes + logos Cercanías auto
│   │   ├── ttsService.js            # Server-side TTS (macOS say + Edge TTS)
│   │   ├── announcementService.js   # Cola, historial y disparo de anuncios
│   │   ├── announcementComposer.js  # Composición de textos por idioma
│   │   ├── announcementSoundResolver.js # Resolución de sonidos/reglas
│   │   ├── eventEngine.js           # Máquina de estados de tren (validación transiciones)
│   │   ├── simulationService.js     # Reloj simulado, secuencias de viaje
│   │   ├── automationService.js     # Motor de reglas de automatización
│   │   ├── hardwareService.js       # Eventos de hardware (ESP32/Arduino)
│   │   ├── uploadService.js         # Multer + validación de contenido (imagen/audio)
│   ├── data/
│   │   └── observationBank.js       # Banco de observaciones
│   ├── fixtures/
│   │   ├── routes.js                # Fixtures de rutas
│   │   └── seedTrains.js            # Fixtures de trenes demo
│   ├── scripts/
│   │   └── ws_e2e_test.mjs          # Test E2E con WS + fallback curl
│   └── seed.js                      # Generador de datos demo (npm run seed)
├── migrations/               # Migraciones SQL (000 a 025)
├── data/
│   └── data.db               # Base de datos SQLite (WAL)
├── uploads/
│   ├── tts/                  # Cache de audio TTS (MD5 hash)
│   └── ...                   # Imágenes/audio subidos
├── public/                   # Estáticos servidos en la raíz (adif.svg, etc.)
├── package.json
```

## Base de datos (SQLite)

Se utiliza `better-sqlite3` con `journal_mode = WAL` y `foreign_keys = ON`. El esquema se crea/aplica mediante migraciones SQL en `backend/migrations/` (000-025), ejecutadas automáticamente al arrancar.

### Tablas principales

| Tabla                     | Finalidad                                     |
| ------------------------- | --------------------------------------------- |
| `config`                  | Configuración clave/valor                     |
| `stations`                | Estaciones/displays                           |
| `operators`               | Operadores ferroviarios                       |
| `train_types`             | Tipos de tren (AVE, Cercanías…)               |
| `places`                  | Lugares/orígenes/destinos                     |
| `train_icons`             | Librería de iconos                            |
| `trains`                  | Trenes individuales (modo simple)             |
| `station_display_configs` | Config por estación (JSON)                    |
| `services`                | Servicios/expediciones (modo multiciudad)     |
| `service_stops`           | Paradas de un servicio                        |
| `service_events`          | Registro de eventos de servicio               |
| `train_events`            | Eventos de máquina de estados de tren         |
| `display_screens`         | Pantallas individuales                        |
| `devices`                 | Dispositivos conectados (WS)                  |
| `audio_assets`            | Assets de audio (chimes, tonos…)              |
| `audio_asset_conversions` | Conversiones de formato de audio              |
| `announcement_sound_profiles` | Perfiles de sonido por operador/tipo     |
| `announcement_sound_rules`    | Reglas de selección de sonido             |
| `announcement_history`    | Historial de anuncios                          |
| `announcement_queue`      | Cola de anuncios                              |
| `announcement_event_log`  | Log de eventos de anuncios                    |
| `station_announcement_config` | Config de megafonía por estación         |
| `place_tts_pronunciations` | Pronunciaciones TTS personalizadas           |
| `simulation_clock`        | Reloj simulado (fila singleton)               |
| `simulation_events`       | Log de eventos de simulación                  |
| `journey_sequences`       | Secuencias de viaje                           |
| `journey_sequence_steps`  | Pasos de una secuencia                        |
| `automation_rules`        | Reglas de automatización                      |
| `train_state_timings`     | Tiempos de permanencia en estados             |
| `schema_migrations`       | Control de migraciones aplicadas              |

### Migraciones

Runner en `migrations.js` lee `backend/migrations/*.sql` ordenados alfabéticamente y aplica los pendientes (registrados en `schema_migrations`). Actualmente hasta `025-trains-two-numbers.sql`.

## Rutas

- **`/admin`** → `routes.js` (administración, requiere Basic Auth). Ver [api.md](api.md) para el detalle completo.
- **`/api`** → `railRoutesApi.js` (panel público: `/api/stations/:id/board`, rutas, redes, estaciones).
- **`/health`** → health check con estado de BD, uploads, memoria y uptime.

### Archivos estáticos

- `/uploads/*` sirve logos/audio subidos desde `backend/uploads/`.
- La raíz (`/`) sirve el contenido de `backend/public/` (p. ej. `adif.svg`).

## WebSocket

Servidor WebSocket en la misma conexión HTTP (`ws://localhost:4000/ws`).

- **Conexión:** envía `{"type":"hello"}`
- **Actualización:** tras cualquier cambio, envía `{"type":"update","at":"<timestamp>"}`
- **Suscripciones:** `subscribe`/`unsubscribe` por `displayId`/`stationId` para broadcasts dirigidos (`broadcastToDisplay`, `broadcastToStation`)
- **Dispositivos:** `heartbeat`/`identify` registran el dispositivo en `devices` (timeout offline 60s); broadcast de `device_disconnected`
- **Broadcast:** `broadcast(payload)` a todos los clientes

## Seguridad

- **Basic Auth:** todas las rutas `/admin` (`admin:railboard`, configurable con `ADMIN_PASSWORD`)
- **Rate limiting:** general `/admin` (120/min prod, 1000 dev) + write limiter (30 req/min) para POST/PUT/PATCH/DELETE
- **Helmet** con `crossOriginResourcePolicy: "cross-origin"`
- **CORS:** `CORS_ORIGIN` o cualquier `localhost:*` en desarrollo
- **Uploads:** validación de tipo de contenido (imagen PNG/JPG/GIF/WebP/SVG 10MB; audio OGG/Opus/MP3 5MB)
- **Body JSON:** límite 1MB

## Uploads (multer)

- Almacenamiento en disco: `uploads/`
- Campos: `logo`, `custom_icon`, `icon`, `destination_icon` (imagen), `file` (audio)
- Se sirven estáticamente en `/uploads/`

## TTS (Text-to-Speech) — Server-Side

Cadena de síntesis de voz:

1. **macOS `say`** — proveedor primario (local, rápido, sin red)
2. **Edge TTS** — fallback vía WebSocket con voces neuronales de Microsoft
3. **Web Speech API** — fallback final en el navegador (manejado por el frontend)

### Voces Soportadas

| Idioma | macOS `say`  | Edge TTS                |
| ------ | ------------ | ----------------------- |
| es     | Mónica       | es-ES-ElviraNeural      |
| ca     | Montse       | ca-ES-JoanaNeural       |
| en     | Samantha     | en-GB-SoniaNeural       |
| fr     | Thomas       | fr-FR-DeniseNeural      |
| eu     | Mikel*       | eu-ES-AinhoaNeural      |
| gl     | Mónica*      | gl-ES-RoiNeural         |

*Voz no instalada por defecto — usa fallback con voz predeterminada del sistema.

### Endpoints TTS

| Método | Ruta                  | Descripción                          |
| ------ | --------------------- | ------------------------------------ |
| POST   | `/admin/tts/synthesize` | Sintetiza texto → audio            |
| GET    | `/admin/tts/voices`   | Lista voces disponibles              |
| GET    | `/admin/tts/provider` | Info del proveedor activo            |
| GET    | `/admin/tts/cache`    | Estadísticas del cache               |
| DELETE | `/admin/tts/cache`    | Limpia el cache de audio             |

### Cache TTS

- Ubicación: `uploads/tts/`
- Clave: hash MD5 de `{text}:{language}:{voice}:{rate}:{pitch}`
- Formatos: MP3/OGG/WAV/AIFF según proveedor
- Se sirven estáticamente vía `/uploads/tts/*`

### Ejemplo de uso

```bash
# Sintetizar en euskera
curl -u admin:railboard -X POST http://localhost:4000/admin/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Kaixo mundua","language":"eu"}' -o output.mp3

# Listar voces
curl -u admin:railboard http://localhost:4000/admin/tts/voices

# Ver proveedor
curl -u admin:railboard http://localhost:4000/admin/tts/provider
```

## Lógica de negocio

### Máquina de estados de tren (`eventEngine.js`)

`PATCH /admin/trains/:id/state` valida transiciones entre estados (`getValidTransitions`), registra eventos en `train_events` y dispara anuncios automáticos. Estados disponibles en `GET /admin/trains/states`.

### Generación aleatoria de trenes

`POST /admin/generate-random-train` genera un tren realista con probabilidad de retraso/cancelación según tipo (AVE 5%, Cercanías 20%).

### Generación desde rutas + logos Cercanías (`trainGeneratorService.js`)

- `generateTrainFromRoute(code)` crea tren desde las 57 rutas (`POST /admin/trains/from-route/:code`)
- Detecta Cercanías/Regional con regEx (`C10`, `C4B`, prefijo `MA-`, códigos exactos `C`/`R`) y asigna `logo_url: /uploads/CERCANIAS.png` automáticamente
- `typeLogo` solo para Cercanías/Regionales; resto usa `operatorLogo` o texto

### Board service (`boardService.js` + `railRoutesApi.js`)

`GET /api/stations/:stationId/board?mode=` construye filas desde `trains` (con `number2`, `destination2`, `fareRestrictions`, iconos) con fallback a `services` si no hay trenes.

### Megafonía (`announcementService.js` + `eventEngine.js`)

Cola de anuncios (`announcement_queue`), composición multilingüe, resolución de sonidos por reglas/perfil, síntesis TTS y reproducción vía WebSocket push.

### Simulación (`simulationService.js`)

Reloj simulado con multiplicador/pausa (`simulation_clock`), log de eventos y secuencias de viaje (`journey_sequences`).

### Automatización (`automationService.js`)

Reglas (`automation_rules`) con disparadores `time_based`, `state_change`, `delay_detected`, `schedule_match`, `periodic`, y sugerencias por tren/estación.

### Seed data

`POST /admin/seed-trains` y `npm run seed` cargan datos demo: 4 operadores, 6 tipos, 15 lugares, 9 trenes.

## Scripts

| Comando        | Descripción                                  |
| -------------- | -------------------------------------------- |
| `npm run dev`  | Servidor con `--watch` (reinicio automático) |
| `npm start`    | Servidor producción                          |
| `npm run seed` | Pobla BD con datos demo                      |
| `npm run backup` | Copia de seguridad (`scripts/backup.sh`)   |
| `npm test`     | Tests (vitest)                               |
| `npm run lint` | Lint (eslint)                                |
