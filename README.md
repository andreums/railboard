# Railboard

Aplicación web para paneles informativos de estaciones de tren, con display público en tiempo real (réplica del panel ADIF/Gravita) y panel de administración.

Pensada para eventos de modelismo ferroviario: simula un tablero de salidas estilo Renfe/ADIF con sincronización en tiempo real.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + SQLite (better-sqlite3) + WebSocket (ws)
- **Comunicación:** REST API (`/api` público, `/admin` administración) + WebSocket para actualizaciones en tiempo real

## Características

- **Display público PIS** a pantalla completa, réplica pixel-perfect del panel ADIF/Gravita
  - CSS Grid 55%/45%, columnas `12% 59% 12% 9% 8%`, virtualización de filas
  - Doble número y doble destino por tren, destino alternante cada 5s
  - Marquee en destino/paradas/observaciones, estado cancelado
  - Logo configurable (ADIF por defecto o personalizado)
- **Modos de pantalla** (`/s/:displayId`): platform, clock, train-info, board
- **Panel de administración** con 11+ tabs: Estación, Displays, Trenes, Rutas, Operadores, Tipos, Megafonía, Simulación, Automatización, Hardware, Dispositivos, Audio, Pantallas
- **Generación de trenes** desde 57 rutas ferroviarias reales (Renfe, Rodalies, Cercanías, Larga Distancia)
- **Sistema de megafonía**: composición multilingüe, cola, WebSocket push y reproducción TTS
- **Simulación**: reloj acelerado, secuencias de viaje
- **Automatización**: reglas basadas en tiempo/estado/retrasos
- **TTS server-side** (macOS `say` + Edge TTS) con fallback al navegador
- **Soporte multiidioma**: español, catalán, inglés, francés, vasco, gallego
- **Gestión de dispositivos** (ESP32/Arduino) vía WebSocket y hardware events

## Estructura

```
railboard/
├── frontend/               # Aplicación React SPA (código en frontend/src/)
├── backend/                # Servidor Express + SQLite (código en backend/src/)
├── docs/                   # Documentación — empezar por docs/index.md
├── docker-compose.yml      # Orquestación de producción (Nginx + backend)
└── docker/nginx.conf       # Proxy inverso de producción
```

## Páginas principales

| Ruta              | Componente      | Descripción                            |
| ----------------- | --------------- | -------------------------------------- |
| `/`               | `Display`       | Panel público PIS (ADIF)               |
| `/s/:displayId`   | `DisplayPage`   | Pantalla individual de un display      |
| `/admin`          | `Admin`         | Dashboard de administración            |
| `/operator`       | `Operator`      | Vista de operador                      |
| `/trains`         | `Trains`        | Gestión de trenes con drag & drop      |
| `/train-settings` | `TrainSettings` | Operadores y tipos de tren             |

## Instalación y ejecución (desarrollo)

Prerequisitos: `node` (>=18) y `npm`.

### Backend

```bash
cd backend
npm install
# (opcional) cargar datos de ejemplo
npm run seed
# modo desarrollo con recarga
npm run dev
```

Backend en `http://localhost:4000`. API administrativa en `/admin` (requiere login), API pública en `/api`, WebSocket en `ws://localhost:4000/ws`, salud en `/health`.

> **Autenticación admin:** el frontend pide usuario y contraseña en una pantalla de login
> (`frontend/src/lib/auth.ts` guarda las credenciales en `sessionStorage`). En **producción**
> `ADMIN_PASSWORD` es **obligatoria** (el backend no arranca sin ella); en desarrollo, si no se
> define, se genera una contraseña aleatoria por arranque que se muestra en la consola.
> El admin también puede configurarse con `ADMIN_USER` (por defecto `admin`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abrir la SPA en el navegador en la URL que indique Vite (por defecto `http://localhost:5173`).

## Build / Producción

- Frontend

```bash
cd frontend
npm run build
npm run preview    # para probar la build localmente
```

- Backend

```bash
cd backend
npm install --production
npm start
```

- Docker Compose (producción completa con Nginx)

```bash
docker compose up -d --build
```

## API y WebSocket

- Documentación completa de la API: [docs/api.md](docs/api.md)
- Arquitectura: [docs/architecture.md](docs/architecture.md)
- Implementación del servidor WebSocket: [backend/src/ws.js](backend/src/ws.js)
- Revisión de seguridad y hallazgos: [docs/SECURITY.md](docs/SECURITY.md)

## Archivos clave

- Punto de entrada backend: [backend/src/index.js](backend/src/index.js)
- API administrativa: [backend/src/routes.js](backend/src/routes.js)
- API pública: [backend/src/railRoutesApi.js](backend/src/railRoutesApi.js)
- Esquema y acceso a datos: [backend/src/db.js](backend/src/db.js) (+ migraciones en `backend/migrations/`)
- WebSocket: [backend/src/ws.js](backend/src/ws.js)
- Autenticación admin (backend): [backend/src/middleware/auth.js](backend/src/middleware/auth.js)
- Autenticación admin (frontend): [frontend/src/lib/auth.ts](frontend/src/lib/auth.ts)
- Seed de ejemplo: [backend/src/seed.js](backend/src/seed.js)
- SPA: [frontend/src/main.tsx](frontend/src/main.tsx)

## Tests

```bash
cd frontend && npm test      # vitest (componentes, i18n)
cd backend && npm test       # vitest (unit, integración, E2E)
```

Test E2E WebSocket: `node backend/scripts/ws_e2e_test.mjs C-1`

## Contribuir

- Crea un fork/branch, haz commits claros y abre un pull request.
- Añade tests o pasos de verificación si introduces cambios funcionales.

## Repositorio remoto

- Remote origin: https://github.com/andreums/railboard.git

## Licencia

- No indicada en el repositorio. Añade un fichero `LICENSE` si quieres especificarla.

---

Para más detalles y decisiones arquitectónicas, consulta la carpeta [docs/](docs/index.md).
