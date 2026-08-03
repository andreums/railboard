# API Reference

**Base URL:** `http://localhost:4000`

La API se expone en dos montajes:

- **`/api`** — API pública (paneles, rutas, redes, estaciones). No requiere autenticación.
- **`/admin`** — API administrativa (CRUD completo, megafonía, simulación, automatización, TTS, etc.). Requiere Basic Auth (`admin:railboard`) salvo los endpoints marcados como públicos.

`/health` está en la raíz.

---

## Health

### GET /health

Health check con estado de BD, uploads, memoria y uptime.

**Respuesta:**

```json
{
  "ok": true,
  "checks": { "db": true, "uploads": true },
  "detail": { "db": { "status": "ok" }, "uploads": { "status": "ok", "fileCount": 12 }, "memory": { "rss": "95MB", "heapUsed": "40MB", "heapTotal": "80MB" }, "uptime": "360s", "node": "v20.x", "env": "development" }
}
```

---

## API Pública (`/api`)

### Config de estación

| Método | Ruta                    | Descripción                                      |
| ------ | ----------------------- | ------------------------------------------------ |
| GET    | `/api/stations/:id/config` | Config pública de un display de estación       |

### Board (panel)

| Método | Ruta                     | Descripción                                          |
| ------ | ------------------------ | ---------------------------------------------------- |
| GET    | `/api/stations/:stationId/board?mode=` | Panel de la estación. `mode`: `departures` \| `arrivals` \| `all`. Fuente: `trains` o `services` (fallback). Ordenado por hora esperada + número. |

**Respuesta:**

```json
{
  "station": { "id": 1, "name": "Madrid Puerta de Atocha", "displayName": "MADRID PUERTA DE ATOCHA" },
  "mode": "departures",
  "source": "trains",
  "rows": [
    {
      "movement": "departure",
      "time": "08:15",
      "expectedTime": "08:15",
      "number": "03104",
      "number2": "05678",
      "operatorName": "Renfe",
      "operatorLogo": "/uploads/renfe.png",
      "trainTypeCode": "AVE",
      "trainTypeName": "Alta Velocidad",
      "trainTypeLogo": "/uploads/ave.png",
      "destination": "Barcelona",
      "destination2": "Valencia",
      "platform": "1",
      "sector": "A",
      "status": "Scheduled",
      "stopsText": "Zaragoza · Lleida · Camp de Tarragona",
      "observations": "",
      "fareRestrictions": { "reservationRequired": true }
    }
  ],
  "generatedAt": "2026-07-29T10:00:00.000Z"
}
```

### Rutas, redes, estaciones

| Método | Ruta                          | Descripción                                    |
| ------ | ----------------------------- | ---------------------------------------------- |
| GET    | `/api/routes`                 | Lista todas las rutas (57 españolas)          |
| GET    | `/api/routes/:code`           | Detalle de una ruta                            |
| GET    | `/api/routes/network/:network`| Rutas de una red (p. ej. `CERCANIAS`)         |
| GET    | `/api/routes/:code/stations`  | Estaciones de una ruta                         |
| GET    | `/api/regions`                | Regiones disponibles                           |
| GET    | `/api/networks`               | Redes disponibles                              |
| GET    | `/api/operators`              | Operadores presentes en el dataset de rutas    |
| GET    | `/api/stations`               | Todas las estaciones del dataset               |
| GET    | `/api/stations/search?q=`     | Búsqueda de estaciones                         |

---

## API Administrativa (`/admin`)

Todos los endpoints de esta sección requieren Basic Auth salvo indicación expresa. Todas las mutaciones emiten un broadcast WebSocket `{ type: "update" }`.

### Config

| Método | Ruta                 | Descripción                              |
| ------ | -------------------- | ---------------------------------------- |
| GET    | `/admin/config`      | Obtiene la configuración global          |
| PUT    | `/admin/config`      | Actualiza configuración (broadcast WS)   |

**Respuesta GET:**

```json
{
  "station_name": "MADRID PUERTA DE ATOCHA",
  "mode": "departures",
  "displayMode": "multiple",
  "clockMode": "fake",
  "tts_rate": "0.95",
  "announce_presets": "[...]"
}
```

### Displays / Estaciones

