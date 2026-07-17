# Guia d'incorporació — RailBoard

> **Idioma:** Català (el projecte usa principalment castellà i anglès als codis font)
> **Última actualització:** 2026-07-17
> **Versió del projecte:** 1.0.0

---

## Índex

- [Requisits del sistema](#requisits-del-sistema)
- [Configuració inicial (Docker)](#configuració-inicial-docker)
- [Execució en desenvolupament sense Docker](#execució-en-desenvolupament-sense-docker)
- [Seed de dades de demostració](#seed-de-dades-de-demostració)
- [Testing](#testing)
- [Estructura del projecte](#estructura-del-projecte)
- [Comandes útils](#comandes-útils)
- [Resolució de problemes comuns](#resolució-de-problemes-comuns)
- [Convencions de codi](#convencions-de-codi)
- [Flux de treball](#flux-de-treball)
- [Documentació relacionada](#documentació-relacionada)

---

## Requisits del sistema

| Eina | Versió mínima | Per a |
|------|--------------|-------|
| **Docker** | 24+ | Execució en producció i desenvolupament |
| **Docker Compose** | v2.24+ | Orquestració de contenidors |
| **Git** | 2.40+ | Control de versions |
| **Node.js** | 20 LTS (>=18) | Desenvolupament local sense Docker |
| **npm** | 10+ | Gestió de dependències |

> **Nota:** Si uses macOS amb Apple Silicon, assegura't que Docker Desktop utilitzi Rosetta 2 o que les imatges tinguin suport natiu per a ARM64.

---

## Configuració inicial (Docker)

La forma més ràpida de posar el projecte en marxa és amb Docker Compose, que aixeca tant el backend com el frontend (servit per Nginx) en dos contenidors.

### Pas 1: Clonar el repositori

```bash
git clone https://github.com/andreums/railboard.git
cd railboard
```

### Pas 2: Configurar variables d'entorn

```bash
cp .env.docker .env
```

Edita el fitxer `.env` i canvia com a mínim:

```env
ADMIN_PASSWORD=<una-contrasenya-segura>
CORS_ORIGIN=http://localhost
HOST_PORT=80
```

> **IMPORTANT:** La contrasenya per defecte és `railboard`. **No la deixis** en producció o en xarxes públiques.

### Pas 3: Engegar els contenidors

```bash
docker compose up --build
```

El primer build pot trigar 2-3 minuts (instal·lació de dependències npm + compilació).

### Pas 4: Accedir a l'aplicació

| URL | Què hi trobaràs |
|-----|-----------------|
| http://localhost | Panell públic de sortides/arribades |
| http://localhost/admin | Panell d'administració (usuari: `admin`, contrasenya: la del `.env`) |

### Pas 5: Carregar dades de demostració

```bash
docker compose exec backend node src/seed.js
```

Això crearà operadors, tipus de tren, places i trens ficticis d'estil Renfe.

---

## Execució en desenvolupament sense Docker

Per a desenvolupament actiu (hot reload, debug), es recomana executar backend i frontend per separat.

### Backend

```bash
cd backend
npm install
npm run dev
```

El backend arrenca a http://localhost:4000 amb `node --watch` (recàrrega automàtica en canviar fitxers).

> **Problema conegut:** `node --watch` pot causar `EMFILE: too many open files`. Si passa, usa `node src/index.js` sense watch i recarrega manualment.

### Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173
```

Per defecte, el frontend espera l'API a `http://localhost:4000`. Si vols canviar-ho, crea `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
```

### URLs en mode desenvolupament

| URL | Què hi trobaràs |
|-----|-----------------|
| http://localhost:5173 | Panell públic (dev mode) |
| http://localhost:5173/admin | Admin (dev mode) |
| http://localhost:4000/health | Health check del backend |
| http://localhost:4000/api/stations/1/board | API de dades del panell |
| ws://localhost:4000/ws | WebSocket per a actualitzacions en temps real |

---

## Seed de dades de demostració

Hi ha dues maneres de poblar la base de dades amb dades de prova:

### Via Docker

```bash
docker compose exec backend node src/seed.js
```

### Via backend directe

```bash
cd backend && npm run seed
```

### Què crea el seed?

- **6 operadors** (Renfe, Avlo, Iryo, Ouigo, SNCF, Euskotren)
- **Tipus de tren** (AVE, Avlo, Alvia, Intercity, Media Distancia, Cercanías, etc.)
- **Places** (ciutats espanyoles i franceses)
- **Trens de demostració** amb horaris, andanes, estats aleatoris
- **Estació per defecte** amb configuració de display

### Via Admin UI

Des del panell d'administració, pots fer clic a "Carregar trens ficticis" des del tab de tren.

> **ATENCIÓ:** `seedTrains()` esborra TOTES les dades existents abans de crear-ne de noves.

---

## Testing

El projecte usa [Vitest](https://vitest.dev/) com a test runner tant al backend com al frontend.

### Backend (72 tests)

```bash
cd backend && npm test
# o via Docker:
docker compose exec backend npm test
```

| Suite | Fitxer | Tipus 
|-------|--------|-------|
| DB unit tests | `src/__tests__/db.unit.test.js` | Unitari (temp DB) |
| Helpers unit tests | `src/__tests__/helpers.unit.test.js` | Unitari |
| E2E API | `src/__tests__/e2e.test.js` | Integració |
| Routes integration | `src/__tests__/routes.integration.test.js` | Integració |

### Frontend (21 tests)

```bash
cd frontend && npm test
```

| Suite | Fitxer | Tipus |
|-------|--------|-------|
| StatusPill | `src/components/__tests__/StatusPill.test.tsx` | Unitari (8 tests) |
| Clock | `src/components/__tests__/Clock.test.tsx` | Unitari (3 tests) |
| i18n | `src/lib/__tests__/i18n.test.ts` | Unitari (10 tests) |

### Mode watch

```bash
npm run test:watch
# o
npx vitest
```

### Tests E2E de WebSocket

```bash
cd backend
node scripts/ws_e2e_test.mjs C-1
```

Aquest script obre un WebSocket, fa una petició POST per crear un tren des de la ruta `C-1`, i espera rebre el broadcast `{type: "update"}`.

---

## Estructura del projecte

```
railboard/
├── backend/                       # API Express + SQLite + WebSocket
│   ├── src/                       # Codi font
│   │   ├── index.js               # Entry point: Express, middleware, WS
│   │   ├── db.js                  # Capa de base de dades (esquema, CRUD, migracions)
│   │   ├── routes.js              # Admin API (totes les rutes, 1676 línies)
│   │   ├── railRoutesApi.js       # API pública (/api)
│   │   ├── ws.js                  # Servidor WebSocket (broadcast)
│   │   ├── migrations.js          # Executor de migracions SQL
│   │   ├── seed.js                # Dades de demostració
│   │   ├── services/
│   │   │   ├── routeService.js    # Càrrega i consulta de rutes JSON
│   │   │   └── routeService.ts    # ⚠️ Codi mort (duplicat TS, no s'usa)
│   │   ├── data/
│   │   │   └── railboard_routes.json  # 57 rutes espanyoles
│   │   └── __tests__/             # Tests del backend
│   ├── migrations/                # Migracions SQL seqüencials
│   ├── scripts/                   # Scripts auxiliars
│   └── data/                      # (runtime) data.db, uploads
│
├── frontend/                      # React SPA
│   ├── src/
│   │   ├── pages/                 # Cada pàgina de l'aplicació
│   │   │   ├── Display.tsx        # Panell públic (841 línies)
│   │   │   ├── Admin.tsx          # Admin panel (3128 línies) — component monolític
│   │   │   ├── Trains.tsx         # Gestió de trens (drag & drop)
│   │   │   ├── TrainSettings.tsx  # Operadors i tipus de tren
│   │   │   └── DisplayConfig.tsx  # Configuració de pantalles
│   │   ├── components/            # Components reutilitzables
│   │   │   ├── Clock.tsx          # Rellotge en viu
│   │   │   ├── StatusPill.tsx     # Badge d'estat
│   │   │   ├── SteamTrain.tsx     # Animació decorativa
│   │   │   └── admin/             # Subcomponents del panell admin
│   │   │       ├── GenerationPanel.tsx
│   │   │       ├── RoutesPanel.tsx
│   │   │       ├── StationPanel.tsx
│   │   │       ├── WSLogPanel.tsx
│   │   │       ├── PlacesPanel.tsx
│   │   │       ├── LocutionsPanel.tsx
│   │   │       ├── ServicesPanel.tsx
│   │   │       └── StylesPanel.tsx
│   │   ├── lib/                   # Utilitats
│   │   │   ├── api.ts             # Client REST + WebSocket
│   │   │   ├── i18n.ts            # Multiidioma (6 idiomes)
│   │   │   ├── tts.ts             # Text-to-Speech (Web Speech API)
│   │   │   ├── svgPlaceholder.ts  # Placeholder SVG per a logos
│   │   │   └── trainOptions.ts    # Opcions de generació de trens
│   │   └── types/                 # Tipus TypeScript compartits
│   ├── public/
│   │   ├── sw.js                  # Service Worker (PWA)
│   │   ├── manifest.json          # PWA manifest
│   │   └── fonts/                 # Tipografies locals
│   └── package.json
│
├── docker/                        # Configuració de producció
│   └── nginx.conf                 # Reverse proxy (backend + frontend)
│
├── docs/                          # Documentació del projecte
│   ├── index.md
│   └── api.md
│
├── docker-compose.yml             # Orquestració de contenidors
├── .env.docker                    # Plantilla de variables d'entorn
├── ROADMAP.md                     # Full de ruta tècnic
├── ONBOARDING.md                  # Aquest fitxer
├── ANALYSIS.md                    # Anàlisi tècnica completa
├── STATUS.md                      # Estat actual del projecte
├── CHANGELOG.md                   # Registre de canvis
└── README.md                      # Visió general del projecte
```

---

## Comandes útils

### Gestió de contenidors

```bash
docker compose up --build          # Construir i engegar
docker compose down                # Aturar i eliminar contenidors
docker compose restart backend     # Reiniciar només el backend
docker compose logs -f backend     # Veure logs del backend en temps real
docker compose logs -f frontend    # Veure logs del frontend
```

### Seed i dades

```bash
docker compose exec backend node src/seed.js        # Reseed de dades
docker compose exec backend node scripts/ws_e2e_test.mjs C-1  # Test E2E WS
```

### Depuració

```bash
docker compose exec backend sh     # Shell dins del contenidor backend
docker compose exec backend wget -qO- http://localhost:4000/health  # Health check
```

### Manteniment de base de dades

```bash
# Backup manual
docker compose exec backend sh -c "cp /app/data/data.db /app/data/backup-$(date +%Y%m%d-%H%M%S).db"

# Reset complet (elimina DB + uploads)
docker compose down && docker volume rm railboard_db-data railboard_uploads && docker compose up
```

### Desenvolupament

```bash
# Backend
cd backend && npm run dev          # Servidor amb hot reload
cd backend && npm test             # Executar tests
cd backend && node src/seed.js     # Seed manual

# Frontend
cd frontend && npm run dev         # Dev server (Vite)
cd frontend && npm test            # Executar tests
cd frontend && npm run build       # Build de producció
cd frontend && npm run preview     # Preview de la build
```

---

## Resolució de problemes comuns

| Problema | Causa probable | Solució |
|----------|---------------|---------|
| `Cannot find native binding` | `@rolldown/binding-darwin-arm64` no instal·lat | `npm install @rolldown/binding-darwin-arm64` (opcional, no necessari per a producció) |
| `EMFILE: too many open files` | `node --watch` en macOS | Usar `node src/index.js` sense watch, o augmentar `ulimit -n` |
| DB corrupta o inconsistent | Tallada durant escriptura, migració fallida | `docker compose down && docker volume rm railboard_db-data && docker compose up` (pèrdua de dades!) |
| No es veuen trens al panell | Base de dades buida | Executar `docker compose exec backend node src/seed.js` |
| Error de connexió WebSocket | Backend no accessible | Comprovar que `docker compose ps` mostra `railboard-backend` com `healthy` |
| Error 502 de Nginx | Backend no preparat quan Nginx intenta connectar | Esperar 10s i refrescar; comprovar `docker compose logs backend` |
| `Port 80 already in use` | Altre servei al port 80 | Canviar `HOST_PORT=8080` a `.env` i accedir a `http://localhost:8080` |
| Login admin no funciona | Contrasenya incorrecta | Comprovar `ADMIN_PASSWORD` al `.env`; si està buit, es fa servir `railboard` per defecte |
| `npm install` falla amb `gyp ERR!` | Falten build tools (macOS Xcode CLI, Linux build-essential) | Instal·lar Xcode CLI: `xcode-select --install`; o `apt install build-essential python3` a Linux |
| Error `VITE_API_URL` no definit | Falta `.env` al frontend | Crear `frontend/.env` amb `VITE_API_URL=http://localhost:4000` |
| El Service Worker no s'actualitza | Cache del navegador | Obrir DevTools → Application → Clear storage, o fer hard refresh (Cmd+Shift+R) |

---

## Convencions de codi

### Generals

- **JavaScript:** ESM (`import`/`export`), no CommonJS (`require`)
- **TypeScript:** Strict mode, definicions explícites
- **Format:** camelCase per a variables i funcions, snake_case per a columnes de base de dades
- **Indentació:** 2 espais (no tabs)

### Backend (JavaScript)

- Fitxers: `.js` amb ESM
- Lògica de negoci en serveis (en refactor), no en rutes
- Errors: retornar objectes `{ error: string, details?: any }` amb codis HTTP adequats
- DB: usar `better-sqlite3` amb `db.prepare()`, mai SQL concatenat

```javascript
// Bé
db.prepare("SELECT * FROM trains WHERE id = ?").get(id);

// Malament
db.prepare(`SELECT * FROM trains WHERE id = ${id}`).get();
```

### Frontend (TypeScript)

- **React:** Hooks funcionals, no classes
- **Componentes:** Un component per fitxer, export per defecte
- **Estils:** Tailwind CSS, evitar CSS inline o fitxers CSS separats
- **Icons:** `lucide-react`
- **Drag & Drop:** `@dnd-kit`
- **Routing:** `react-router-dom`

```tsx
// Bé
export default function StatusPill({ status }: { status: string }) {
  return <span className="px-2 py-1 rounded bg-blue-100">{status}</span>;
}
```

### Commits

Prefix obligatori segons el tipus de canvi:

| Prefix | Ús |
|--------|----|
| `feat:` | Nova funcionalitat |
| `fix:` | Correcció d'error |
| `refactor:` | Canvi de codi que no corregeix ni afegeix res |
| `test:` | Afegir o modificar tests |
| `docs:` | Documentació |
| `chore:` | Manteniment (dependències, CI, config) |
| `security:` | Millora de seguretat |

### Base de dades

- Les migracions van a `backend/migrations/` amb noms `XXX-descripcio.sql`
- Les noves columnes s'afegeixen amb `ALTER TABLE` dins de migracions
- No afegir `ALTER TABLE` inline a `db.js`

---

## Flux de treball

### Per a contribucions puntuals

1. Crea un fork o branch: `git checkout -b feat/nom-descriptiu`
2. Implementa el canvi amb tests si és possible
3. Executa els tests: `npm test` al backend i frontend
4. Fes commit amb prefix apropiat: `git commit -m "feat: descripció curta"`
5. Obre un pull request contra `main`

### Per a tasques del roadmap

Consulta [ROADMAP.md](./ROADMAP.md) per a l'estat actual i les iniciatives en curs. Cada fase té entregables verificables.

---

## Documentació relacionada

| Document | Contingut |
|----------|-----------|
| [README.md](./README.md) | Visió general del projecte, stack, instal·lació bàsica |
| [ROADMAP.md](./ROADMAP.md) | Full de ruta tècnic, fases, riscos, quick wins |
| [ANALYSIS.md](./ANALYSIS.md) | Anàlisi tècnica completa del repositori |
| [STATUS.md](./STATUS.md) | Estat actual del projecte (última sessió) |
| [CHANGELOG.md](./CHANGELOG.md) | Registre de canvis per sessió |
| [docs/index.md](./docs/index.md) | Documentació del projecte |
| [docs/api.md](./docs/api.md) | Documentació de l'API REST |

---

> **Consell final:** Si és el teu primer dia, engega amb Docker, carrega el seed i explora l'admin. Després, executa els tests per veure que tot funciona. Quan estiguis còmode, llegeix ANALYSIS.md per entendre les decisions arquitectòniques i el deute tècnic existent.
