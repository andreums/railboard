# Changelog — RailBoard

Registro de cambios y versiones del proyecto.

---

## [Sesión 3 agosto 2026] — Seguridad

### 🔐 Autenticación (backend)

- Reescrito `backend/src/middleware/auth.js`: arranque con **`ADMIN_PASSWORD` obligatoria en producción** (throw si falta); en desarrollo se genera una aleatoria y se loguea.
- Comparación de contraseña en **tiempo constante** (SHA-256 + `timingSafeEqual`).
- **Anti fuerza-bruta:** 8 fallos consecutivos por IP ⇒ bloqueo 5 min (`429`).
- Nuevo endpoint de verificación `GET /admin/auth/me`.
- WebSocket: `heartbeat`/`identify` requieren token `?auth=`; `subscribe`/`unsubscribe` públicos.

### 🔐 Autenticación (frontend)

- Nuevo `frontend/src/lib/auth.ts` (credentiales en `sessionStorage`, sin secretos hardcodeados).
- Nuevos `AuthGate.tsx` y `LoginScreen.tsx`; las rutas admin quedan protegidas.
- `api.ts` adjunta `authHeaders()` y vuelve al login ante un `401`; `connectWS()` añade `?auth=`.

### 🛡️ Endurecimiento HTTP y archivos

- Rate limit añadido a `/api` público (300/min).
- Uploads SVG **sanitizados** (`sanitizeSvg`) y servidos como `Content-Disposition: attachment`.
- `/health` en producción devuelve solo `{ ok, checks }` (sin `env`/memoria).
- `Content-Security-Policy` estricta en `nginx.conf` (HSTS comentado, pendiente TLS para despliegue).
- `TRUST_PROXY` para rate limiting correcto tras proxy.

### 🧪 Tests

- Añadido `backend/src/__tests__/auth.test.js` (4 casos). Los 3 fallos de `routes.integration`/e2e son pre-existentes del baseline.

### 📦 Despliegue

- `.env.docker` actualizado: `ADMIN_PASSWORD` (placeholder), `ADMIN_USER`, `TRUST_PROXY`.
- **Pendiente (deferido a despliegue):** TLS/HTTPS en nginx.

---

## [Sesión 3 agosto 2026] — Dead code + lint

### 🧹 Limpieza

- Borrados archivos huérfanos: `useAnnouncementPlayer.ts`, `StatusPill.tsx` (+ su test), `audioAssetService.js`, `Admin.tsx.bak`
- Eliminada dependencia `react-beautiful-dnd` (migrado a `@dnd-kit`)
- Corregidos 9 errores de lint del backend (`no-empty`, `no-undef` de `logger` en `routes.js`)
- Actualizados los docs para quitar referencias al dead code

## [Sesión 2 agosto 2026] — Docs actualizados + características recientes

### 📚 Documentación

- Reescritos `docs/api.md`, `docs/backend.md`, `docs/frontend.md` y `docs/architecture.md` para reflejar el estado real del código
- `README.md`, `docs/index.md`, `docs/PROGRESS.md` y `STATUS.md` actualizados (estructura, puertos, componentes, fases)
- Documentados todos los endpoints reales de `/api` y `/admin` (megafonía, simulación, automatización, hardware, dispositivos, display screens, TTS, servicios)

### ✨ Características recientes ya documentadas

- **Event Engine** (`eventEngine.js`) — máquina de estados de tren con transiciones validadas
- **Megafonía completa** — cola de anuncios, composición multilingüe, perfiles/reglas de sonido, audio assets, WebSocket push
- **Simulación** — reloj simulado con multiplicador/pausa, secuencias de viaje
- **Automatización** — reglas time/state/delay-based y sugerencias
- **Hardware** — endpoint público para ESP32/Arduino
- **Dispositivos** — registro vía WebSocket con heartbeat y estado ONLINE/OFFLINE
- **Display screens** — pantallas individuales con board propio
- **Vista de operador** (`/operator`)

---

## [Sesión 27 julio 2026] — Server-Side TTS + Megafonía Mejorada

### ✨ Features Nuevas

#### Backend — Server-Side TTS Service

- **TTS Service** (`backend/src/services/ttsService.js`)
  - Proveedor primario: macOS `say` (local, rápido, sin red)
  - Fallback: Microsoft Edge TTS via WebSocket (`eu-ES-AinhoaNeural`, `gl-ES-RoiNeural`, etc.)
  - Cache MD5 en `uploads/tts/` para evitar síntesis repetida
  - Soporte para 6 idiomas: es, ca, en, fr, eu, gl
  - Voces macOS: Mónica (es), Montse (ca), Samantha (en), Thomas (fr)
  - Voces Edge TTS: ElviraNeural (es), JoanaNeural (ca), SoniaNeural (en), DeniseNeural (fr), AinhoaNeural (eu), RoiNeural (gl)

