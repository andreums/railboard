# API Reference

**Base URL:** `http://localhost:4000/api`

## Config

### GET /api/config

Obtiene todas las claves de configuración.

**Respuesta:**

```json
{
  "station_name": "MADRID PUERTA DE ATOCHA",
  "mode": "departures",
  "clockMode": "fake",
  "clockFakeTime": "14:30"
}
```

### PUT /api/config

Actualiza configuración. Hace broadcast vía WS.

**Body:** `{ "station_name": "...", "mode": "arrivals", ... }`

---

## Trains

### GET /api/trains

Lista todos los trenes con datos de operador y tipo.

### POST /api/trains

Crea un tren. Multipart/form-data (acepta icono custom `custom_icon`).

**Body:**

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

**Campos de tren (adicionales):**

| Campo                    | Tipo                          | Descripción                            |
| ------------------------ | ----------------------------- | -------------------------------------- |
| `number2`                | string (opcional)             | Segundo número de tren                 |
| `destination2`           | string (opcional)             | Segundo destino (alterna en el panel)  |
| `fare_restrictions`      | object (opcional)             | `commuterTicketsNotAccepted`, `commuterPassesNotAccepted`, `reservationRequired` |
| `except_stations`        | string[]                      | Estaciones excluidas                   |
| `custom_icon_url`        | string (opcional)             | Icono personalizado (subido o URL)     |
| `icon_mode`              | `none` / `operator` / `type` / `destination` / `custom` | Modo de icono en el panel |

### PUT /api/trains/reorder

Reordena trenes.

**Body:** `{ "ids": [3, 1, 2] }`

### PUT /api/trains/:id

Actualiza todos los campos de un tren.

### PATCH /api/trains/:id/status

Actualiza solo el estado.

**Body:** `{ "status": "Delayed" }`

### PATCH /api/trains/:id/delay

Añade minutos de retraso a `expected_time`.

**Body:** `{ "minutes": 5 }`

### PATCH /api/trains/:id/platform

Actualiza plataforma y sector.

**Body:** `{ "platform": "2", "sector": "B" }`

### DELETE /api/trains/:id

Elimina un tren.

### DELETE /api/trains

Elimina todos los trenes.

### POST /api/trains/from-route/:code

Crea un tren a partir de una ruta ferroviaria real (57 rutas españolas). Requiere auth.

**Body:** `{ "platform": "3" }` (opcional, si no se indica se asigna automáticamente)

**Respuesta:** 201 con el tren creado. Triggerea WebSocket broadcast.

### PATCH /api/trains/:id/state

Actualiza el estado y posibles campos extra.

**Body:** `{ "status": "Boarding" }`

### GET /api/trains/states

Lista los estados de tren disponibles.

### GET /api/train-events

Historial de eventos de tren (requiere auth).

---

## Routes (Rutas Ferroviarias)

| Método | Ruta                       | Descripción                                 |
| ------ | -------------------------- | ------------------------------------------- |
| GET    | /api/routes                | Lista todas las rutas (57 españolas)        |
| GET    | /api/regions               | Regiones disponibles                        |
| GET    | /api/routes/export         | Exporta dataset de rutas (auth)             |
| POST   | /api/routes/reload         | Recarga dataset desde archivo (auth)        |

## Train Icons

| Método | Ruta                     | Descripción                          |
| ------ | ------------------------ | ------------------------------------ |
| GET    | /api/train-icons         | Lista iconos de tren                 |
| POST   | /api/train-icons         | Sube icono (multipart con `icon`)    |
| PUT    | /api/train-icons/:id     | Actualiza icono                      |
| DELETE | /api/train-icons/:id     | Elimina icono                        |

## Displays (Público)

| Método | Ruta                         | Descripción                                   |
| ------ | ---------------------------- | --------------------------------------------- |
| GET    | /api/displays                | Lista displays (auth)                         |
| GET    | /api/stations/:id/config     | Config pública de una estación                |
| PUT    | /api/stations/:id/config     | Actualiza config de estación (auth)           |

## Operators

| Método | Ruta               | Descripción                        |
| ------ | ------------------ | ---------------------------------- |
| GET    | /api/operators     | Lista operadores                   |
| POST   | /api/operators     | Crea operador (multipart con logo) |
| PUT    | /api/operators/:id | Actualiza operador                 |
| DELETE | /api/operators/:id | Elimina operador                   |

## Train Types

| Método | Ruta                 | Descripción                                               |
| ------ | -------------------- | --------------------------------------------------------- |
| GET    | /api/train-types     | Lista tipos de tren                                       |
| POST   | /api/train-types     | Crea/actualiza tipo (upsert por code, multipart con logo) |
| PUT    | /api/train-types/:id | Actualiza tipo                                            |
| DELETE | /api/train-types/:id | Elimina tipo                                              |

## Places

| Método | Ruta            | Descripción                     |
| ------ | --------------- | ------------------------------- |
| GET    | /api/places     | Lista lugares                   |
| POST   | /api/places     | Crea lugar (multipart con logo) |
| PUT    | /api/places/:id | Actualiza lugar                 |
| DELETE | /api/places/:id | Elimina lugar                   |

## Especiales

| Método | Ruta                       | Descripción                           |
| ------ | -------------------------- | ------------------------------------- |
| GET    | /health                    | Health check: `{ ok: true }`          |
| POST   | /api/seed-trains           | Reinicia con 9 trenes de demostración |
| POST   | /api/generate-random-train | Genera un tren aleatorio realista     |

## TTS (Text-to-Speech)

Endpoints de síntesis de voz server-side. Requiere auth: Basic Auth `admin:railboard`.

### POST /admin/tts/synthesize

Sintetiza texto en audio.

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

**Respuesta:** Audio binario (AIFF format) con Content-Type: `audio/aiff`.

### GET /admin/tts/voices

Lista voces disponibles (server + edge-tts).

**Query params:** `?language=es` (opcional, filtra por idioma)

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

### GET /admin/tts/provider

Información del proveedor TTS activo.

**Respuesta:**

```json
{
  "status": "ok",
  "data": {
    "available": true,
    "provider": "macos",
    "detail": "macOS say command"
  }
}
```

### GET /admin/tts/cache

Estadísticas del cache de audio.

**Respuesta:**

```json
{
  "status": "ok",
  "data": { "count": 12, "totalSize": 245760 }
}
```

### DELETE /admin/tts/cache

Limpia todo el cache de audio TTS.

## WebSocket

**URL:** `ws://localhost:4000/ws`

Al conectar, el servidor envía `{"type":"hello"}`. Ante cualquier cambio de datos, envía `{"type":"update","at":"<timestamp>"}`.

## Estados de tren

- `Scheduled`
- `On Time`
- `Delayed`
- `Cancelled`
- `Departed`
- `Arrived`
- `Boarding`
- `Now Boarding`
- `Last Call`
