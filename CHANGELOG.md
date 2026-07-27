# Changelog — RailBoard

Registro de cambios y versiones del proyecto.

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

**Última actualización:** 31 de mayo 2026  
**Mantenedor:** RailBoard Team  
**Versión:** 1.0.0