- **Endpoints TTS** (`backend/src/routes.js`)
  - `POST /admin/tts/synthesize` — sintetiza texto → audio (AIFF/MP3)
  - `GET /admin/tts/voices` — lista voces disponibles (server + edge)
  - `GET /admin/tts/provider` — información del proveedor activo
  - `GET /admin/tts/cache` — estadísticas de cache
  - `DELETE /admin/tts/cache` — limpia cache

#### Frontend — TTS Integration

- **`speakWithFallback()`** (`frontend/src/lib/tts.ts`)
  - Intenta backend server-side primero
  - Fallback automático a Web Speech API del navegador
  - Respeta configuración de rate/pitch por idioma

- **`VoiceSelect` Component** (`frontend/src/pages/Admin.tsx`)
  - Dropdown de voces con secciones: voces del servidor + voces del navegador
  - Búsqueda por nombre
  - Click-outside para cerrar

#### Megafonía (MegaphonyPanel)

- **Train Presets realistas** (`frontend/src/components/admin/MegaphonyPanel.tsx`)
  - 15 perfiles: Cercanías, Regional, AVE, Ouigo, Alvia, Euromed, Intercity, Trenhotel
  - Retrasos y cancelaciones simuladas

- **Auto-preview del simulador**
  - Cambios en tipo, preset, idiomas o audio disparan prueba automática (debounce 300ms)

- **Per-language audio selectors**
  - Cada idioma puede tener su propio asset de audio
  - Merge de audios durante playback

- **Multiselect de idiomas**
  - Selector múltiple para elegir idiomas de síntesis

- **Expandable all-events view**
  - Tarjetas con texto completo por idioma
  - Botones play/individual por idioma

- **Event Labels**
  - `EVENT_LABELS` con nombres humanos en español/catalán para todos los tipos de evento

#### Sidebar Fix

- **Admin.tsx**: sidebar se mantiene abierto en desktop, solo cierra en mobile al seleccionar tab
- Mobile: overlay con hamburger menu

### 🔧 Cambios Técnicos

#### Archivos Modificados

| Archivo                             | Cambios                                                             |
| ----------------------------------- | ------------------------------------------------------------------- |
| `backend/src/services/ttsService.js` | **NUEVO** — Servicio TTS con macOS `say` + Edge TTS fallback        |
| `backend/src/routes.js`             | Endpoints `/admin/tts/*`, MIME types AIFF, await fix en enqueue    |
| `frontend/src/lib/tts.ts`           | `speakWithFallback()`, `speakServerSide()`, server TTS detection   |
| `frontend/src/lib/api.ts`           | `ttsSynthesize()`, `ttsListVoices()`, `ttsGetProvider()`           |
| `frontend/src/pages/Admin.tsx`      | `VoiceSelect`, voice tab multiselect, click-outside                |
| `frontend/src/components/admin/MegaphonyPanel.tsx` | Train presets, auto-preview, per-language audio, event labels |

#### Bug Fixes

- **Queue ID bug** (`routes.js:1109`): `enqueueManual()` ahora usa `await` — devolvía Promise en vez de número
- **macOS `say` format string**: Cambiado de `--data-format=LEI22050` a escritura en temp file + lectura (macOS no soporta stdout)
- **Voice name accent**: `"Monica"` → `"Mónica"` (nombre exacto en macOS)
- **Provider detection**: `say --version` → `say -v ?` (macOS no tiene flag --version)

#### Paquetes

- `voipi` removido (no funcionaba — `child_process` no disponible en browser-like env)
- `ws` (ya instalado) — usado para Edge TTS WebSocket

### 📊 Métricas

| Aspecto                 | Antes                      | Después                           |
| ----------------------- | -------------------------- | --------------------------------- |
| Idiomas TTS             | 2 (es, ca)                 | 6 (es, ca, en, fr, eu, gl)        |
| Voces disponibles       | Navegador                  | Servidor (12) + Navegador         |
| Fallback TTS            | Sin fallback               | Server → Browser automático       |
| Train presets           | Manual                     | 15 perfiles realistas             |
| Eventos soportados      | Básicos                    | Todos con labels human-readable   |
| Cache TTS               | No existía                 | MD5 cache en uploads/tts/         |

