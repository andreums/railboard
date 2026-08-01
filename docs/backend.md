# Backend

**Stack:** Node.js + Express 4 + SQLite (better-sqlite3) + WebSocket (ws)

**Puerto:** `4000` (configurable vía `PORT` env)

## Estructura

```
backend/
├── src/
│   ├── index.js          # Entry point: Express app, CORS, static, WS
│   ├── db.js             # Inicialización BD, esquema, CRUD
│   ├── routes.js         # Rutas API y lógica de negocio
│   ├── ws.js             # Servidor WebSocket (broadcast)
│   ├── railRoutesApi.js  # Build de filas de panel desde trenes
│   ├── services/
│   │   ├── ttsService.js # Server-side TTS (macOS say + Edge TTS)
│   │   ├── boardService.js        # Compose de station board (departures/arrivals)
│   │   ├── trainGeneratorService.js # Generación de trenes + logos Cercanías auto
│   │   └── ...
│   ├── data/
│   │   └── railboard_routes.json  # 57 rutas españolas
│   ├── scripts/
│   │   └── ws_e2e_test.mjs        # Test E2E con WS + fallback curl
│   └── seed.js           # Generador de datos demo (npm run seed)
├── data/
│   └── data.db           # Base de datos SQLite (WAL)
├── uploads/
│   ├── tts/              # Cache de audio TTS (MD5 hash)
│   └── ...               # Imágenes subidas (logos)
├── package.json
```

## Base de datos (SQLite)

### Tablas

**config** — Pares clave-valor de configuración.

- `key` (TEXT, PK), `value` (TEXT)

**operators** — Operadores ferroviarios.

- `id` (INTEGER, PK), `name` (TEXT, UNIQUE), `logo_url` (TEXT)

**train_types** — Tipos de tren (AVE, Cercanías, etc.).

- `id` (INTEGER, PK), `code` (TEXT, UNIQUE), `name` (TEXT), `color` (TEXT), `logo_url` (TEXT)
- `pre_announce_ogg` (TEXT), `destination_icon_url` (TEXT), `announce_template` (TEXT)

**places** — Estaciones/lugares.

- `id` (INTEGER, PK), `name` (TEXT, UNIQUE), `logo_url` (TEXT)

**trains** — Trenes en el panel.

- `id` (INTEGER, PK), `number` (TEXT), `number2` (TEXT, opcional), `operator_id` (FK→operators), `train_type_id` (FK→train_types)
- `origin`, `destination` (TEXT), `destination2` (TEXT, opcional), `stops` (JSON TEXT)
- `scheduled_time`, `expected_time` (HH:MM)
- `platform`, `sector`, `status`, `sort_order`, `observations`
- `custom_icon_url` (TEXT), `icon_mode` (TEXT: `none`/`operator`/`type`/`destination`/`custom`)
- `stopping_pattern` (TEXT), `fare_restrictions` (JSON TEXT), `except_stations` (JSON TEXT)
- `created_at`

### Migraciones

Se ejecutan automáticamente al iniciar (`db.js`). Detecta columnas faltantes vía `PRAGMA table_info` y aplica `ALTER TABLE`.

### Pragmas

- `journal_mode = WAL`
- `foreign_keys = ON`

## Rutas

### API REST

Ver `api.md` para el detalle completo de endpoints. Principales:

| Grupo      | Endpoints                                        |
| ---------- | ------------------------------------------------ |
| Config     | GET, PUT `/api/config`, `/api/stations/:id/config` |
| Trains     | GET, POST, PUT, DELETE `/api/trains`; PATCH `/api/trains/:id/{status,state,platform,delay}`; POST `/api/trains/from-route/:code`; GET `/api/trains/states`, `/api/train-events`, `/api/trains/export` |
| Operadores | GET, POST, PUT, DELETE `/api/operators` (+ `/pre-announce`) |
| Tipos      | GET, POST, PUT, DELETE `/api/train-types` (+ `/pre-announce`) |
| Lugares    | GET, POST, PUT, DELETE `/api/places`             |
| Rutas      | GET `/api/routes`, `/api/regions`, `/api/routes/export`, POST `/api/routes/reload` |
| Iconos     | GET, POST, PUT, DELETE `/api/train-icons`        |
| Especiales | `/api/seed-trains`, `/api/generate-random-train` |
| Health     | GET `/health`                                    |

### Archivos estáticos

`/uploads/*` sirve logos subidos desde el directorio `uploads/`.

## WebSocket

Servidor WebSocket en la misma conexión HTTP. Los clientes se conectan a `ws://localhost:4000/ws`.

- **Conexión:** envía `{"type":"hello"}`
- **Actualización:** tras cualquier cambio, envía `{"type":"update","at":"<ISO timestamp>"}`

## Uploads (multer)

- Almacenamiento en disco: `uploads/`
- Campos: `logo` (single file)
- Límite: 2MB
- Se sirven estáticamente en `/uploads/`

## TTS (Text-to-Speech) — Server-Side

### Servicio TTS (`backend/src/services/ttsService.js`)

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

| Método | Ruta                         | Descripción                          |
| ------ | ---------------------------- | ------------------------------------ |
| POST   | `/admin/tts/synthesize`      | Sintetiza texto → audio (AIFF)       |
| GET    | `/admin/tts/voices`          | Lista voces disponibles              |
| GET    | `/admin/tts/provider`        | Info del proveedor activo            |
| GET    | `/admin/tts/cache`           | Estadísticas del cache               |
| DELETE | `/admin/tts/cache`           | Limpia el cache de audio             |

### Cache TTS

- Ubicación: `uploads/tts/`
- Clave: hash MD5 de `{text}:{language}:{voice}:{rate}:{pitch}`
- Formato: archivos AIFF (macOS) o MP3 (Edge TTS)
- Se sirven estáticamente vía `/uploads/tts/*`

### Ejemplo de uso

```bash
# Sintetizar en euskera
curl -u admin:railboard -X POST http://localhost:4000/admin/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Kaixo mundua","language":"eu"}' -o output.aiff

# Listar voces
curl -u admin:railboard http://localhost:4000/admin/tts/voices

# Ver proveedor
curl -u admin:railboard http://localhost:4000/admin/tts/provider
```

## Lógica de negocio (routes.js)

### Generación aleatoria de trenes

`POST /api/generate-random-train` usa 15 rutas Rodalia predefinidas con:

- Selección aleatoria de ruta, operador y tipo
- Generación realista de número de tren
- Probabilidad de retraso/cancelación según tipo (AVE 5%, Cercanías 20%)
- Paradas intermedias con horarios calculados
- Prevención de números duplicados

### Generación desde rutas + logos Cercanías (`trainGeneratorService.js`)

- `ensureLearnedRailData()` crea tipos de tren a partir de las 57 rutas
- Detecta Cercanías/Regional con regEx (`C10`, `C4B`, prefijo `MA-`, códigos exactos `C`/`R`, `R2N`) y asigna `logo_url: /uploads/CERCANIAS.png` automáticamente
- Los tipos existentes sin logo también reciben el logo Cercanías

### Seed data

`POST /api/seed-trains` y `npm run seed` cargan datos demo: 4 operadores, 6 tipos, 15 lugares, 9 trenes.

## Scripts

| Comando        | Descripción                                  |
| -------------- | -------------------------------------------- |
| `npm run dev`  | Servidor con `--watch` (reinicio automático) |
| `npm start`    | Servidor producción                          |
| `npm run seed` | Pobla BD con datos demo                      |