| Método | Ruta                       | Descripción                                   |
| ------ | -------------------------- | --------------------------------------------- |
| GET    | `/admin/displays`          | Lista displays con su config y trenes         |
| GET    | `/admin/stations/:id/config` | Config pública de una estación              |
| PUT    | `/admin/stations/:id/config` | Actualiza config de estación (broadcast)    |

### Trains

| Método | Ruta                            | Descripción                                        |
| ------ | ------------------------------- | -------------------------------------------------- |
| GET    | `/admin/trains`                 | Lista trenes (`?station_id=` opcional)             |
| POST   | `/admin/trains`                 | Crea tren (multipart si hay `custom_icon`)         |
| GET    | `/admin/trains/export`          | Exporta trenes en JSON (`?station_id=` opcional)   |
| PUT    | `/admin/trains/reorder`         | Reordena trenes (`{ "ids": [3,1,2] }`)             |
| PUT    | `/admin/trains/:id`             | Actualiza un tren                                  |
| PATCH  | `/admin/trains/:id/status`      | Cambia estado (`{ "status": "Delayed" }`)          |
| PATCH  | `/admin/trains/:id/state`       | Cambio de estado validado por máquina de estados   |
| PATCH  | `/admin/trains/:id/platform`    | Cambia plataforma/sector                           |
| PATCH  | `/admin/trains/:id/delay`       | Añade retraso (`{ "minutes": 5 }`)                 |
| DELETE | `/admin/trains/:id`             | Elimina un tren                                    |
| DELETE | `/admin/trains`                 | Elimina todos (`X-Confirm: yes` obligatorio)       |
| POST   | `/admin/trains/from-route/:code`| Crea tren desde una ruta real (57 rutas)           |
| GET    | `/admin/trains/states`          | Estados válidos + transiciones                     |
| GET    | `/admin/train-events?trainId=&limit=` | Historial de eventos de tren                 |

**POST `/admin/trains` body:**

```json
{
  "number": "03104",
  "number2": "05678",
  "operator_id": 1,
  "train_type_id": 1,
  "origin": "Madrid",
  "destination": "Barcelona",
  "destination2": "Valencia",
  "stops": "[]",
  "scheduled_time": "08:15",
  "expected_time": "08:15",
  "platform": "1",
  "sector": "A",
  "status": "Scheduled",
  "observations": "",
  "custom_icon_url": "/uploads/xxx.png",
  "icon_mode": "destination",
  "fare_restrictions": {
    "commuterTicketsNotAccepted": false,
    "commuterPassesNotAccepted": true,
    "reservationRequired": true
  },
  "except_stations": []
}
```

Los campos JSON (`stops`, `fare_restrictions`, `except_stations`) se aceptan como string JSON o array/objeto (el backend los normaliza).

### Operadores

| Método | Ruta                            | Descripción                                   |
| ------ | ------------------------------- | --------------------------------------------- |
| GET    | `/admin/operators`              | Lista operadores                              |
| POST   | `/admin/operators`              | Crea operador (multipart con `logo`)          |
| PUT    | `/admin/operators/:id`          | Actualiza operador                            |
| DELETE | `/admin/operators/:id`          | Elimina operador                              |
| POST   | `/admin/operators/:id/pre-announce` | Sube audio de pre-anuncio (multipart `file`) |
| DELETE | `/admin/operators/:id/pre-announce` | Elimina pre-anuncio                        |

### Tipos de tren

| Método | Ruta                                 | Descripción                                             |
| ------ | ------------------------------------ | ------------------------------------------------------- |
| GET    | `/admin/train-types`                 | Lista tipos                                            |
| POST   | `/admin/train-types`                 | Upsert por `code` (multipart `logo` + `destination_icon`) |
| PUT    | `/admin/train-types/:id`             | Actualiza tipo                                         |
| DELETE | `/admin/train-types/:id`             | Elimina tipo                                           |
| POST   | `/admin/train-types/:id/pre-announce`| Sube audio de pre-anuncio                              |
| DELETE | `/admin/train-types/:id/pre-announce`| Elimina pre-anuncio                                    |

### Lugares

| Método | Ruta                | Descripción                          |
| ------ | ------------------- | ------------------------------------ |
| GET    | `/admin/places`     | Lista lugares                        |
| POST   | `/admin/places`     | Crea lugar (multipart con `logo`)    |
| PUT    | `/admin/places/:id` | Actualiza lugar                      |
| DELETE | `/admin/places/:id` | Elimina lugar                        |

### Estaciones

