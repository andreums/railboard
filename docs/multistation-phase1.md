# RailBoard — Multiestación Simple (Fase 1)

> Una misma instancia de RailBoard gestiona varias estaciones en un encuentro modular.
> Sin servicios, sin recorrido entre estaciones. Cada estación tiene su propio display y control.

---

## 1. Diseño funcional

### Concepto

En un encuentro modular hay varias estaciones (mesas). Cada operador controla los trenes de su estación. El display público de cada estación muestra solo sus trenes.

**Ejemplo:**
- Estación "València Nord" → operador con móvil marca salidas/llegadas
- Estación "Barcelona Sants" → otro operador, otro móvil, otro monitor
- Ambos conectados a la misma instancia de RailBoard

### Reglas de la Fase 1

- Un tren pertenece a una sola estación (`station_id` en `trains`)
- Una estación puede tener múltiples trenes
- Sin estación = tren "general" (compatible con datos actuales)
- El display `/` puede mostrar: todos los trenes, o solo los de una estación
- La URL `/display/:stationId` muestra el panel de una estación concreta
- La URL `/control/:stationId` filtra el control por estación
- El WebSocket sigue siendo global (broadcast a todos)

### Experiencia de uso

1. El organizador crea las estaciones desde `/stations`
2. Cada operador abre `http://railboard-local:4000/display/1` en su monitor
3. Cada operador abre `http://railboard-local:4000/control/1` en su móvil
4. Los cambios se ven al instante en todos los displays gracias al WS global

---

## 2. Base de datos SQLite

### Tabla `stations`

```sql
CREATE TABLE IF NOT EXISTS stations (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    short     TEXT NOT NULL DEFAULT '',   -- nombre corto para displays pequeños
    logo_url  TEXT,
    color     TEXT NOT NULL DEFAULT '#1A3254',  -- color distintivo para la estación
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Migración: `station_id` en `trains`

```sql
ALTER TABLE trains ADD COLUMN station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL;
```

### Migración: `default_station_id` en `config`

No requiere migración de schema — se guarda como clave-valor en la tabla `config` existente.

Claves nuevas en `config`:
- `default_station_id` — estación por defecto para el display `/`
- `show_all_stations` — `"true"` o `"false"` (si `/` muestra todos o solo default)

---

## 3. Migraciones

### Estrategia safe-add (mismo patrón que `sort_order` y `observations`)

```js
// En db.js, después de crear tablas
const hasStationId = db.prepare("PRAGMA table_info('trains')").all()
  .some((c) => c.name === "station_id");
if (!hasStationId) {
  db.exec("ALTER TABLE trains ADD COLUMN station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL");
}
```

Esto asegura que cualquier instancia existente con datos en `trains` mantiene sus trenes intactos (`station_id = NULL`).

### Datos semilla

```js
// seedConfig — añadir estación por defecto si no existe ninguna
const station = db.prepare("SELECT id FROM stations LIMIT 1").get();
if (!station) {
  db.prepare("INSERT INTO stations (name, short) VALUES (?, ?)")
    .run("Estación Principal", "Principal");
}
```

---

## 4. Endpoints REST

### Nuevos: CRUD de estaciones

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/stations` | No | Listar estaciones (ordenadas por sort_order) |
| POST | `/api/stations` | Sí | Crear estación |
| PUT | `/api/stations/:id` | Sí | Actualizar estación |
| DELETE | `/api/stations/:id` | Sí | Eliminar estación (trenes → station_id = NULL) |

### Modificados: filtro por estación en trains

| Método | Ruta | Cambio |
|--------|------|--------|
| GET | `/api/trains?station_id=X` | Nuevo query param opcional. Filtra trains por station_id. Sin parámetro = todos los trenes |
| POST | `/api/trains` | Body acepta `station_id` |
| PUT | `/api/trains/:id` | Body acepta `station_id` |

### Modificados: config

| Método | Ruta | Cambio |
|--------|------|--------|
| GET | `/api/config` | Ya incluye `default_station_id` y `show_all_stations` |
| PUT | `/api/config` | Ya acepta `default_station_id` y `show_all_stations` |

---

## 5. WebSocket

**Sin cambios.** El WS sigue siendo broadcast-only global. Cada cliente recibe el mismo mensaje `{"type":"update"}` y decide qué datos pedir según su estación.

Esto simplifica: el servidor no necesita saber qué estación ve cada cliente.

---

## 6. Frontend