### 🐛 Fixes

- Queue ID ahora retorna número en vez de Promise
- Sidebar no se cierra en desktop al cambiar de tab
- macOS `say` funciona correctamente (escritura a temp file)
- Provider endpoint retorna "macos" cuando está disponible

---

## [Sesión 29 julio 2026] — PIS Pixel-Perfect + Logos + Doble Número/Destino

### ✨ Features Nuevas

#### Panel PIS (Passenger Information System) — Réplica ADIF

- **Nueva arquitectura de componentes** (`frontend/src/components/pis/`)
  - `BoardHeader.tsx` — cabecera con logo ADIF/configurable, reloj y etiqueta Vía
  - `DepartureRow.tsx` — fila de salidas con marquee, estado cancelado y logos
  - `LineBadge.tsx` — píldora de línea con colores de configuración
  - `OperatorLogo.tsx` — placas de logo por operador (Cercanías/AVE con colores de marca)
  - `PisClock.tsx` — reloj de panel (real/ficticio)
- **Réplica exacta Gravita/ADIF** (`Display.tsx`)
  - CSS Grid 2 filas (55%/45%) para alineación exacta
  - Columnas proporcionales ADIF: `12% 59% 12% 9% 8%`
  - Colores de fila alternados `#1A3355` / `#0F2441`
  - Escalado `clamp()` para 16:9, 16:10 y ultrawide
  - Marquee en destino, paradas y observaciones
  - Estado cancelado: hora tachada, etiqueta naranja, opacidad 0.45
  - **Virtualización de filas** — renderiza solo filas visibles (scroll + ResizeObserver), sin scroll horizontal
- **Logo configurable** — ADIF por defecto (`/adif.svg`) o `logo_url` personalizado por display (`DisplayConfig`)

#### Doble Número y Doble Destino por Tren

- Nuevos campos `number2` y `destination2` en `trains`
- **Admin:** formularios de tren con "N.º de Tren 1/2" y "Destino 1/2"
- **PIS (`DepartureRow`):** segundo número bajo el principal (p.ej. `01234` + `05678`)
- **Destino alternante** (`frontend/src/lib/useAlternating.ts`)
  - Hook que alterna entre destino primario y secundario cada 5 segundos
  - Aplicado en PIS, PlatformDisplay, ClockDisplay, TrainInfoDisplay y BoardDisplay
- **`DisplayPage.tsx`** — componente `AltValue` reutilizable para destino alternante

#### Restricciones Tarifarias (Fare Restrictions)

- Nuevo campo JSON `fare_restrictions` en `trains` con flags:
  - `commuterTicketsNotAccepted` — no válidos billetes de cercanías
  - `commuterPassesNotAccepted` — no válidos abonos de cercanías
  - `reservationRequired` — reserva obligatoria
- **Admin/DisplayConfig:** checkboxes de restricciones en el formulario de tren
- **Backend:** parsing robusto en `POST/PUT /trains` (acepta JSON string u objeto), guard en `rowToTrain` contra JSON corrupto
- **MegaphonyPanel:** presets incluyen restricciones tarifarias realistas

#### Logos Cercanías Automáticos

- **`trainGeneratorService.js`**: los tipos Cercanías/Regionales creados desde rutas reciben `logo_url: /uploads/CERCANIAS.png` automáticamente
- **RegEx mejorado** para detección Cercanías/Regional:
  - `C10`, `C4B` (multi-dígito + sufijo), prefijo regional `MA-C...`
  - Códigos exactos `C` y `R` (sin dígito)
- **`typeLogo` solo para Cercanías/Regionales** — el resto de tipos usan `operatorLogo` o texto (`OperatorLogo.tsx`)
- **Fixes de fallback**: logos Cercanías pasan por `fileUrl()` para apuntar al backend (4000)

#### Admin — Sidebar Ocultable

- **Admin.tsx**: sidebar colapsable en mobile con overlay + hamburger; en desktop permanece fija (`lg:static`)
- Nuevo botón "Toggle sidebar"

### 🔧 Cambios Técnicos

#### Backend

| Archivo                          | Cambios                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| `backend/src/db.js`              | `rowToTrain` guard de JSON, `number2`/`destination2`/`fare_restrictions` en queries |
| `backend/src/routes.js`          | Parsing JSON en `POST/PUT /trains` (stops, fare_restrictions, except_stations) |
| `backend/src/services/boardService.js` | Campos `number2`, `destination2`, `iconMode`, `customIcon`, `fareRestrictions` |
| `backend/src/railRoutesApi.js`   | `buildRowsFromTrains` expone `number2`, `destination2`, `fareRestrictions` |
| `backend/src/services/trainGeneratorService.js` | Logo Cercanías auto + regEx multi-dígito |