| Método | Ruta                           | Descripción                       |
| ------ | ------------------------------ | --------------------------------- |
| GET    | `/admin/stations`              | Lista estaciones                  |
| POST   | `/admin/stations`              | Crea estación                     |
| PUT    | `/admin/stations/:id`          | Actualiza estación                |
| DELETE | `/admin/stations/:id`          | Elimina (impide eliminar la última) |
| POST   | `/admin/stations/:id/pre-announce` | Sube audio de pre-anuncio     |
| DELETE | `/admin/stations/:id/pre-announce` | Elimina pre-anuncio           |

### Train Icons

| Método | Ruta                      | Descripción                          |
| ------ | ------------------------- | ------------------------------------ |
| GET    | `/admin/train-icons`      | Lista iconos de tren                 |
| POST   | `/admin/train-icons`      | Sube icono (multipart con `icon`)    |
| PUT    | `/admin/train-icons/:id`  | Actualiza icono                      |
| DELETE | `/admin/train-icons/:id`  | Elimina icono                        |

### Rutas (dataset)

| Método | Ruta                    | Descripción                           |
| ------ | ----------------------- | ------------------------------------- |
| GET    | `/admin/routes`         | Lista todas las rutas (57)            |
| GET    | `/admin/regions`        | Regiones disponibles                  |
| GET    | `/admin/routes/export`  | Descarga `railboard_routes.json`      |
| POST   | `/admin/routes/reload`  | Recarga dataset desde archivo         |

### Servicios (multiestación)

| Método | Ruta                               | Descripción                       |
| ------ | ---------------------------------- | --------------------------------- |
| GET    | `/admin/services`                  | Lista servicios (`?status=&operator_id=`) |
| POST   | `/admin/services`                  | Crea servicio                     |
| GET    | `/admin/services/:id`              | Detalle con stops y eventos       |
| PATCH  | `/admin/services/:id`              | Actualiza estado/notas            |
| DELETE | `/admin/services/:id`              | Elimina servicio                  |
| POST   | `/admin/services/:id/cancel`       | Cancela servicio y sus stops      |

### Paradas de servicio

| Método | Ruta                                       | Descripción                     |
| ------ | ------------------------------------------ | ------------------------------- |
| GET    | `/admin/services/:serviceId/stops`         | Lista paradas                   |
| POST   | `/admin/services/:serviceId/stops`         | Crea parada                     |
| PATCH  | `/admin/services/:serviceId/stops/:stopId` | Actualiza parada                |
| DELETE | `/admin/services/:serviceId/stops/:stopId` | Elimina parada (renumera)       |
| POST   | `/admin/services/:serviceId/stops/reorder` | Reordena paradas (`{ order: [] }`) |
| POST   | `/admin/stops/:stopId/arrival`             | Marca llegada (`actual_time` obligatorio) |
| POST   | `/admin/stops/:stopId/departure`           | Marca salida (propaga retraso)  |
| POST   | `/admin/stops/:stopId/pass`                | Marca paso                      |
| POST   | `/admin/stops/:stopId/delay`               | Añade retraso (`{ minutes, reason }`) |

### Especiales

| Método | Ruta                             | Descripción                           |
| ------ | -------------------------------- | ------------------------------------- |
| POST   | `/admin/seed-trains`             | Reinicia con 9 trenes de demostración |
| POST   | `/admin/generate-random-train`   | Genera un tren aleatorio realista     |

---

## Megafonía / Anuncios

### Configuración

| Método | Ruta                            | Descripción                                        |
| ------ | ------------------------------- | -------------------------------------------------- |
| GET    | `/admin/announcements/config`   | Locales, tipos de evento y estadísticas del servicio |
| PUT    | `/admin/announcements/config`   | Actualiza config de anuncios de una estación (`station_id` requerido) |
| GET    | `/admin/announcements/config/:stationId` | Config de anuncios de una estación (público) |

Campos de config (`station_announcement_config`): `languages`, `sound_mode` (`SINGLE`/`PER_LANGUAGE`), `delay_after_sound_ms`, `delay_between_languages_ms`, `sound_volume`, `speech_volume`, `auto_announce_enabled`, `tts_provider`, `tts_voice_map`, `tts_rate`, `tts_pitch`.

### Cola e historial