### 6.1 Rutas nuevas

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/stations` | `Stations.tsx` | CRUD de estaciones |
| `/display/:stationId` | `Display.tsx` (reutilizada) | Display filtrado por estación |
| `/control/:stationId` | `Control.tsx` (ya planificada) | Live Control filtrado por estación |

### 6.2 Página nueva: `Stations.tsx`

Misma línea que `TrainSettings.tsx` — simple, funcional, sin complejidad.

```
Header: "RailBoard · Estaciones"
Tabla con: nombre, nombre corto, color (selector), logo, acciones editar/eliminar
Formulario inline para crear
```

### 6.3 Modificaciones en `Display.tsx`

```tsx
// Detectar si hay stationId en la URL
import { useParams } from "react-router-dom";

function Display() {
  const { stationId } = useParams();

  // En refresh(), filtrar por estación si corresponde
  const refresh = async () => {
    const [c, tr, pl] = await Promise.all([
      api.getConfig(),
      stationId ? api.listTrains({ station_id: Number(stationId) }) : api.listTrains(),
      api.listPlaces(),
    ]);
    // ...
  };

  // Header: mostrar nombre de la estación si estamos en /display/:id
  // Si no, mostrar "TODOS LOS TRENES" o el nombre de la default
}
```

Comportamiento de `/` vs `/display/:id`:

| Ruta | Comportamiento |
|------|----------------|
| `/` | Muestra según config: `show_all_stations=true` → todos; `false` → solo `default_station_id` |
| `/display/:id` | Muestra solo los trenes de esa estación. Header muestra el nombre de la estación |

### 6.4 Modificaciones en `Trains.tsx`

- Añadir selector de estación en el formulario (`TrainForm`)
- Añadir columna "Estación" en la lista de trenes
- Añadir filtro de estación en el header (dropdown para filtrar la vista)

### 6.5 Modificaciones en `Admin.tsx`

- Añadir sección "Estación por defecto" con selector de estación
- Añadir toggle "Mostrar todos los trenes en display principal"
- Enlaces a `/stations` desde admin

### 6.6 Modificaciones en `TrainSettings.tsx`

- Añadir enlace a `/stations` en el header de navegación

### 6.7 API client: `api.ts`

```ts
// Añadir tipos
export type Station = {
  id: number;
  name: string;
  short: string;
  logo_url: string | null;
  color: string;
  sort_order: number;
  created_at?: string;
};

