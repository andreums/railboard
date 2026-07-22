# Análisis Técnico — RailBoard

> Radiografía completa del proyecto: estado actual, inventario funcional, arquitectura, deuda técnica y hoja de ruta.

## 1. Estructura del Proyecto

```
railboard/
├── backend/
│   ├── src/
│   │   ├── index.js              # Entry-point Express (helmet, CORS, rate-limit, WS attach)
│   │   ├── routes.js             # 17 endpoints REST + generación random de trenes
│   │   ├── db.js                 # SQLite schema + CRUD (operators, train_types, places, trains)
│   │   ├── ws.js                 # WebSocket server (broadcast-only)
│   │   ├── fixtures/
│   │   │   ├── routes.js         # 16 rutas de Rodalia/Renfe con estaciones, números, colores
│   │   │   └── seedTrains.js     # 9 trenes de demo
│   │   └── __tests__/
│   │       ├── helpers.unit.test.js    # 24 tests: normalizeStation, addMinutes, etc.
│   │       ├── db.unit.test.js         # 15 tests: CRUD operators, types, places, trains
│   │       ├── routes.integration.test.js  # 16 tests: auth, CORS, helmet, endpoints
│   │       └── e2e.test.js             # 17 tests: flujo completo admin
│   ├── uploads/                  # Logos subidos por el admin
│   ├── data.db                   # SQLite (en .gitignore)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx              # React Router (4 rutas)
│   │   ├── pages/
│   │   │   ├── Display.tsx       # Panel público tipo Gravita (583 líneas)
│   │   │   ├── Admin.tsx         # Config estación + estilos + lugares + seed/auto-gen
│   │   │   ├── Trains.tsx        # CRUD trenes + drag & drop + formulario (502 líneas)
│   │   │   └── TrainSettings.tsx # CRUD operadores + tipos de tren con logo upload
│   │   ├── components/
│   │   │   ├── Clock.tsx         # Reloj real/ficticio
│   │   │   ├── StatusPill.tsx    # Badge de estado (6 estados)
│   │   │   └── SteamTrain.tsx    # Loading screen animada
│   │   ├── lib/
│   │   │   ├── api.ts            # Cliente REST tipado + WebSocket + fileUrl
│   │   │   └── i18n.ts           # 6 idiomas (es, ca, en, fr, eu, gl), 74 claves
│   │   ├── styles/
│   │   │   └── index.css         # Tailwind + animaciones CSS
│   │   └── __tests__/
│   │       ├── setup.ts
│   │       └── (tests en lib/__tests__/ y components/__tests__/)
│   ├── tailwind.config.js        # Paleta board-*, fuentes display/body/mono
│   ├── vite.config.ts
│   └── package.json
│
└── docs/
    ├── index.md
    ├── architecture.md
    ├── api.md
    ├── frontend.md
    ├── backend.md
    ├── security-audit.md
    ├── testing.md
    └── technical-analysis.md     ← este archivo
```

## 2. Backend — Tabla de Endpoints