| Método | Ruta                        | Descripción                             |
| ------ | --------------------------- | --------------------------------------- |
| GET    | `/admin/announcements/queue`| Cola de anuncios pendientes/reproduciéndose |
| GET    | `/admin/announcements/history` | Historial de anuncios                 |
| GET    | `/admin/announcements/events` | Log de eventos de anuncios            |

### Pruebas y disparo manual

| Método | Ruta                          | Descripción                                  |
| ------ | ----------------------------- | -------------------------------------------- |
| POST   | `/admin/announcements/test`   | Compone anuncio sin reproducir (`train`, `eventType`, `languages`, `sound_id`) |
| POST   | `/admin/announcements/event`  | Dispara anuncio manual (`train`, `eventType`, `stationId`, `languages`) |

### Locales

| Método | Ruta                            | Descripción                    |
| ------ | ------------------------------- | ------------------------------ |
| GET    | `/admin/announcements/locales`  | Lista locales disponibles      |
| GET    | `/admin/announcements/locale/:lang` | Contenido de un locale     |
| PUT    | `/admin/announcements/locale/:lang` | Actualiza un locale        |

### Helpers de formato

| Método | Ruta                        | Descripción                            |
| ------ | --------------------------- | -------------------------------------- |
| POST   | `/admin/announcements/format-time` | Hora → texto hablado (`{ time, language }`) |
| POST   | `/admin/announcements/format-list` | Lista → texto enumerado (`{ items, language }`) |

---

## Audio Assets

| Método | Ruta                              | Descripción                          |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | `/admin/announcement-audio`       | Lista assets de audio (`?asset_type=&format=&enabled=`) |
| GET    | `/admin/announcement-audio/:id`   | Detalle de asset                     |
| POST   | `/admin/announcement-audio/upload`| Sube audio (multipart `file`)        |
| PUT    | `/admin/announcement-audio/:id`   | Actualiza metadata                   |
| DELETE | `/admin/announcement-audio/:id`   | Elimina asset (+ archivo)            |

## Perfiles y reglas de sonido

| Método | Ruta                                     | Descripción                          |
| ------ | ---------------------------------------- | ------------------------------------ |
| GET    | `/admin/announcement-sound-profiles`     | Lista perfiles de sonido             |
| POST   | `/admin/announcement-sound-profiles`     | Crea perfil                          |
| PUT    | `/admin/announcement-sound-profiles/:id` | Actualiza perfil                     |
| DELETE | `/admin/announcement-sound-profiles/:id` | Elimina perfil                       |
| GET    | `/admin/announcement-sound-rules`        | Lista reglas de sonido (por prioridad) |
| POST   | `/admin/announcement-sound-rules`        | Crea regla                           |
| PUT    | `/admin/announcement-sound-rules/:id`    | Actualiza regla                      |
| DELETE | `/admin/announcement-sound-rules/:id`    | Elimina regla                        |

## Pronunciaciones TTS de lugares

| Método | Ruta                                  | Descripción                             |
| ------ | ------------------------------------- | --------------------------------------- |
| GET    | `/admin/place-tts-pronunciations`     | Lista pronunciaciones                   |
| POST   | `/admin/place-tts-pronunciations`     | Guarda pronunciación (`display_name`, `language`, `pronunciation`) |
| DELETE | `/admin/place-tts-pronunciations/:id` | Elimina pronunciación                   |

---

## TTS (Text-to-Speech) — Server-Side

Requiere auth: Basic Auth `admin:railboard`.

| Método | Ruta                  | Descripción                     |
| ------ | --------------------- | ------------------------------- |
| POST   | `/admin/tts/synthesize` | Sintetiza texto → audio        |
| GET    | `/admin/tts/voices`   | Lista voces (`?language=`)      |
| GET    | `/admin/tts/provider` | Proveedor activo                |
| GET    | `/admin/tts/cache`    | Estadísticas del cache          |
| DELETE | `/admin/tts/cache`    | Limpia el cache                 |

### POST /admin/tts/synthesize

**Body:**

```json
{
  "text": "Hola mundo",
  "language": "es",
  "voice": "Mónica",
  "rate": 1,
  "pitch": 1
}
```

**Respuesta:** Audio binario (MP3/OGG/WAV/AIFF según proveedor).

### GET /admin/tts/voices

**Respuesta:**