// Añadir métodos
export const api = {
  // ...
  listStations: (): Promise<Station[]> => json("/stations"),
  createStation: (name: string, short?: string, color?: string) =>
    json("/stations", { method: "POST", body: JSON.stringify({ name, short, color }) }),
  updateStation: (id: number, data: Partial<Station>) =>
    json(`/stations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStation: (id: number) => json(`/stations/${id}`, { method: "DELETE" }),

  // Modificar listTrains para aceptar filtros
  listTrains: (params?: { station_id?: number }): Promise<Train[]> =>
    json(`/trains${params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString() : ''}`),
};
```

---

## 7. Estrategia de compatibilidad con datos actuales

| Aspecto | Compatibilidad |
|---------|----------------|
| Trenes existentes | `station_id = NULL` → aparecen en display global / y en /display sin filtro. No se pierden |
| Config existente | `default_station_id` no existe → display / muestra todos (comportamiento actual) |
| Operadores/tipos/lugares | Sin cambios. Siguen siendo globales |
| Display `/` actual | Sigue funcionando exactamente igual si no hay estaciones creadas |
| Encuentro en curso | Los trenes con station_id solo se ven en su estación. Los sin station_id se ven en todos los displays |
| Export/import | El formato .railboard.json incluye `stations` array |

---

## 8. Criterios de aceptación

1. [ ] Crear 2 estaciones desde `/stations` y ver que aparecen en la BD
2. [ ] Asignar trenes existentes a estaciones desde `/trains`
3. [ ] Abrir `/display/1` y ver solo trenes de estación 1
4. [ ] Abrir `/display/2` y ver solo trenes de estación 2
5. [ ] Abrir `/` y ver todos los trenes (o solo default, según config)
6. [ ] Desde `/mobile` (futuro) filtrar por estación
7. [ ] Eliminar una estación y ver que sus trenes quedan sin estación (no se pierden)
8. [ ] WebSocket actualiza todos los displays simultáneamente
9. [ ] Los trenes sin `station_id` (legacy) siguen funcionando
10. [ ] Tests pasan

---

## 9. Tests backend necesarios

| Archivo | Tests nuevos | Descripción |
|---------|-------------|-------------|
| `db.unit.test.js` | +3 | CRUD stations, migrate añade columna, station_id en train |
| `routes.integration.test.js` | +6 | GET /stations, POST (auth), PUT, DELETE, GET /trains?station_id= X, POST /trains con station_id |
| `e2e.test.js` | +5 | Crear station → crear train con station_id → filtrar → cambiar station → eliminar station |

**Total: +14 tests**

---

## 10. Tests frontend necesarios

| Archivo | Tests nuevos | Descripción |
|---------|-------------|-------------|
| `Stations.test.tsx` (nuevo) | +8 | Render lista vacía, crear estación, editar, eliminar |
| `Display.test.tsx` (nuevo) | +6 | Render con stationId, mostrar nombre estación, filtrar trenes |
| `api.test.ts` (nuevo) | +3 | listStations, listTrains con params, createStation |

**Total: +17 tests**

---

## 11. Plan de implementación paso a paso

### Paso 1: Backend — db.js

- Añadir CREATE TABLE stations
- Añadir migración ALTER TABLE trains ADD COLUMN station_id
- Añadir CRUD stations (mismo patrón que operators/trainTypes/places)
- Añadir seed de estación por defecto
- Modificar listTrains para aceptar filtro station_id opcional

### Paso 2: Backend — routes.js

- Añadir rutas GET/POST/PUT/DELETE /stations
- Modificar POST/PUT trains para aceptar station_id
- Modificar GET /trains para aceptar ?station_id=

### Paso 3: Backend — testes

- db.unit: +3 tests
- routes.integration: +6 tests
- e2e: +5 tests

### Paso 4: Frontend — api.ts

- Añadir tipo Station
- Añadir listStations, createStation, updateStation, deleteStation
- Modificar listTrains para aceptar params opcionales

### Paso 5: Frontend — Stations.tsx

- Página CRUD de estaciones (mismo diseño que TrainSettings)
- Nombre, nombre corto, color (color picker), logo upload

### Paso 6: Frontend — main.tsx

- Añadir ruta `/stations`
- Añadir ruta `/display/:stationId`

### Paso 7: Frontend — Display.tsx

- Detectar stationId de useParams
- Si hay stationId, pasarlo a listTrains
- Mostrar nombre de estación en el header
- Si no hay stationId, mantener comportamiento actual

### Paso 8: Frontend — Trains.tsx

- Añadir columna estación en TrainSummary
- Añadir selector de estación en TrainForm
- Añadir filtro de estación en la cabecera

### Paso 9: Frontend — Admin.tsx

- Añadir selector de estación por defecto
- Añadir toggle show_all_stations
- Enlace a /stations

### Paso 10: Frontend — tests

- Stations.test.tsx: +8 tests
- Display.test.tsx: +6 tests
- api.test.ts: +3 tests

### Paso 11: Verificación manual

- Probar flujo completo: crear estaciones, asignar trenes, displays por estación

---

## 12. Riesgos técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| El display `/` se rompe si no hay estaciones creadas | Baja | Alto | Comprobar que sin stations, `/` y `/trains` funcionan exactamente como hoy |
| station_id NULL rompe queries existentes | Baja | Medio | Los LEFT JOIN con stations ignoran NULL; listTrains sin filtro devuelve todos |
| El formulario TrainForm se vuelve demasiado largo | Media | Bajo | Ya tiene muchos campos; station_id es un select más, no crítico |
| Confusión entre estaciones en operación real | Media | Medio | La URL `/display/:id` y el header de color distintivo ayudan |
| La tabla stations duplica info de config.station_name | Media | Bajo | station_name en config se mantiene para la estación principal del evento. stations son las mesas del encuentro |
| Conflictos de nombres de estación | Baja | Bajo | name es UNIQUE? No es necesario para Fase 1. Se valida en frontend |

---

## Apéndice: Ejemplo de flujo completo

```
1. Organizador crea 3 estaciones:
   → POST /api/stations { name: "València Nord", short: "VLC", color: "#3E8DCA" }
   → POST /api/stations { name: "Barcelona Sants", short: "BCN", color: "#E5232C" }
   → POST /api/stations { name: "Xàtiva", short: "XTV", color: "#00853F" }

2. Carga trenes asignándolos:
   → POST /api/trains { number: "03104", station_id: 1, ... }
   → POST /api/trains { number: "24001", station_id: 2, ... }
   → POST /api/trains { number: "34005", station_id: 3, ... }

3. Cada operador abre su display:
   → http://railboard:4000/display/1  → ve "València Nord" y sus trenes
   → http://railboard:4000/display/2  → ve "Barcelona Sants" y sus trenes
   → http://railboard:4000/display/3  → ve "Xàtiva" y sus trenes

4. El display general sigue funcionando:
   → http://railboard:4000/ → ve todos los trenes de todas las estaciones
```

---

*Documento generado el 30 de mayo de 2026. Siguiente: implementación Paso 1.*
