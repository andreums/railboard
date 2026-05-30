# Backend

**Stack:** Node.js + Express 4 + SQLite (better-sqlite3) + WebSocket (ws)

**Puerto:** `4000` (configurable vía `PORT` env)

## Estructura

```
backend/
├── src/
│   ├── index.js       # Entry point: Express app, CORS, static, WS
│   ├── db.js           # Inicialización BD, esquema, CRUD
│   ├── routes.js       # Rutas API y lógica de negocio
│   ├── ws.js           # Servidor WebSocket (broadcast)
│   └── seed.js         # Generador de datos demo (npm run seed)
├── uploads/            # Imágenes subidas (logos)
├── data.db             # Base de datos SQLite
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

**places** — Estaciones/lugares.
- `id` (INTEGER, PK), `name` (TEXT, UNIQUE), `logo_url` (TEXT)

**trains** — Trenes en el panel.
- `id` (INTEGER, PK), `number` (TEXT), `operator_id` (FK→operators), `train_type_id` (FK→train_types)
- `origin`, `destination`, `stops` (JSON TEXT)
- `scheduled_time`, `expected_time` (HH:MM)
- `platform`, `sector`, `status`, `sort_order`, `observations`
- `created_at`

### Migraciones

Se ejecutan automáticamente al iniciar (`db.js`). Detecta columnas faltantes vía `PRAGMA table_info` y aplica `ALTER TABLE`.

### Pragmas

- `journal_mode = WAL`
- `foreign_keys = ON`

## Rutas

### API REST

Ver `api.md` para el detalle completo de endpoints. Principales:

| Grupo | Endpoints |
|-------|-----------|
| Config | GET, PUT `/api/config` |
| Trains | GET, POST, PUT, DELETE `/api/trains` |
| Operadores | GET, POST, PUT, DELETE `/api/operators` |
| Tipos | GET, POST, PUT, DELETE `/api/train-types` |
| Lugares | GET, POST, PUT, DELETE `/api/places` |
| Especiales | `/api/seed-trains`, `/api/generate-random-train` |
| Health | GET `/health` |

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

## Lógica de negocio (routes.js)

### Generación aleatoria de trenes

`POST /api/generate-random-train` usa 15 rutas Rodalia predefinidas con:
- Selección aleatoria de ruta, operador y tipo
- Generación realista de número de tren
- Probabilidad de retraso/cancelación según tipo (AVE 5%, Cercanías 20%)
- Paradas intermedias con horarios calculados
- Prevención de números duplicados

### Seed data

`POST /api/seed-trains` y `npm run seed` cargan datos demo: 4 operadores, 6 tipos, 15 lugares, 9 trenes.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor con `--watch` (reinicio automático) |
| `npm start` | Servidor producción |
| `npm run seed` | Pobla BD con datos demo |
