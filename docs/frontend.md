# Frontend

**Stack:** React 18 + TypeScript + Vite 5 + Tailwind CSS 3

**Puerto dev:** `5173` | **Build:** `npm run build` → `/dist`

## Estructura

```
src/
├── main.tsx                  # Entry point, configuración de rutas
├── pages/
│   ├── Display.tsx           # Panel público de salidas/llegadas
│   ├── Admin.tsx             # Configuración de estación y lugares
│   ├── Trains.tsx            # CRUD de trenes con drag & drop
│   └── TrainSettings.tsx     # Operadores y tipos de tren
├── components/
│   ├── Clock.tsx             # Reloj (real o fake)
│   ├── SteamTrain.tsx        # Loading screen con tren animado SVG
│   └── StatusPill.tsx        # Badge de estado con colores
├── lib/
│   ├── api.ts                # Cliente REST + WebSocket + tipos
│   └── i18n.ts               # Internacionalización (6 idiomas)
└── styles/
    └── index.css             # Directivas Tailwind + animaciones
```

## Rutas

| Ruta              | Página        | Descripción                         |
| ----------------- | ------------- | ----------------------------------- |
| `/`               | Display       | Panel público a pantalla completa   |
| `/admin`          | Admin         | Configuración de estación y lugares |
| `/trains`         | Trains        | Gestión de trenes                   |
| `/train-settings` | TrainSettings | Operadores y tipos                  |
| `*`               | → `/`         | Catch-all redirect                  |

## Componentes

### Clock

Reloj configurable: tiempo real o hora fija administrable desde Admin.

### SteamTrain

Animación SVG de locomotora a vapor usada como pantalla de carga.

### StatusPill

Renderiza el estado de un tren con color codificado:

| Estado                          | Color              |
| ------------------------------- | ------------------ |
| Scheduled                       | gris               |
| On Time                         | verde              |
| Delayed                         | rojo               |
| Cancelled                       | rojo oscuro        |
| Departed/Arrived                | azul               |
| Boarding/Now Boarding/Last Call | naranja/ámbar/rojo |

## API Client (`src/lib/api.ts`)

Objeto `api` con métodos para todos los endpoints REST. Cada método retorna una Promise. Incluye:

- `connectWS(onUpdate)` — conecta al WebSocket con auto-reconexión
- `fileUrl(path)` — resuelve URLs de archivos subidos
- Tipos TypeScript: `Train`, `Operator`, `TrainType`, `Place`, `Config`

## i18n (`src/lib/i18n.ts`)

Idiomas disponibles: `es`, `ca`, `en`, `fr`, `eu`, `gl`

Uso: `t("departures", lang)` → devuelve el texto traducido (~70 claves por idioma).

## Configuración

`VITE_API_URL` en `.env` (default: `http://localhost:4000`).

## Scripts

| Comando           | Descripción         |
| ----------------- | ------------------- |
| `npm run dev`     | Dev server con HMR  |
| `npm run build`   | Build de producción |
| `npm run preview` | Preview del build   |
