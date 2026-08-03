# Frontend

**Stack:** React 18 + TypeScript + Vite 5 + Tailwind CSS 3

**Puerto dev:** `5173` | **Build:** `npm run build` → `/dist`

## Estructura

```
src/
├── main.tsx                  # Entry point, configuración de rutas + service worker
├── pages/
│   ├── Display.tsx           # Panel público PIS (réplica ADIF/Gravita)
│   ├── DisplayPage.tsx       # Displays por screen (platform, clock, train-info, board)
│   ├── DisplayConfig.tsx     # Configuración de display individual
│   ├── Admin.tsx             # Dashboard de administración (sidebar colapsable)
│   ├── Operator.tsx          # Vista operador
│   ├── Trains.tsx            # CRUD de trenes con drag & drop
│   └── TrainSettings.tsx     # Operadores y tipos de tren
├── components/
│   ├── pis/                  # Componentes PIS (réplica ADIF)
│   │   ├── BoardHeader.tsx   # Cabecera: logo, reloj, etiqueta Vía
│   │   ├── DepartureRow.tsx  # Fila de salidas (marquee, doble número/destino)
│   │   ├── LineBadge.tsx     # Píldora de línea con colores
│   │   ├── OperatorLogo.tsx  # Placas de logo por operador
│   │   └── PisClock.tsx      # Reloj de panel (real/ficticio)
│   ├── admin/                # Paneles del dashboard de admin
│   │   ├── GenerationPanel.tsx
│   │   ├── RoutesPanel.tsx
│   │   ├── ServicesPanel.tsx
│   │   ├── WSLogPanel.tsx
│   │   ├── MegaphonyPanel.tsx
│   │   ├── SimulationPanel.tsx
│   │   ├── AutomationPanel.tsx
│   │   ├── HardwarePanel.tsx
│   │   ├── DevicesPanel.tsx
│   │   ├── AudioNodesPanel.tsx
│   │   └── DisplayScreensPanel.tsx
│   ├── Clock.tsx             # Reloj (real o fake)
│   └── SteamTrain.tsx        # Loading screen con tren animado SVG
├── lib/
│   ├── api.ts                # Cliente REST + WebSocket + tipos
│   ├── i18n.ts               # Internacionalización (6 idiomas)
│   ├── tts.ts                # TTS con fallback (server → navegador)
│   ├── trainOptions.ts       # Opciones y presets de tren
│   ├── svgPlaceholder.ts     # Manejo de errores de imagen/SVG
│   └── useAlternating.ts     # Hook de alternancia (destinos)
├── services/
│   └── routeApi.ts           # Cliente de rutas ferroviarias
├── types/
│   └── railRoute.ts          # Tipos TS de rutas
└── styles/
    └── index.css             # Directivas Tailwind + animaciones
```

## Rutas

| Ruta                      | Página              | Descripción                         |
| ------------------------- | ------------------- | ----------------------------------- |
| `/`                       | Display             | Panel público a pantalla completa   |
| `/display/:stationId`     | Display             | Panel PIS de una estación           |
| `/display/station/:stationId` | Display         | Alias de panel por estación         |
| `/s/:displayId`           | DisplayPage         | Pantalla individual de un display   |
| `/admin/displays`         | DisplayConfigPage   | Configuración de displays           |
| `/admin/displays/:stationId` | DisplayConfigPage | Config de un display específico     |
| `/admin`                  | Admin               | Dashboard de administración         |
| `/admin/:tab`             | Admin               | Dashboard con tab específico        |
| `/operator`               | Operator            | Vista de operador                   |
| `/trains`                 | Trains              | Gestión de trenes                   |
| `/train-settings`         | TrainSettings       | Operadores y tipos                  |
| `*`                       | → `/`               | Catch-all redirect                  |

## Componentes

### PIS Components (`components/pis/`)

Réplica pixel-perfect del panel ADIF/Gravita usado por `Display.tsx`:

- **BoardHeader** — cabecera con logo (ADIF o personalizado), reloj y etiqueta Vía
- **DepartureRow** — fila con marquee de destino/paradas, doble número/destino, estado cancelado (hora tachada, etiqueta naranja, opacidad)
- **LineBadge** — píldora de línea con colores de configuración
- **OperatorLogo** — placa de logo por operador (Cercanías/AVE con colores de marca; `typeLogo` solo Cercanías/Regionales, resto usa `operatorLogo` o texto)
- **PisClock** — reloj del panel (modo real/ficticio)

`Display.tsx` aplica CSS Grid de 2 filas (55%/45%) con columnas `12% 59% 12% 9% 8%`, colores alternados `#1A3355`/`#0F2441`, escalado `clamp()` y virtualización de filas.

### Clock

Reloj configurable: tiempo real o hora fija administrable desde Admin.

### SteamTrain

Animación SVG de locomotora a vapor usada como pantalla de carga.

## API Client (`src/lib/api.ts`)

Objeto `api` con métodos para todos los endpoints REST (montados en `/admin`). Cada método retorna una Promise. Incluye:

- `connectWS(onUpdate)` — conecta al WebSocket con auto-reconexión (1.5s) y listeners de eventos
- `fileUrl(path)` — resuelve URLs de archivos subidos contra el backend
- CRUD completo de trenes, operadores, tipos, lugares, estaciones, iconos
- Generación: `generateRandomTrain()`, `generateTrainFromRoute(code)`
- Multiestación: servicios y paradas (`listServices`, `markArrival`, `addStopDelay`…)
- Megafonía: `getAnnouncementConfig`, `testAnnouncement`, `triggerAnnouncementEvent`, audio assets, perfiles/reglas de sonido
- TTS: `ttsSynthesize()`, `ttsListVoices()`, `ttsGetProvider()`
- Simulación: reloj, eventos, secuencias
- Automatización, hardware, dispositivos, display screens
- Tipos TypeScript: `Train` (con `number2`, `destination2`, `fare_restrictions`, `icon_mode`, `custom_icon_url`), `Operator`, `TrainType`, `Place`, `Station`, `Config`, `Route`, `Service`, `ServiceStop`, `AudioAsset`, `DisplayScreen`, `Device`, etc.

## i18n (`src/lib/i18n.ts`)

Idiomas disponibles: `es`, `ca`, `en`, `fr`, `eu`, `gl`

Uso: `t("departures", lang)` → devuelve el texto traducido.

## TTS (`src/lib/tts.ts`)

`speakWithFallback()` intenta síntesis server-side primero (via `/admin/tts/synthesize`), con fallback a Web Speech API del navegador. Respeta configuración de rate/pitch por idioma.

## useAlternating (`src/lib/useAlternating.ts`)

Hook que alterna entre dos valores cada 5 segundos (usado para destinos primario/secundario en el panel).

## Configuración

`VITE_API_URL` en `.env` (default: `http://localhost:4000`).

## Scripts

| Comando           | Descripción         |
| ----------------- | ------------------- |
| `npm run dev`     | Dev server con HMR  |
| `npm run build`   | Build de producción |
| `npm run preview` | Preview del build   |
| `npm run lint`    | Lint (eslint)       |
| `npm test`        | Tests (vitest)      |