```json
{
  "status": "ok",
  "data": [
    { "id": "es-ES-ElviraNeural", "name": "es-ES-ElviraNeural", "lang": "es", "source": "edge-tts" },
    { "id": "mac-Mónica", "name": "Mónica (macOS)", "lang": "es", "source": "macos" }
  ]
}
```

---

## Simulación

| Método | Ruta                              | Descripción                                |
| ------ | --------------------------------- | ------------------------------------------ |
| GET    | `/admin/simulation/clock`         | Reloj simulado (tiempo real + simulado)    |
| PATCH  | `/admin/simulation/clock`         | Ajusta `multiplier` o `paused`             |
| POST   | `/admin/simulation/clock/reset`   | Reinicia el reloj                          |
| GET    | `/admin/simulation/events`        | Log de eventos de simulación (`?limit=`)   |
| GET    | `/admin/simulation/sequences`     | Lista secuencias de viaje                  |
| GET    | `/admin/simulation/sequences/:id` | Detalle de secuencia                       |
| POST   | `/admin/simulation/sequences`     | Crea secuencia                             |
| DELETE | `/admin/simulation/sequences/:id` | Elimina secuencia                          |
| POST   | `/admin/simulation/sequences/:id/start` | Inicia secuencia                     |
| POST   | `/admin/simulation/sequences/:id/pause` | Pausa secuencia                      |
| POST   | `/admin/simulation/sequences/:id/reset` | Reinicia secuencia                    |

## Automatización

| Método | Ruta                                     | Descripción                    |
| ------ | ---------------------------------------- | ------------------------------ |
| GET    | `/admin/automation/rules`                | Lista reglas                   |
| GET    | `/admin/automation/rules/:id`            | Detalle de regla               |
| POST   | `/admin/automation/rules`                | Crea regla                     |
| PATCH  | `/admin/automation/rules/:id`            | Actualiza regla                |
| DELETE | `/admin/automation/rules/:id`            | Elimina regla                  |
| GET    | `/admin/automation/suggestions/:trainId` | Sugerencias para un tren       |
| GET    | `/admin/automation/suggestions/station/:stationId` | Sugerencias para una estación |

## Hardware

| Método | Ruta                   | Descripción                              |
| ------ | ---------------------- | ---------------------------------------- |
| POST   | `/admin/hardware/events` | Endpoint público para ESP32/Arduino   |
| GET    | `/admin/hardware/events` | Vista admin del log de eventos        |

## Displays Screens

| Método | Ruta                          | Descripción                 |
| ------ | ----------------------------- | --------------------------- |
| GET    | `/admin/display-screens`      | Lista pantallas             |
| GET    | `/admin/display-screens/:id`  | Detalle                     |
| POST   | `/admin/display-screens`      | Crea pantalla               |
| PATCH  | `/admin/display-screens/:id`  | Actualiza pantalla          |
| DELETE | `/admin/display-screens/:id`  | Elimina pantalla            |
| GET    | `/admin/display-screens/:id/board` | Board de la pantalla    |

## Devices

| Método | Ruta                       | Descripción                       |
| ------ | -------------------------- | --------------------------------- |
| GET    | `/admin/devices`           | Lista dispositivos registrados    |
| GET    | `/admin/devices/connected` | Dispositivos conectados por WS    |
| GET    | `/admin/devices/:id`       | Detalle de dispositivo            |
| PATCH  | `/admin/devices/:id`       | Actualiza dispositivo             |
| DELETE | `/admin/devices/:id`       | Elimina dispositivo               |

---

## WebSocket

**URL:** `ws://localhost:4000/ws`

- Al conectar, el servidor envía `{"type":"hello"}`.
- Tras cualquier cambio de datos, emite `{"type":"update","at":"<timestamp>"}`.
- Clientes pueden **suscribirse** por display/estación (`subscribe`/`unsubscribe`) para recibir broadcasts dirigidos (`broadcastToDisplay`, `broadcastToStation`).
- Los **dispositivos** envían `heartbeat` / `identify` con `deviceId` para registrarse en la tabla `devices` y mantenerse ONLINE (timeout de 60s).
- Mensajes de eventos: `device_disconnected`, `service_created`, `service_updated`, `service_stop_state_changed`, etc.

## Estados de tren

Estados disponibles y sus transiciones los expone `GET /admin/trains/states`:

- `Scheduled`, `On Time`, `Delayed`, `Cancelled`, `Departed`, `Arrived`, `Boarding`, `Now Boarding`, `Last Call`
