# Estrategia de testing — RailBoard

> **Idioma:** Español
> **Última actualización:** 2026-07-17
> **Test runner:** Vitest (backend + frontend)

---

## Estado actual

### Backend (72 tests, todos pasando)

| Suite              | Fichero                                            | Tipo                              |
| ------------------ | -------------------------------------------------- | --------------------------------- |
| DB CRUD            | `backend/src/__tests__/db.unit.test.js`            | Unitarios (SQLite temporal)       |
| Helpers            | `backend/src/__tests__/helpers.unit.test.js`       | Unitarios (funciones puras)       |
| API E2E            | `backend/src/__tests__/e2e.test.js`                | E2E (supertest + DB temp)         |
| Routes integración | `backend/src/__tests__/routes.integration.test.js` | Integración (Express + supertest) |

### Frontend (21 tests, todos pasando)

| Suite      | Fichero                                        | Tests                                                            |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| StatusPill | `src/components/__tests__/StatusPill.test.tsx` | 8 — renderiza con labels/classes correctas                       |
| Clock      | `src/components/__tests__/Clock.test.tsx`      | 3 — renderiza HH:MM:SS, hora ficticia                            |
| i18n       | `src/lib/__tests__/i18n.test.ts`               | 10 — traducciones existen para todas las claves en los 6 idiomas |

### Qué NO está testeado

| Fichero             | Líneas | Riesgo                                     |
| ------------------- | ------ | ------------------------------------------ |
| `Display.tsx`       | 841    | Alto — panel principal de salidas/llegadas |
| `Admin.tsx`         | 3128   | Alto — panel de administración monolítico  |
| `DisplayConfig.tsx` | 1001   | Alto — configuración por estación          |
| `Trains.tsx`        | 556    | Alto — gestión de trenes (drag & drop)     |
| `TrainSettings.tsx` | 203    | Medio — operadores/tipos de tren           |
| `routes.js`         | 1676   | Alto — mayoría de lógica de negocio        |
| `ws.js`             | 18     | Medio — WebSocket broadcast                |
| `routeService.js`   | 182    | Medio — servicio de datos de rutas         |
| `db.js`             | 882    | Alto — solo parcialmente testeado          |
| Subida de ficheros  | —      | Medio — upload CSV/JSON                    |
| `svgPlaceholder.ts` | —      | Bajo — utilidad de placeholder             |
| `tts.ts`            | —      | Bajo — Text-to-Speech                      |

---

## Pirámide de testing propuesta

```
         ╱╲
        ╱ E2E ╲           Playwright/Cypress (0 → 3 flujos críticos)
       ╱────────╲
      ╱ Integración ╲      supertest + MSW (3 → 8 tests)
     ╱──────────────╲
    ╱   Components    ╲   Testing Library + Vitest (3 → 20 tests)
   ╱────────────────────╲
  ╱     Unit tests        ╲ Vitest (72 → 100+)
 ╱──────────────────────────╲
```

## Prioridades para nuevos tests

### 🔴 Alta prioridad

| #   | Área                        | Qué testear                                                        | Tipo        | Fichero objetivo                                  |
| --- | --------------------------- | ------------------------------------------------------------------ | ----------- | ------------------------------------------------- |
| 1   | **Display.tsx**             | Render del panel, cambio de estado, rotación de idiomas            | Componente  | `frontend/src/pages/__tests__/Display.test.tsx`   |
| 2   | **Train CRUD API**          | Crear/actualizar/eliminar tren, añadir retraso, cambiar plataforma | Integración | `backend/src/__tests__/trains.api.test.js`        |
| 3   | **Propagación de retrasos** | Retraso en parada intermedia se propaga a siguientes               | Integración | `backend/src/__tests__/delay-propagation.test.js` |

### 🟡 Prioridad media

| #   | Área                     | Qué testear                                  | Tipo                   | Fichero objetivo                                 |
| --- | ------------------------ | -------------------------------------------- | ---------------------- | ------------------------------------------------ |
| 4   | **Generación de trenes** | Aleatorio, desde-ruta, con seed reproducible | Unitario + Integración | `backend/src/__tests__/train-generation.test.js` |
| 5   | **Admin.tsx**            | Navegación sidebar, auth, render de pestañas | Componente             | `frontend/src/pages/__tests__/Admin.test.tsx`    |
| 6   | **Subida de ficheros**   | Subida correcta + fichero inválido           | Integración            | `backend/src/__tests__/upload.test.js`           |

### 🟢 Prioridad baja

| #   | Área                | Qué testear                        | Tipo     | Fichero objetivo                                    |
| --- | ------------------- | ---------------------------------- | -------- | --------------------------------------------------- |
| 7   | **TTS**             | Inicialización, speak, stop        | Unitario | `frontend/src/lib/__tests__/tts.test.ts`            |
| 8   | **SVG Placeholder** | Generación de placeholder, tamaños | Unitario | `frontend/src/lib/__tests__/svgPlaceholder.test.ts` |

---

## Flujos críticos

| Flujo                      | Riesgo | Cobertura actual  | Cobertura objetivo          |
| -------------------------- | ------ | ----------------- | --------------------------- |
| Visualización del panel    | Alto   | Ninguna           | Componente + Integración    |
| CRUD de administración     | Alto   | Parcial (backend) | Backend completo + Frontend |
| Ciclo de vida de servicios | Alto   | Ninguna           | Integración                 |
| Subida de ficheros         | Medio  | Ninguna           | Integración                 |
| Generación de trenes       | Medio  | Ninguna           | Unitario + Integración      |
| Autenticación              | Medio  | Parcial           | Integración                 |

---

## Herramientas

| Capa            | Herramienta                   | Para                                |
| --------------- | ----------------------------- | ----------------------------------- |
| Unit tests      | **Vitest**                    | Backend + Frontend (ya en uso)      |
| Component tests | **@testing-library/react**    | Frontend (ya en uso)                |
| API tests       | **Supertest**                 | Backend (ya en uso)                 |
| API mocking     | **MSW** (Mock Service Worker) | Frontend (pendiente de implementar) |
| E2E             | **Playwright** o **Cypress**  | Flujos críticos (futuro)            |

---

## Datos de test

- **Backend:** SQLite temporal en `os.tmpdir()` (ya implementado)
- **Frontend:** MSW para mockear llamadas API
- **Fixtures:** definidos en `backend/src/fixtures/seedTrains.js`
- **Seed de datos:** `backend/src/seed.js` — crea operadores, tipos, plazas, trenes de demostración

---

## Integración continua (GitHub Actions)

Workflow pendiente de crear (`.github/workflows/test.yml`):

```yaml
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
        working-directory: backend
      - run: npm test
        working-directory: backend

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
        working-directory: frontend
      - run: npm test
        working-directory: frontend

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
        working-directory: frontend
```

---

## Objetivos

1. **Corto plazo (próxima sesión):** Tests para Display.tsx y Train CRUD API (+20 tests)
2. **Medio plazo (2-3 sesiones):** Admin.tsx, generación de trenes, subida de ficheros (+30 tests)
3. **Largo plazo:** E2E con Playwright (3 flujos críticos), CI estable en GitHub Actions
4. **Métrica objetivo:** >70% cobertura de líneas en el backend, >50% en el frontend