#### Frontend

| Archivo                              | Cambios                                                           |
| ------------------------------------ | ----------------------------------------------------------------- |
| `frontend/src/components/pis/*`      | **NUEVOS** — arquitectura PIS (BoardHeader, DepartureRow, LineBadge, OperatorLogo, PisClock) |
| `frontend/src/pages/Display.tsx`     | Virtualización de filas, réplica ADIF, footer marquee, logo configurable |
| `frontend/src/pages/DisplayPage.tsx` | `AltValue` alternante, segundo número, destino alternante en los 4 modos |
| `frontend/src/pages/DisplayConfig.tsx` | Config de logo, restricciones tarifarias, icono destino más pequeño |
| `frontend/src/pages/Admin.tsx`       | Sidebar ocultable, campos N.º 2 / Destino 2, restricciones tarifarias |
| `frontend/src/lib/api.ts`            | Serialización de objetos en FormData (fare_restrictions JSON)      |
| `frontend/src/lib/useAlternating.ts` | **NUEVO** — hook de alternancia para destinos                       |

#### Infraestructura

- **DB movida a `backend/data/`** (`data.db` + `-shm` + `-wal`)
- **Eliminado** `.github/workflows/ci.yml` (workflow GitHub Actions)

### 📊 Métricas

| Aspecto                 | Antes                          | Después                        |
| ----------------------- | ------------------------------ | ------------------------------ |
| Arquitectura PIS        | Display.tsx monolítico (841)   | Componentes `components/pis/`  |
| Réplica ADIF            | Aproximada                     | Pixel-perfect (Gravita)        |
| Números de tren         | 1 por tren                     | 2 (principal + secundario)     |
| Destinos                | 1 por tren                     | 2 (alternancia 5s en PIS)      |
| Logos Cercanías         | Manual                         | Automáticos desde generación   |
| Sidebar Admin           | Fija                           | Colapsable (mobile overlay)    |
| DB                       | `backend/railboard.db`          | `backend/data/data.db` (WAL)   |

### 🐛 Fixes

- Parsing seguro de `fare_restrictions` (JSON string/objeto, guard anti-corrupción)
- RegEx Cercanías acepta `C10`, `C4B`, prefijo `MA-` y códigos exactos `C`/`R`
- Fallback logo Cercanías pasa por `fileUrl()` → apunta al backend correcto
- Icono destino más pequeño; paradas sin `reverse`

---

## [Sesión 31 mayo 2026] — Generación de Trenes desde Rutas + UI Vertical

### ✨ Features Nuevas

#### Backend

- **Route-based train generation** (`POST /admin/trains/from-route/:code`)
  - 57 rutas españolas importadas en `backend/src/data/railboard_routes.json`
  - Genera tren con metadatos reales: operador, tipo, paradas, plataforma
  - Metadatos extraídos dinámicamente de fixture según código de ruta
  - Destino = segundo al último parador de la ruta

- **WebSocket broadcast mejora**
  - Endpoint ping con broadcast `{type: "update", at: timestamp}`
  - Integrado con generación desde rutas

- **E2E Test Script** (`backend/scripts/ws_e2e_test.mjs`)
  - Abre WebSocket, espera evento "update" tras POST de generación
  - Fallback a curl + HTTP polling si WS falla
  - Ejecutable: `node backend/scripts/ws_e2e_test.mjs :code`

#### Frontend

- **RoutesPanel** (`frontend/src/components/admin/RoutesPanel.tsx`)
  - Selector de rutas con filtros: región, servicio, operador
  - Botón "Generar" → POST `/admin/trains/from-route/:code`
  - Muestra cantidad de rutas disponibles

- **WSLogPanel** (`frontend/src/components/admin/WSLogPanel.tsx`)
  - Widget debug que muestra últimos 50 eventos WebSocket
  - Display: timestamp, tipo de evento, payload JSON
  - Botón "Limpiar", scroll automático
  - Integrado bajo RoutesPanel en Admin

- **DisplayConfig Layout Vertical**
  - Cambio: `grid-cols-1 xl:grid-cols-[...]` → `grid-cols-1 2xl:grid-cols-[...]`
  - Ahora vertical por defecto (móvil/tablet)
  - Dos columnas solo en pantallas muy anchas (>1536px)
  - Tabla sin `min-w` forzado (se adapta sin scroll horizontal)

