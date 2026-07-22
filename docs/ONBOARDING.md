# Guía de incorporación — RailBoard

> **Idioma:** Español (el proyecto usa principalmente castellano e inglés en los códigos fuente)
> **Última actualización:** 2026-07-17
> **Versión del proyecto:** 1.0.0

---

## Índice

- [Requisitos del sistema](#requisitos-del-sistema)
- [Configuración inicial (Docker)](#configuración-inicial-docker)
- [Ejecución en desarrollo sin Docker](#ejecución-en-desarrollo-sin-docker)
- [Seed de datos de demostración](#seed-de-datos-de-demostración)
- [Testing](#testing)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Comandos útiles](#comandos-útiles)
- [Resolución de problemas comunes](#resolución-de-problemas-comunes)
- [Convenciones de código](#convenciones-de-código)
- [Flujo de trabajo](#flujo-de-trabajo)
- [Documentación relacionada](#documentación-relacionada)

---

## Requisitos del sistema

| Herramienta        | Versión mínima | Para                                 |
| ------------------ | -------------- | ------------------------------------ |
| **Docker**         | 24+            | Ejecución en producción y desarrollo |
| **Docker Compose** | v2.24+         | Orquestación de contenedores         |
| **Git**            | 2.40+          | Control de versiones                 |
| **Node.js**        | 20 LTS (>=18)  | Desarrollo local sin Docker          |
| **npm**            | 10+            | Gestión de dependencias              |

> **Nota:** Si usas macOS con Apple Silicon, asegúrate de que Docker Desktop utilice Rosetta 2 o que las imágenes tengan soporte nativo para ARM64.

---

## Configuración inicial (Docker)

La forma más rápida de poner el proyecto en marcha es con Docker Compose, que levanta tanto el backend como el frontend (servido por Nginx) en dos contenedores.

### Paso 1: Clonar el repositorio

```bash
git clone https://github.com/andreums/railboard.git
cd railboard
```

### Paso 2: Configurar variables de entorno

```bash
cp .env.docker .env
```

Edita el archivo `.env` y cambia como mínimo:

```env
ADMIN_PASSWORD=<una-contraseña-segura>
CORS_ORIGIN=http://localhost
HOST_PORT=80
```

> **IMPORTANTE:** La contraseña por defecto es `railboard`. **No la dejes** en producción o en redes públicas.

### Paso 3: Iniciar los contenedores

```bash
docker compose up --build
```

El primer build puede tardar 2-3 minutos (instalación de dependencias npm + compilación).

### Paso 4: Acceder a la aplicación

| URL                    | Qué encontrarás                                                       |
| ---------------------- | --------------------------------------------------------------------- |
| http://localhost       | Panel público de salidas/llegadas                                     |
| http://localhost/admin | Panel de administración (usuario: `admin`, contraseña: la del `.env`) |

### Paso 5: Cargar datos de demostración

```bash
docker compose exec backend node src/seed.js
```

Esto creará operadores, tipos de tren, lugares y trenes ficticios de estilo Renfe.

---

## Ejecución en desarrollo sin Docker

Para desarrollo activo (hot reload, debug), se recomienda ejecutar backend y frontend por separado.

### Backend

```bash
cd backend
npm install
npm run dev
```

El backend arranca en http://localhost:4000 con `node --watch` (recarga automática al cambiar archivos).

> **Problema conocido:** `node --watch` puede causar `EMFILE: too many open files`. Si ocurre, usa `node src/index.js` sin watch y recarga manualmente.

### Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173
```

Por defecto, el frontend espera la API en `http://localhost:4000`. Si quieres cambiarlo, crea `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
```

### URLs en modo desarrollo

| URL                                        | Qué encontrarás                               |
| ------------------------------------------ | --------------------------------------------- |
| http://localhost:5173                      | Panel público (dev mode)                      |
| http://localhost:5173/admin                | Admin (dev mode)                              |
| http://localhost:4000/health               | Health check del backend                      |
| http://localhost:4000/api/stations/1/board | API de datos del panel                        |
| ws://localhost:4000/ws                     | WebSocket para actualizaciones en tiempo real |

---

## Seed de datos de demostración

Hay dos maneras de poblar la base de datos con datos de prueba:

### Via Docker

```bash
docker compose exec backend node src/seed.js
```

### Via backend directo

```bash
cd backend && npm run seed
```

### Qué crea el seed?

- **6 operadores** (Renfe, Avlo, Iryo, Ouigo, SNCF, Euskotren)
- **Tipos de tren** (AVE, Avlo, Alvia, Intercity, Media Distancia, Cercanías, etc.)
- **Lugares** (ciudades españolas y francesas)
- **Trenes de demostración** con horarios, andenes, estados aleatorios
- **Estación por defecto** con configuración de display

### Via Admin UI

Desde el panel de administración, puedes hacer clic en "Cargar trenes ficticios" desde el tab de tren.

> **ATENCIÓN:** `seedTrains()` borra TODOS los datos existentes antes de crear nuevos.

---

## Testing

El proyecto usa [Vitest](https://vitest.dev/) como test runner tanto en backend como en frontend.

### Backend (72 tests)

```bash
cd backend && npm test
# o via Docker:
docker compose exec backend npm test
```

| Suite              | Archivo                                    | Tipo               |
| ------------------ | ------------------------------------------ | ------------------ |
| DB unit tests      | `src/__tests__/db.unit.test.js`            | Unitario (temp DB) |
| Helpers unit tests | `src/__tests__/helpers.unit.test.js`       | Unitario           |
| E2E API            | `src/__tests__/e2e.test.js`                | Integración        |
| Routes integration | `src/__tests__/routes.integration.test.js` | Integración        |

### Frontend (21 tests)

```bash
cd frontend && npm test
```

| Suite      | Archivo                                        | Tipo                |
| ---------- | ---------------------------------------------- | ------------------- |
| StatusPill | `src/components/__tests__/StatusPill.test.tsx` | Unitario (8 tests)  |
| Clock      | `src/components/__tests__/Clock.test.tsx`      | Unitario (3 tests)  |
| i18n       | `src/lib/__tests__/i18n.test.ts`               | Unitario (10 tests) |

### Modo watch

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

Este script abre un WebSocket, hace una petición POST para crear un tren desde la ruta `C-1`, y espera recibir el broadcast `{type: "update"}`.

---

## Estructura del proyecto

```
railboard/
├── backend/                       # API Express + SQLite + WebSocket
│   ├── src/                       # Código fuente
│   │   ├── index.js               # Entry point: Express, middleware, WS
│   │   ├── db.js                  # Capa de base de datos (esquema, CRUD, migraciones)
│   │   ├── routes.js              # Admin API (todas las rutas, 1676 líneas)
│   │   ├── railRoutesApi.js       # API pública (/api)
│   │   ├── ws.js                  # Servidor WebSocket (broadcast)
│   │   ├── migrations.js          # Ejecutor de migraciones SQL
│   │   ├── seed.js                # Datos de demostración
│   │   ├── services/
│   │   │   ├── routeService.js    # Carga y consulta de rutas JSON
│   │   │   └── routeService.ts    # ⚠️ Código muerto (duplicado TS, no se usa)
│   │   ├── data/
│   │   │   └── railboard_routes.json  # 57 rutas españolas
│   │   └── __tests__/             # Tests del backend
│   ├── migrations/                # Migraciones SQL secuenciales
│   ├── scripts/                   # Scripts auxiliares
│   └── data/                      # (runtime) data.db, uploads
│
├── frontend/                      # React SPA
│   ├── src/
│   │   ├── pages/                 # Cada página de la aplicación
│   │   │   ├── Display.tsx        # Panel público (841 líneas)
│   │   │   ├── Admin.tsx          # Admin panel (3128 líneas) — componente monolítico
│   │   │   ├── Trains.tsx         # Gestión de trenes (drag & drop)
│   │   │   ├── TrainSettings.tsx  # Operadores y tipos de tren
│   │   │   └── DisplayConfig.tsx  # Configuración de pantallas
│   │   ├── components/            # Componentes reutilizables
│   │   │   ├── Clock.tsx          # Reloj en vivo
│   │   │   ├── StatusPill.tsx     # Badge de estado
│   │   │   ├── SteamTrain.tsx     # Animación decorativa
│   │   │   └── admin/             # Subcomponentes del panel admin
│   │   │       ├── GenerationPanel.tsx
│   │   │       ├── RoutesPanel.tsx
│   │   │       ├── StationPanel.tsx
│   │   │       ├── WSLogPanel.tsx
│   │   │       ├── PlacesPanel.tsx
│   │   │       ├── LocutionsPanel.tsx
│   │   │       ├── ServicesPanel.tsx
│   │   │       └── StylesPanel.tsx
│   │   ├── lib/                   # Utilidades
│   │   │   ├── api.ts             # Cliente REST + WebSocket
│   │   │   ├── i18n.ts            # Multiidioma (6 idiomas)
│   │   │   ├── tts.ts             # Text-to-Speech (Web Speech API)
│   │   │   ├── svgPlaceholder.ts  # Placeholder SVG para logos
│   │   │   └── trainOptions.ts    # Opciones de generación de trenes
│   │   └── types/                 # Tipos TypeScript compartidos
│   ├── public/
│   │   ├── sw.js                  # Service Worker (PWA)
│   │   ├── manifest.json          # PWA manifest
│   │   └── fonts/                 # Tipografías locales
│   └── package.json
│
├── docker/                        # Configuración de producción
│   └── nginx.conf                 # Reverse proxy (backend + frontend)
│
├── docs/                          # Documentación del proyecto
│   ├── index.md
│   └── api.md
│
├── docker-compose.yml             # Orquestación de contenedores
├── .env.docker                    # Plantilla de variables de entorno
├── ROADMAP.md                     # Hoja de ruta técnica
├── ONBOARDING.md                  # Este archivo
├── ANALYSIS.md                    # Análisis técnica completa
├── STATUS.md                      # Estado actual del proyecto
├── CHANGELOG.md                   # Registro de cambios
└── README.md                      # Visión general del proyecto
```

---

## Comandos útiles

### Gestión de contenedores

```bash
docker compose up --build          # Construir e iniciar
docker compose down                # Detener y eliminar contenedores
docker compose restart backend     # Reiniciar solo el backend
docker compose logs -f backend     # Ver logs del backend en tiempo real
docker compose logs -f frontend    # Ver logs del frontend
```

### Seed y datos

```bash
docker compose exec backend node src/seed.js        # Reseed de datos
docker compose exec backend node scripts/ws_e2e_test.mjs C-1  # Test E2E WS
```

### Depuración

```bash
docker compose exec backend sh     # Shell dentro del contenedor backend
docker compose exec backend wget -qO- http://localhost:4000/health  # Health check
```

### Mantenimiento de base de datos

```bash
# Backup manual
docker compose exec backend sh -c "cp /app/data/data.db /app/data/backup-$(date +%Y%m%d-%H%M%S).db"

# Reset completo (elimina DB + uploads)
docker compose down && docker volume rm railboard_db-data railboard_uploads && docker compose up
```

### Desarrollo

```bash
# Backend
cd backend && npm run dev          # Servidor con hot reload
cd backend && npm test             # Ejecutar tests
cd backend && node src/seed.js     # Seed manual

# Frontend
cd frontend && npm run dev         # Dev server (Vite)
cd frontend && npm test            # Ejecutar tests
cd frontend && npm run build       # Build de producción
cd frontend && npm run preview     # Preview de la build
```

---

## Resolución de problemas comunes

| Problema                           | Causa probable                                              | Solución                                                                                             |
| ---------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Cannot find native binding`       | `@rolldown/binding-darwin-arm64` no instalado               | `npm install @rolldown/binding-darwin-arm64` (opcional, no necesario para producción)                |
| `EMFILE: too many open files`      | `node --watch` en macOS                                     | Usar `node src/index.js` sin watch, o aumentar `ulimit -n`                                           |
| DB corrupta o inconsistente        | Corte durante escritura, migración fallida                  | `docker compose down && docker volume rm railboard_db-data && docker compose up` (pérdida de datos!) |
| No se ven trenes en el panel       | Base de datos vacía                                         | Ejecutar `docker compose exec backend node src/seed.js`                                              |
| Error de conexión WebSocket        | Backend no accesible                                        | Comprobar que `docker compose ps` muestra `railboard-backend` como `healthy`                         |
| Error 502 de Nginx                 | Backend no preparado cuando Nginx intenta conectar          | Esperar 10s y refrescar; comprobar `docker compose logs backend`                                     |
| `Port 80 already in use`           | Otro servicio en el puerto 80                               | Cambiar `HOST_PORT=8080` en `.env` y acceder a `http://localhost:8080`                               |
| Login admin no funciona            | Contraseña incorrecta                                       | Comprobar `ADMIN_PASSWORD` en el `.env`; si está vacío, se usa `railboard` por defecto               |
| `npm install` falla con `gyp ERR!` | Faltan build tools (macOS Xcode CLI, Linux build-essential) | Instalar Xcode CLI: `xcode-select --install`; o `apt install build-essential python3` en Linux       |
| Error `VITE_API_URL` no definido   | Falta `.env` en el frontend                                 | Crear `frontend/.env` con `VITE_API_URL=http://localhost:4000`                                       |
| El Service Worker no se actualiza  | Caché del navegador                                         | Abrir DevTools → Application → Clear storage, o hacer hard refresh (Cmd+Shift+R)                     |

---

## Convenciones de código

### Generales

- **JavaScript:** ESM (`import`/`export`), no CommonJS (`require`)
- **TypeScript:** Strict mode, definiciones explícitas
- **Formato:** camelCase para variables y funciones, snake_case para columnas de base de datos
- **Indentación:** 2 espacios (no tabs)

### Backend (JavaScript)

- Archivos: `.js` con ESM
- Lógica de negocio en servicios (en refactor), no en rutas
- Errores: retornar objetos `{ error: string, details?: any }` con códigos HTTP adecuados
- DB: usar `better-sqlite3` con `db.prepare()`, nunca SQL concatenado

```javascript
// Bien
db.prepare("SELECT * FROM trains WHERE id = ?").get(id);

// Mal
db.prepare(`SELECT * FROM trains WHERE id = ${id}`).get();
```

### Frontend (TypeScript)

- **React:** Hooks funcionales, no clases
- **Componentes:** Un componente por archivo, export por defecto
- **Estilos:** Tailwind CSS, evitar CSS inline o archivos CSS separados
- **Iconos:** `lucide-react`
- **Drag & Drop:** `@dnd-kit`
- **Routing:** `react-router-dom`

```tsx
// Bien
export default function StatusPill({ status }: { status: string }) {
  return <span className="px-2 py-1 rounded bg-blue-100">{status}</span>;
}
```

### Commits

Prefijo obligatorio según el tipo de cambio:

| Prefijo     | Uso                                           |
| ----------- | --------------------------------------------- |
| `feat:`     | Nueva funcionalidad                           |
| `fix:`      | Corrección de error                           |
| `refactor:` | Cambio de código que no corrige ni añade nada |
| `test:`     | Añadir o modificar tests                      |
| `docs:`     | Documentación                                 |
| `chore:`    | Mantenimiento (dependencias, CI, config)      |
| `security:` | Mejora de seguridad                           |

### Base de datos

- Las migraciones van en `backend/migrations/` con nombres `XXX-descripcio.sql`
- Las nuevas columnas se añaden con `ALTER TABLE` dentro de migraciones
- No añadir `ALTER TABLE` inline en `db.js`

---

## Flujo de trabajo

### Para contribuciones puntuales

1. Crea un fork o branch: `git checkout -b feat/nombre-descriptivo`
2. Implementa el cambio con tests si es posible
3. Ejecuta los tests: `npm test` en backend y frontend
4. Haz commit con prefijo apropiado: `git commit -m "feat: descripción corta"`
5. Abre un pull request contra `main`

### Para tareas del roadmap

Consulta [ROADMAP.md](./ROADMAP.md) para el estado actual y las iniciativas en curso. Cada fase tiene entregables verificables.

---

## Documentación relacionada

| Documento                        | Contenido                                              |
| -------------------------------- | ------------------------------------------------------ |
| [README.md](./README.md)         | Visión general del proyecto, stack, instalación básica |
| [ROADMAP.md](./ROADMAP.md)       | Hoja de ruta técnica, fases, riesgos, quick wins       |
| [ANALYSIS.md](./ANALYSIS.md)     | Análisis técnica completa del repositorio              |
| [STATUS.md](./STATUS.md)         | Estado actual del proyecto (última sesión)             |
| [CHANGELOG.md](./CHANGELOG.md)   | Registro de cambios por sesión                         |
| [docs/index.md](./docs/index.md) | Documentación del proyecto                             |
| [docs/api.md](./docs/api.md)     | Documentación de la API REST                           |

---

> **Consejo final:** Si es tu primer día, inicia con Docker, carga el seed y explora el admin. Después, ejecuta los tests para ver que todo funciona. Cuando estés cómodo, lee ANALYSIS.md para entender las decisiones arquitectónicas y la deuda técnica existente.
