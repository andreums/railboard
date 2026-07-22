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

Crea un tren.

**Body:**

```json
{
  "number": "03104",
  "operator_id": 1,
  "train_type_id": 1,
  "origin": "Madrid",
  "destination": "Barcelona",
  "stops": "[]",
  "scheduled_time": "08:15",
  "expected_time": "08:15",
  "platform": "1",
  "sector": "A",
  "status": "Scheduled",
  "observations": ""
}
```

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

---

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