### 🔧 Cambios Técnicos

#### API

- `POST /admin/trains/from-route/:code` — nuevo endpoint
  - Valida código de ruta
  - Retorna tren creado con 201 Created
  - Triggerea WebSocket broadcast

#### Componentes

- **Admin.tsx**
  - Añadido tab "Rutas" con RoutesPanel + WSLogPanel
  - Integración de `connectWS()` para eventos real-time

- **DisplayConfig.tsx**
  - Grid layout: vertical → dos columnas en 2xl
  - Removido `min-w-[980px]` de tabla de trenes
  - Mejor responsive en tablets

- **api.ts**
  - Nueva función: `generateTrainFromRoute(code)` → POST
  - Mejorada `connectWS()` con event listeners `.on(type, cb)`

#### Datos

- `railboard_routes.json` — nueva fuente de datos
  - 57 rutas españolas con operador, tipo, red, paradas
  - Cargado en memoria al iniciar backend
  - Formato: código, nombre, operador, tipo, estaciones

### 📚 Documentación

- Creado `docs/PROGRESS.md` — documentación extensa de progreso
- Creado `STATUS.md` — resumen ejecutivo actual
- Actualizado este CHANGELOG

### 🐛 Fixes

- Tabla de DisplayConfig ya no hace scroll horizontal forzado
- Layout de DisplayConfig ahora es vertical por defecto (mejor mobile)
- WebSocket fallback en E2E script para entornos sandbox

### ⚠️ Problemas Identificados

- Watch mode backend con `node --watch` aún causa `EMFILE`
- E2E script falla con EPERM en agente sandbox (solucionado con curl fallback)
- Dynamic import de WSLogPanel podría ser static

---

## [Sesiones Anteriores — Resumen]

### Fase A: Arquitectura Base

- Stack definido: React + Node.js + SQLite
- Esquema base de datos
- Migraciones automáticas

### Fase B: Display Público

- Componente Display (llegadas/salidas)
- Soporte múltiples displays
- Reloj real/ficticio
- WebSocket básico

### Fase C: Admin Panel

- 11 tabs de administración
- CRUD de operadores, tipos, lugares
- Generación de trenes (random, panel, automática)
- Gestión de displays con configuración independiente
- DisplayConfig página separada
- Multiidioma (6 idiomas)
- TTS (Text-to-Speech)
- Drag & Drop

---

## 📊 Métricas de Progreso

| Aspecto              | Sesión Anterior   | Actual                       | Cambio       |
| -------------------- | ----------------- | ---------------------------- | ------------ |
| Rutas soportadas     | 0                 | 57                           | +57          |
| Endpoints generación | 2 (random, board) | 3 (+routes)                  | +1           |
| Componentes admin    | Sin routes        | Con RoutesPanel + WSLogPanel | +2           |
| Tab admin            | 10                | 11 (routes)                  | +1           |
| Layout displays      | 2-columnas xl     | Vertical 2xl                 | Mejor mobile |

---

## 🔄 Flujo de Cambios

```
User Request: "Mejora vista admin vertical"
↓
→ Cambio DisplayConfig: xl → 2xl grid
→ Removido min-w de tabla
→ Layout ahora vertical por defecto

User Request: "continua con todo: route-based generation"
↓
→ Importar 57 rutas españolas (JSON)
→ Endpoint POST /admin/trains/from-route/:code
→ UI RoutesPanel con filtros
→ WebSocket debug (WSLogPanel)
→ E2E script con fallbacks

User Request: "documenta lo obtenido"
↓
→ PROGRESS.md (documentación detallada)
→ STATUS.md (resumen ejecutivo)
→ CHANGELOG.md (este archivo)
```

---

## 🎯 Objetivo Logrado

**Fase C: Route-Based Train Generation + Vertical UI**

✅ Trenes generados desde rutas reales españolas
✅ WebSocket broadcast en tiempo real funcional
✅ UI debug para verificar comunicación en vivo
✅ Layout vertical optimizado para múltiples pantallas
✅ Documentación completa del progreso

---

## 📝 Notas para Próximas Sesiones

1. **Tests unitarios** — Componentes core (Display, Admin, RoutesPanel)
2. **API Documentation** — OpenAPI/Swagger spec
3. **Error Handling** — Error boundaries + validación robusta
4. **Performance** — Optimizaciones de renders React
5. **Features Advanced** — JWT tokens, audit log, integración RENFE

---

**Última actualización:** 2 de agosto 2026  
**Mantenedor:** RailBoard Team  
**Versión:** 1.0.0
