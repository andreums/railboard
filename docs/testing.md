# Tests — Railboard

**Stack:** Vitest + Supertest (backend) + Testing Library (frontend)  

## Estructura

```
backend/
└── src/
    └── __tests__/
        ├── helpers.unit.test.js      # Tests unitarios: utilidades puras
        ├── db.unit.test.js            # Tests de base de datos (CRUD)
        ├── routes.integration.test.js # Tests de integración HTTP
        └── e2e.test.js                # Tests E2E del flujo completo

frontend/
└── src/
    ├── __tests__/
    │   └── setup.ts                   # Configuración jsdom + jest-dom
    ├── lib/
    │   └── __tests__/
    │       └── i18n.test.ts           # Tests de internacionalización
    └── components/
        └── __tests__/
            ├── Clock.test.tsx          # Tests del reloj
            └── StatusPill.test.tsx     # Tests del badge de estado
```

## Cómo ejecutar

```bash
# Backend — todos los tests
cd backend && npm test

# Backend — modo watch
cd backend && npm run test:watch

# Frontend — todos los tests
cd frontend && npm test

# Frontend — modo watch
cd frontend && npm run test:watch
```

**Total:** 93 tests (72 backend + 21 frontend)

---

## Backend

### helpers.unit.test.js (24 tests)

Funciones puras sin dependencias externas:

| Test | Lo que verifica |
|------|----------------|
| `normalizeStation` | Elimina acentos, normaliza "Estació" → "Estación", lowercase, trim, null/undefined |
| `stationIndex` | Encuentra estación por nombre normalizado, retorna -1 si no existe |
| `addMinutes` | Suma/resta minutos, wrap a siguiente día, wrap a día anterior, cero |
| `minutesFromHHMM` | Convierte "HH:MM" a minutos totales |
| `orderedIntermediateStops` | Paradas intermedias forward/backward, adyacentes, misma posición |
| `profileForType` | Perfiles correctos según tipo: Cercanías, MD, AVE, desconocido |

### db.unit.test.js (15 tests)

Base de datos SQLite con archivo temporal:

| Test | Lo que verifica |
|------|----------------|
| Config | Valores por defecto, set/get, merge de claves |
| Operadores | CRUD completo: crear, listar, actualizar, eliminar |
| Tipos de tren | Creación, prevención de duplicados |
| Lugares | Creación y listado |
| Trenes | Creación con stops parseados, listado con JOINs, getTrain, null si no existe, actualización de status/delay/platform, eliminación |
| addMinutes helper | Operación desde db.js |

### routes.integration.test.js (16 tests)

Express + Supertest con BD temporal y auth:

| Test | Lo que verifica |
|------|----------------|
| Health | `GET /health` → 200 `{ ok: true }` |
| Helmet | Cabeceras de seguridad: X-Content-Type-Options, X-Frame-Options, STS, CSP |
| CORS | `access-control-allow-origin` restringido |
| Endpoints GET | `/api/trains`, `/api/config`, `/api/operators`, `/api/train-types`, `/api/places` — públicos y responden con arrays/objetos |
| Auth POST | `POST /api/trains` sin auth → 401 |
| Auth PUT | `PUT /api/config` sin auth → 401 |
| Auth DELETE | `DELETE /api/trains` sin auth → 401 |
| Auth seed | `POST /seed-trains` sin auth → 401 |
| Create train | `POST /api/trains` con auth → 201 con datos |
| Update train | `PUT /api/trains/:id` con auth → 200 |
| Patch status | `PATCH /api/trains/:id/status` → 200 |
| Add delay | `PATCH /api/trains/:id/delay` → 200, expected_time cambia |
| Delete all | `DELETE /api/trains` con auth + `X-Confirm: yes` → 204 |
| Delete sin confirm | `DELETE /api/trains` sin `X-Confirm` → 400 |
| Update config | `PUT /api/config` con auth → 200 |

### e2e.test.js (17 tests)

Flujo completo de usuario administrador:

```
1. Crear operador (Renfe)
2. Crear tipo de tren (AVE)
3. Crear lugares (Madrid, Barcelona)
4. Crear tren completo (con operador, tipo, paradas)
5. Listar trenes y verificar joined fields
6. Cambiar estado a Boarding
7. Añadir retraso de 10 minutos
8. Cambiar plataforma y sector
9. Reordenar trenes
10. Generar tren aleatorio
11. Eliminar tren
12. Seed de 9 trenes demo
```

## Frontend

### i18n.test.ts (8 tests)

| Test | Lo que verifica |
|------|----------------|
| Traducciones | "departures" en es, en, ca, fr |
| Traducciones adicionales | "platform" en eu, gl |
| Key fallback | Clave inexistente → devuelve la clave |
| Consistencia | Todos los idiomas tienen las mismas claves que español |
| Presencia | Los 6 idiomas están definidos |

### StatusPill.test.tsx (9 tests)

| Test | Lo que verifica |
|------|----------------|
| Labels | Cada status renderiza su label en español |
| CSS classes | Clases de estilo correctas para Delayed (font-bold) |
| Uppercase | Clase `uppercase` presente |
| Tamaño large | `text-base` cuando `large=true` |
| Tamaño small | `text-sm` por defecto |

### Clock.test.tsx (4 tests)

| Test | Lo que verifica |
|------|----------------|
| Formato | Renderiza `HH:MM:SS` en modo real |
| Hora ficticia | Renderiza la hora fake especificada |
| Por defecto | Renderiza hora por defecto cuando no se especifica |
