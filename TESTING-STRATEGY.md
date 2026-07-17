# Estratègia de testing — RailBoard

> **Idioma:** Català
> **Última actualització:** 2026-07-17
> **Test runner:** Vitest (backend + frontend)

---

## Estat actual

### Backend (72 tests, tots passant)

| Suite | Fitxer | Tipus |
|-------|--------|-------|
| DB CRUD | `backend/src/__tests__/db.unit.test.js` | Unitaris (SQLite temporal) |
| Helpers | `backend/src/__tests__/helpers.unit.test.js` | Unitaris (funcions pures) |
| API E2E | `backend/src/__tests__/e2e.test.js` | E2E (supertest + DB temp) |
| Routes integració | `backend/src/__tests__/routes.integration.test.js` | Integració (Express + supertest) |

### Frontend (21 tests, tots passant)

| Suite | Fitxer | Tests |
|-------|--------|-------|
| StatusPill | `src/components/__tests__/StatusPill.test.tsx` | 8 — renderiza amb labels/classes correctes |
| Clock | `src/components/__tests__/Clock.test.tsx` | 3 — renderiza HH:MM:SS, hora fictícia |
| i18n | `src/lib/__tests__/i18n.test.ts` | 10 — traduccions existeixen per a totes les claus als 6 idiomes |

### Què NO està testejat

| Fitxer | Línies | Risc |
|--------|--------|------|
| `Display.tsx` | 841 | Alt — panell principal de sortides/arribades |
| `Admin.tsx` | 3128 | Alt — panell d'administració monolític |
| `DisplayConfig.tsx` | 1001 | Alt — configuració per estació |
| `Trains.tsx` | 556 | Alt — gestió de trens (drag & drop) |
| `TrainSettings.tsx` | 203 | Mig — operadors/tipus de tren |
| `routes.js` | 1676 | Alt — majoria de lògica de negoci |
| `ws.js` | 18 | Mig — WebSocket broadcast |
| `routeService.js` | 182 | Mig — servei de dades de rutes |
| `db.js` | 882 | Alt — només parcialment testejat |
| Pujada de fitxers | — | Mig — upload CSV/JSON |
| `svgPlaceholder.ts` | — | Baix — utilitat de placeholder |
| `tts.ts` | — | Baix — Text-to-Speech |

---

## Piràmide de testing proposada

```
         ╱╲
        ╱ E2E ╲           Playwright/Cypress (0 → 3 fluxos crítics)
       ╱────────╲
      ╱ Integració ╲      supertest + MSW (3 → 8 tests)
     ╱──────────────╲
    ╱   Components    ╲   Testing Library + Vitest (3 → 20 tests)
   ╱────────────────────╲
  ╱     Unit tests        ╲ Vitest (72 → 100+)
 ╱──────────────────────────╲
```

## Prioritats per a nous tests

### 🔴 Alta prioritat

| # | Àrea | Què testar | Tipus | Fitxer objectiu |
|---|------|-----------|-------|-----------------|
| 1 | **Display.tsx** | Render de panell, canvi d'estat, rotació d'idiomes | Component | `frontend/src/pages/__tests__/Display.test.tsx` |
| 2 | **Train CRUD API** | Crear/actualitzar/eliminar tren, afegir retard, canviar plataforma | Integració | `backend/src/__tests__/trains.api.test.js` |
| 3 | **Propagació de retards** | Retard en parada intermedia es propaga a següents | Integració | `backend/src/__tests__/delay-propagation.test.js` |

### 🟡 Prioritat mitjana

| # | Àrea | Què testar | Tipus | Fitxer objectiu |
|---|------|-----------|-------|-----------------|
| 4 | **Generació de trens** | Aleatori, des-de-ruta, amb seed reproducible | Unitari + Integració | `backend/src/__tests__/train-generation.test.js` |
| 5 | **Admin.tsx** | Navegació sidebar, auth, render de pestanyes | Component | `frontend/src/pages/__tests__/Admin.test.tsx` |
| 6 | **Pujada de fitxers** | Pujada correcta + fitxer invàlid | Integració | `backend/src/__tests__/upload.test.js` |

### 🟢 Prioritat baixa

| # | Àrea | Què testar | Tipus | Fitxer objectiu |
|---|------|-----------|-------|-----------------|
| 7 | **TTS** | Inicialització, speak, stop | Unitari | `frontend/src/lib/__tests__/tts.test.ts` |
| 8 | **SVG Placeholder** | Generació de placeholder, mides | Unitari | `frontend/src/lib/__tests__/svgPlaceholder.test.ts` |

---

## Fluxos crítics

| Flux | Risc | Cobertura actual | Cobertura objectiu |
|------|------|-----------------|-------------------|
| Visualització del panell | Alt | Cap | Component + Integració |
| CRUD d'administració | Alt | Parcial (backend) | Backend complet + Frontend |
| Cicle de vida de serveis | Alt | Cap | Integració |
| Pujada de fitxers | Mig | Cap | Integració |
| Generació de trens | Mig | Cap | Unitari + Integració |
| Autenticació | Mig | Parcial | Integració |

---

## Eines

| Capa | Eina | Per a |
|------|------|-------|
| Unit tests | **Vitest** | Backend + Frontend (ja en ús) |
| Component tests | **@testing-library/react** | Frontend (ja en ús) |
| API tests | **Supertest** | Backend (ja en ús) |
| API mocking | **MSW** (Mock Service Worker) | Frontend (pendent d'implementar) |
| E2E | **Playwright** o **Cypress** | Fluxos crítics (futur) |

---

## Dades de test

- **Backend:** SQLite temporal a `os.tmpdir()` (ja implementat)
- **Frontend:** MSW per a mockejar crides API
- **Fixtures:** definits a `backend/src/fixtures/seedTrains.js`
- **Seed de dades:** `backend/src/seed.js` — crea operadors, tipus, places, trens de demostració

---

## Integració contínua (GitHub Actions)

Workflow pendent de crear (`.github/workflows/test.yml`):

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

## Objectius

1. **Curt termini (pròxima sessió):** Tests per a Display.tsx i Train CRUD API (+20 tests)
2. **Mitjà termini (2-3 sessions):** Admin.tsx, generació de trens, pujada de fitxers (+30 tests)
3. **Llarg termini:** E2E amb Playwright (3 fluxos crítics), CI estable al GitHub Actions
4. **Mètrica objectiu:** >70% cobertura de línies al backend, >50% al frontend