| Método | Ruta                         | Auth | Body                 | Descripción                                        |
| ------ | ---------------------------- | ---- | -------------------- | -------------------------------------------------- |
| GET    | `/health`                    | No   | —                    | Health check                                       |
| GET    | `/api/config`                | No   | —                    | Config estación                                    |
| PUT    | `/api/config`                | Sí   | JSON                 | Actualizar config                                  |
| GET    | `/api/trains`                | No   | —                    | Todos los trenes (con JOIN operators, train_types) |
| POST   | `/api/trains`                | Sí   | JSON                 | Crear tren                                         |
| PUT    | `/api/trains/:id`            | Sí   | JSON                 | Actualizar tren completo                           |
| PATCH  | `/api/trains/:id/status`     | Sí   | `{status}`           | Cambiar estado                                     |
| PATCH  | `/api/trains/:id/delay`      | Sí   | `{minutes}`          | Añadir retraso                                     |
| PATCH  | `/api/trains/:id/platform`   | Sí   | `{platform, sector}` | Cambiar vía/sector                                 |
| DELETE | `/api/trains/:id`            | Sí   | —                    | Eliminar tren                                      |
| DELETE | `/api/trains`                | Sí   | X-Confirm: yes       | Borrar TODOS los trenes                            |
| PUT    | `/api/trains/reorder`        | Sí   | `{ids: number[]}`    | Reordenar sort_order                               |
| GET    | `/api/operators`             | No   | —                    | Listar operadores                                  |
| POST   | `/api/operators`             | Sí   | multipart            | Crear operador (con logo)                          |
| PUT    | `/api/operators/:id`         | Sí   | multipart            | Actualizar operador                                |
| DELETE | `/api/operators/:id`         | Sí   | —                    | Eliminar operador                                  |
| GET    | `/api/train-types`           | No   | —                    | Listar tipos                                       |
| POST   | `/api/train-types`           | Sí   | multipart            | Crear tipo (upsert por code)                       |
| PUT    | `/api/train-types/:id`       | Sí   | multipart            | Actualizar tipo                                    |
| DELETE | `/api/train-types/:id`       | Sí   | —                    | Eliminar tipo                                      |
| GET    | `/api/places`                | No   | —                    | Listar lugares                                     |
| POST   | `/api/places`                | Sí   | multipart            | Crear lugar                                        |
| PUT    | `/api/places/:id`            | Sí   | multipart            | Actualizar lugar                                   |
| DELETE | `/api/places/:id`            | Sí   | —                    | Eliminar lugar                                     |
| POST   | `/api/seed-trains`           | Sí   | —                    | Cargar 9 trenes demo                               |
| POST   | `/api/generate-random-train` | Sí   | —                    | Generar 1 tren realista                            |

**Total: 27 endpoints** (14 públicos GET, 13 privados POST/PUT/PATCH/DELETE con BasicAuth)

## 3. Base de Datos — Schema (SQLite con WAL)

### 3.1 Diagrama ER (Mermaid)

```mermaid
erDiagram
    CONFIG {
        key TEXT PK
        value TEXT
    }
    OPERATORS {
        id INTEGER PK
        name TEXT UNIQUE
        logo_url TEXT
    }
    TRAIN_TYPES {
        id INTEGER PK
        code TEXT UNIQUE
        name TEXT
        color TEXT
        logo_url TEXT
    }
    PLACES {
        id INTEGER PK
        name TEXT UNIQUE
        logo_url TEXT
    }
    TRAINS {
        id INTEGER PK
        number TEXT
        operator_id INTEGER FK
        train_type_id INTEGER FK
        origin TEXT
        destination TEXT
        stops TEXT "JSON array"
        scheduled_time TEXT "HH:MM"
        expected_time TEXT "HH:MM"
        platform TEXT
        sector TEXT
        status TEXT "Scheduled|Boarding|Delayed|Departed|Arrived|Cancelled"
        sort_order INTEGER
        observations TEXT
        created_at TEXT "datetime(now)"
    }
    OPERATORS ||--o{ TRAINS : "operator_id"
    TRAIN_TYPES ||--o{ TRAINS : "train_type_id"
```

### 3.2 Notas del schema

- `stops` se almacena como JSON string (`JSON.stringify`/`JSON.parse`)
- `operator_id` y `train_type_id` tienen `ON DELETE SET NULL`
- Migraciones progresivas: `sort_order`, `observations`, `logo_url` en places se añadieron con ALTER TABLE condicional
- WAL mode activado para mejor concurrencia

## 4. Frontend — Tabla de Páginas y Componentes

| Página              | Ruta              | Funcionalidad                                                         | Líneas |
| ------------------- | ----------------- | --------------------------------------------------------------------- | ------ |
| `Display.tsx`       | `/`               | Panel público Gravita-style, reloj, scrolling marquee, auto-poll 5s   | 583    |
| `Admin.tsx`         | `/admin`          | Config estación, estilos (colores), CRUD lugares, seed/generar trenes | 287    |
| `Trains.tsx`        | `/trains`         | CRUD trenes completo, drag & drop (dnd-kit), formulario, anuncio TTS  | 502    |
| `TrainSettings.tsx` | `/train-settings` | CRUD operadores y tipos de tren con upload logos                      | 159    |

| Componente   | Props                                 | Rol                                     |
| ------------ | ------------------------------------- | --------------------------------------- |
| `Clock`      | `mode`, `fakeTime`, `fakeStepSeconds` | Reloj real o ficticio (1s interval)     |
| `StatusPill` | `status`, `large`                     | Badge de estado con CSS animado         |
| `SteamTrain` | —                                     | Loading splash animado                  |
| `ScrollText` | `text`, `color`, `bold`, `fontSize`   | Texto con scroll horizontal en overflow |

### 4.1 Temas visuales

- Paleta CSS: `board-bg` (#050a14), `board-row` (#1A3254), `board-amber`, etc.
- 9 colores configurables en vivo (bg, header, filas, texto)
- Fuentes: Bebas Neue (títulos), Inter (cuerpo), JetBrains Mono (reloj/números)
- Display estilo Gravita: tamaño de fila = `min(calc(84dvh / n), 12dvh)`, nested flex en upper/lower row

## 5. Tiempo Real — Análisis

### 5.1 WebSocket

- **Broadcast-only unidireccional**: Servidor envía `{"type": "update", "at": timestamp}` cada vez que cambia algo
- Cliente reconecta automáticamente cada 1.5s en caso de caída
- No hay autenticación en WS (no necesario — solo recibe)
- No hay mensajes de cliente → servidor (no hay comandos por WS)

### 5.2 Polling

- Display.tsx: `setInterval(refresh, 5000)` + WS como vía rápida (redundancia)
- Admin/Trains/TrainSettings: solo WS (escuchan cambios de otras pestañas)

### 5.3 Latencia esperada

- WS: sub-100ms en LAN
- Polling: 5s de lag máximo en Display

## 6. Seguridad — Estado Actual

### 6.1 Implementado

- `helmet()` con defaults (11 headers de seguridad)
- CORS restringido a `http://localhost:5173` (configurable via `CORS_ORIGIN`)
- Two rate-limiters: 120 req/min general, 30 req/min writes
- BasicAuth en todos los endpoints POST/PUT/PATCH/DELETE
- `multer` con `fileFilter`: solo PNG/JPG/GIF/WebP/SVG, max 2MB
- `X-Confirm: yes` requerido para DELETE /api/trains (borrado masivo)
- `express.json({ limit: "1mb" })`
- Error middleware global con captura de `MulterError` y `FILE_TYPE_NOT_ALLOWED`
- .gitignore actualizado con `data.db*` y `uploads/`

### 6.2 No implementado (riesgo bajo para proyecto hobby)

- Sin HTTPS (asume reverse proxy o local)
- Sin autenticación en WebSocket (no necesario — solo broadcast)
- Sin validación de schemas (JSON sin forma, confianza en el cliente)
- Sin helmet HSTS preload (dispararía advertencia en localhost)
- Admin password por defecto "railboard" en código (configurable via env)

## 7. Inventario Funcional — Todo lo que hace RailBoard

### 7.1 Funcionalidades implementadas

- [x] Panel público departures/arrivals tipo Gravita (auto-escalado, filas alternas)
- [x] Reloj real y modo ficticio (avance configurable 1-15s/step)
- [x] 6 estados de tren con display visual diferenciado
- [x] Cuenta atrás en minutos para trenes próximos
- [x] Scroll horizontal en textos largos (stops, observaciones)
- [x] Footer con marquee de mensajes
- [x] 6 idiomas (es, ca, en, fr, eu, gl)
- [x] CRUD completo de trenes (crear, editar, eliminar, reordenar drag & drop)
- [x] CRUD de operadores con logo upload
- [x] CRUD de tipos de tren con color y logo upload (incluye upsert por código)
- [x] CRUD de lugares/destinos
- [x] Configuración visual completa (9 colores, fuentes, tamaños)
- [x] Generación de trenes aleatorios realistas (16 rutas, 4 operadores, distribución por tipo)
- [x] Seed de 9 trenes demo
- [x] Generación de panel completo (clear + 8 trenes)
- [x] Auto-generación periódica de trenes (intervalo configurable)
- [x] WebSocket broadcast en tiempo real
- [x] Anuncio por megafonía (TTS en español)
- [x] Función `normalizeStation` para matching de estaciones (unicode, variantes)
- [x] Modo arrivals/departures con lógica de dirección opuesta
- [x] Rol de Cercanías: probabilidades de retraso diferenciadas por tipo
- [x] Las rutas de C-2 pueden terminar en Xàtiva (55% de probabilidad)
- [x] Parsing de hora ficticia para generación de trenes
- [x] Weighted random selection para equilibrar número de trenes por línea

### 7.2 Funcionalidades no implementadas / a considerar

- [ ] Histórico de trenes del día (no se guardan trenes departed/arrived)
- [ ] Búsqueda/filtro de trenes en admin
- [ ] Exportar/importar configuración (JSON backup)
- [ ] Tema oscuro/claro (tema único oscuro)
- [ ] Autenticación real (JWT/sessions) — proporcional para el uso actual
- [ ] HTTPS nativo (certificado self-signed para redes locales)
- [ ] Múltiples paneles simultáneos (cada panel = una instancia)
- [ ] WebSocket bidireccional para evitar polling 5s

## 8. Dependencias y Versiones

### Backend

| Paquete            | Versión      | Propósito                |
| ------------------ | ------------ | ------------------------ |
| express            | ^4.21.0      | Framework HTTP           |
| better-sqlite3     | ^11.3.0      | SQLite síncrono y rápido |
| ws                 | ^8.18.0      | WebSocket server         |
| multer             | ^1.4.5-lts.1 | File upload (logos)      |
| helmet             | ^8.2.0       | Seguridad cabeceras HTTP |
| express-rate-limit | ^8.5.2       | Rate limiting            |
| express-basic-auth | ^1.2.1       | BasicAuth admin          |
| cors               | ^2.8.5       | CORS                     |
| **vitest**         | ^4.1.7       | Tests                    |
| **supertest**      | ^7.2.2       | Test HTTP                |

### Frontend

| Paquete                 | Versión | Propósito                              |
| ----------------------- | ------- | -------------------------------------- |
| react                   | ^18.3.1 | UI                                     |
| react-dom               | ^18.3.1 | DOM                                    |
| react-router-dom        | ^6.27.0 | Routing                                |
| @dnd-kit/core           | ^6.3.1  | Drag & drop                            |
| @dnd-kit/sortable       | ^10.0.0 | Sortable DnD                           |
| @dnd-kit/utilities      | ^3.2.2  | DnD utilities                          |
| tailwindcss             | ^3.4.14 | CSS utility                            |
| **react-beautiful-dnd** | ^13.1.1 | **NO USADO** (reemplazado por dnd-kit) |
| vite                    | ^5.4.10 | Build tool                             |
| typescript              | ^5.6.3  | Type checking                          |
| vitest                  | ^4.1.7  | Tests                                  |
| jsdom                   | ^29.1.1 | DOM simulado tests                     |

## 9. Tests — Cobertura

| Archivo                      | Tipo        | Tests  | ¿Qué cubre?                                        |
| ---------------------------- | ----------- | ------ | -------------------------------------------------- |
| `helpers.unit.test.js`       | Unit        | 24     | normalizeStation, addMinutes, profileForType, etc. |
| `db.unit.test.js`            | Unit        | 15     | CRUD operators, types, places, trains, config      |
| `routes.integration.test.js` | Integration | 16     | Helmet, CORS, rate-limit, auth, endpoints          |
| `e2e.test.js`                | E2E         | 17     | Workflow admin completo con DB temporal            |
| `i18n.test.ts`               | Unit        | 8      | Traducciones, key fallback, consistencia lenguajes |
| `StatusPill.test.tsx`        | Unit        | 9      | Labels, clases CSS, tamaños                        |
| `Clock.test.tsx`             | Unit        | 4      | Formato HH:MM:SS, fake time                        |
| **Total**                    |             | **93** |                                                    |

### 9.1 Patrón de tests

- Backend usa `DB_PATH` env var → temp DB aislada (cada archivo su propio `beforeAll` con `:memory:`)
- `supertest` sin levantar server real (Express app → supertest)
- Frontend: `vitest` + `jsdom` + `@testing-library/react`
- `SeedTrains.test.tsx` mencionado en docs/testing.md pero **no existe** en disco

### 9.2 Gap de cobertura notable

- Admin.tsx: 0 tests
- Trains.tsx (502 líneas): 0 tests
- TrainSettings.tsx: 0 tests
- api.ts (WS connect, fileUrl): 0 tests
- backend/src/index.js: 0 tests directos (cubierto indirectamente por routes.integration)
- Sin tests de WebSocket

## 10. Deuda Técnica

### 10.1 Crítica

1. ✅ N/A — No hay bugs conocidos en producción

### 10.2 Alta

2. `react-beautiful-dnd` en package.json pero no se usa (solo dnd-kit). Pesa 45KB+ en node_modules
3. Sin tests para Admin.tsx ni Trains.tsx (> 750 líneas sin cobertura de página completa)
4. El tipo `(import.meta as any).env` en api.ts escapa type checking completamente
5. Display.tsx con 583 líneas — componente monolítico difícil de testear y mantener
6. El archivo `docs/testing.md` referencia `SeedTrains.test.tsx` que no existe

### 10.3 Media

7. Sin validación de esquemas (JSON sin forma en endpoints POST/PUT — SQLite acepta tipos incorrectos)
8. La migración progresiva de schema (ALTER TABLE condicional) funciona pero no hay versión de schema
9. Las contraseñas admin van en texto plano en BasicAuth (no es un bug — es elección de diseño)
10. No hay límite de caracteres en `observations` (TEXT sin constraints)
11. El formulario TrainForm en Trains.tsx mezcla lógica de create y edit con el mismo state
12. La función `ensureLearnedRailData` en routes.js crea datos automáticamente sin preguntar

### 10.4 Baja

13. Sin linting (ni ESLint ni Prettier en ningún package.json)
14. Sin pre-commit hooks
15. Sin CI/CD
16. Las rutas de fixtures (routes.js) están hardcodeadas — genial para demo, pero sería mejor un JSON externo
17. El backend usa `node --watch` para dev — no usa nodemon ni similar
18. El archivo `.gitignore` tiene un marker `# git-lfs` sin usar
19. Sin definición de TypeScript en backend (todo JS puro — intencional, pero sin types compartidos)

## 11. Clasificación de Madurez

| Dimensión         | Nivel     | Nota                                                                         |
| ----------------- | --------- | ---------------------------------------------------------------------------- |
| **Funcionalidad** | 4/5       | Panel Gravita completo, CRUD, random gen, i18n, TTS, DnD                     |
| **Seguridad**     | 3/5       | Helmet, CORS, rate-limit, auth, fileFilter — falta validación de input       |
| **Tests**         | 3/5       | 93 tests, coverage en helpers/db/routes/frontend — gaps en Admin/Trains      |
| **Rendimiento**   | 4/5       | SQLite WAL, polling corto, WS — panel pesado en re-renders                   |
| **Código**        | 3/5       | Limpio en general, Display.tsx monolítico, JS sin types compartidos          |
| **Documentación** | 4/5       | /docs completo con 8 archivos                                                |
| **Deploy**        | 2/5       | Sin CI/CD, sin Docker, sin scripts de deploy                                 |
| **Global**        | **3.3/5** | Sólido para hobby project, con gaps en testing de páginas complejas y deploy |

## 12. Hoja de Ruta de Consolidación Inmediata

### Prioridad 1 (antes de añadir features)

1. Eliminar `react-beautiful-dnd` de frontend package.json → `npm uninstall`
2. Refactorizar Display.tsx → extraer `BoardRow`, `BoardHeader`, `BoardFooter` como componentes separados
3. Añadir tests para Admin.tsx (al menos flujo de guardar config y CRUD lugares)
4. Añadir tests para Trains.tsx (render, drag & drop, formulario)
5. Eliminar la referencia fantasma a `SeedTrains.test.tsx` en testing.md
6. Tipar `import.meta.env` con archivo `.d.ts` o `vite/client` reference

### Prioridad 2 (calidad de vida)

7. Añadir ESLint + Prettier a backend y frontend
8. Añadir validación de schemas (ej. `zod` en endpoints POST/PUT)
9. Extraer fixtures/routes.js a JSON externo
10. Añadir script de backup/restore de config

### Prioridad 3 (para VPS/red local)

11. Dockerizar backend y frontend (Dockerfile + docker-compose con volúmenes)
12. Generar certificado self-signed + forzar HTTPS
13. Añadir script de deploy (systemd unit o similar)
14. Middleware de logging estructurado (morgan o pino)

---

_Documento generado el 30 de mayo de 2026. Estado actual del proyecto._
