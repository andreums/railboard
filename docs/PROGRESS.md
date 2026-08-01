# Progreso del Proyecto RailBoard

**Última actualización:** 29 de julio de 2026

---

## 📋 Resumen Ejecutivo

RailBoard es una aplicación web de paneles informativos para estaciones de tren con:

- **Display público PIS** en tiempo real, réplica pixel-perfect del panel ADIF/Gravita
- **Panel de administración** completo con control en vivo
- **Generación inteligente de trenes** desde rutas ferroviarias reales (57 rutas españolas)
- **WebSocket real-time** para actualizaciones instantáneas
- **Soporte multiidioma** (español, catalán, inglés, francés, vasco, gallego)

**Estado general:** ✅ **Fase de desarrollo avanzada** — Funcionalidades core completadas, refinamientos en UI/UX en progreso.

---

## 🎯 Fases Completadas

### Fase A: Arquitectura y Base de Datos ✅

- ✅ Stack definido: React 18 + TypeScript + Vite + Node.js + Express + SQLite
- ✅ Esquema de base de datos con migraciones automáticas
- ✅ Tablas core: `stations`, `trains`, `operators`, `train_types`, `places`, `configs`, `displays`
- ✅ API REST completamente documentada (ver [docs/api.md](api.md))

### Fase B: Display Público ✅

- ✅ Componente `Display` — renderiza paneles de llegadas/salidas en tiempo real
- ✅ Soporte para múltiples displays (1 ó N displays según modo)
- ✅ Reloj digital (real o ficticio) con simulación de tiempo
- ✅ WebSocket cliente funcional con event listeners
- ✅ Estado dinámico de trenes (Scheduled, Boarding, Departed, Delayed, Cancelled)
- ✅ Ancho responsive y optimizado para pantallas de estación

### Fase C: Panel de Administración (Actual) ✅

- ✅ Interfaz admin multiTab: Estación, Displays, Trenes, Operadores, Tipos, Estilos, Destinos
- ✅ **Generación de trenes:**
  - Generación aleatoria con operadores y destinos reales
  - Generación automática con intervalo configurable
  - Generación de "panel completo" (8 trenes escalonados)
- ✅ **Gestión de displays:**
  - Configuración independiente por estación
  - Colores y temas personalizables
  - Selección de idioma, modo reloj, pie de página
- ✅ **CRUD de datos:**
  - Operadores: crear, editar, eliminar con logo
  - Tipos de tren: crear, editar, eliminar
  - Lugares/Destinos: crear, eliminar
  - Trenes: editar, eliminar con vista detallada

### Fase C.1: Rutas Ferroviarias (Nuevo) ✅

- ✅ **57 rutas españolas importadas** desde `railboard_routes.json` (Renfe, Rodalies, Cercanías, Larga Distancia)
- ✅ **Endpoint POST `/admin/trains/from-route/:code`** — crea tren desde metadatos de ruta
  - Selecciona operador, tipo, plataforma y paradas según ruta
  - Asigna destino del segundo al último parador
  - Nombres reales de estaciones
- ✅ **UI `RoutesPanel`** — selecciona ruta, genera tren
- ✅ **WebSocket broadcast** — notifica cambios en tiempo real
- ✅ **E2E script `ws_e2e_test.mjs`** — verifica creación de tren + WS update con fallbacks HTTP

### Fase C.2: UI/UX de Admin ✅

- ✅ **Layout responsive** — tabs horizontales, contenido fluido
- ✅ **WSLogPanel** — widget de debug que muestra mensajes WebSocket en vivo
- ✅ **Notificaciones** — toast feedback (success/error/info, 3s timeout)
- ✅ **Validación de entrada** — campos requeridos, límites, mensajes de error claros

### Fase C.3: DisplayConfig (Página Independiente) ✅

- ✅ **Ruta `/admin/displays/:id`** — configura un display específico
- ✅ **Interfaz vertical por defecto** — configuración encima, trenes abajo
- ✅ **Dos columnas solo en pantallas muy anchas (2xl)** — optimizado para tablets/laptops
- ✅ **Tabla responsiva** — sin scroll horizontal forzado
- ✅ **Acciones por tren** — anunciar por TTS, eliminar

### Fase C.4: Server-Side TTS + Megafonía ✅

- ✅ **Servicio TTS server-side** — macOS `say` + Edge TTS WebSocket como fallback
- ✅ **6 idiomas**: español, catalán, inglés, francés, euskera, gallego
- ✅ **Cache MD5** — audio cacheado en `uploads/tts/` para evitar re-síntesis
- ✅ **Frontend `speakWithFallback()`** — intenta servidor primero, fallback a navegador
- ✅ **15 train presets realistas** — Cercanías, Regional, AVE, Ouigo, Alvia, etc.
- ✅ **Auto-preview del simulador** — cambios disparan prueba con debounce 300ms
- ✅ **Per-language audio selectors** — cada idioma con su asset de audio
- ✅ **Multiselect de idiomas** — selector múltiple para síntesis multilingüe
- ✅ **VoiceSelect component** — dropdown con voces servidor + navegador
- ✅ **Event Labels** — nombres humanos para todos los tipos de evento

### Fase C.5: PIS Pixel-Perfect (Réplica ADIF) ✅

- ✅ **Nueva arquitectura `components/pis/`** — `BoardHeader`, `DepartureRow`, `LineBadge`, `OperatorLogo`, `PisClock`
- ✅ **Réplica exacta Gravita/ADIF** en `Display.tsx`:
  - CSS Grid 2 filas (55%/45%), columnas `12% 59% 12% 9% 8%`
  - Colores de fila alternados `#1A3355` / `#0F2441`
  - Escalado `clamp()` para 16:9, 16:10 y ultrawide
  - Marquee en destino, paradas y observaciones
  - Cancelado: hora tachada, etiqueta naranja, opacidad 0.45
- ✅ **Virtualización de filas** — renderiza solo filas visibles (scroll + ResizeObserver)
- ✅ **Logo configurable** — ADIF por defecto (`/adif.svg`) o `logo_url` personalizado por display
- ✅ **Doble número y doble destino** por tren (`number2`, `destination2`)
- ✅ **Destino alternante** cada 5s (`lib/useAlternating.ts`, componente `AltValue`)
- ✅ **Restricciones tarifarias** (`fare_restrictions` JSON: billetes/abonos cercanías, reserva obligatoria)
- ✅ **Logos Cercanías automáticos** desde generación de rutas (regEx multi-dígito `C10`, `C4B`, `MA-`)
- ✅ **`typeLogo` solo Cercanías/Regionales** — resto de tipos usan `operatorLogo` o texto
- ✅ **Sidebar Admin colapsable** — overlay + hamburger en mobile, fija en desktop
- ✅ **DB movida a `backend/data/data.db`** (WAL), eliminado workflow GitHub Actions

---

## 🏗️ Arquitectura Técnica

### Frontend (React + TypeScript + Vite)

**Estructura:**

```
frontend/src/
├── components/
│   ├── Clock.tsx                    # Reloj digital (real/ficticio)
│   ├── StatusPill.tsx               # Indicador de estado del tren
│   ├── SteamTrain.tsx               # Animación SVG del tren
│   ├── pis/                         # Panel PIS (réplica ADIF)
│   │   ├── BoardHeader.tsx          # Cabecera con logo + reloj + Vía
│   │   ├── DepartureRow.tsx         # Fila de salidas (marquee, doble número/destino)
│   │   ├── LineBadge.tsx            # Píldora de línea con colores
│   │   ├── OperatorLogo.tsx         # Placas de logo por operador
│   │   └── PisClock.tsx             # Reloj de panel
│   ├── admin/
│   │   ├── GenerationPanel.tsx      # Acciones de generación rápida
│   │   ├── RoutesPanel.tsx          # Selector de rutas para generación
│   │   ├── ServicesPanel.tsx        # (Placeholder)
│   │   └── WSLogPanel.tsx           # Debug de mensajes WebSocket
│   └── ...
├── pages/
│   ├── Display.tsx                  # Panel público PIS (ADIF)
│   ├── DisplayPage.tsx              # Displays por screen (platform, clock, train-info, board)
│   ├── Admin.tsx                    # Dashboard principal
│   ├── Trains.tsx                   # Gestión drag & drop
│   ├── TrainSettings.tsx            # Operadores y tipos
│   └── DisplayConfig.tsx            # Config de display individual
├── lib/
│   ├── api.ts                       # API client con autenticación
│   ├── i18n.ts                      # Sistema multiidioma
│   ├── tts.ts                       # TTS con fallback (server → navegador)
│   └── useAlternating.ts            # Hook de alternancia (destinos)
└── styles/
    └── index.css                    # Tailwind + estilos custom
```

**API Client (`frontend/src/lib/api.ts`):**

- `connectWS()` — abre WebSocket, retorna `{close(), on(type, cb)}`
- Endpoints de CRUD para trenes, operadores, tipos, lugares
- Generación: `generateRandomTrain()`, `generateTrainFromRoute(code)`
- Configuración de displays

### Backend (Express + SQLite + WebSocket)

**Estructura:**

```
backend/
├── src/
│   ├── index.js                         # Servidor Express, start
│   ├── db.js                            # Esquema, migraciones, acceso
│   ├── routes.js                        # Rutas REST + WebSocket ping
│   ├── ws.js                            # Servidor WebSocket, broadcast
│   ├── railRoutesApi.js                 # Build de filas de panel desde trenes
│   ├── services/
│   │   ├── ttsService.js                # TTS server-side (macOS say + Edge TTS)
│   │   ├── boardService.js              # Compose de station board (modo dep/arr)
│   │   ├── trainGeneratorService.js     # Generación de trenes + logos Cercanías auto
│   │   └── ...
│   ├── seed.js                          # Datos iniciales
│   ├── data/
│   │   └── railboard_routes.json        # 57 rutas españolas
│   └── scripts/
│       └── ws_e2e_test.mjs              # Test E2E con WS + fallback curl
├── data/
│   └── data.db                          # SQLite (WAL) — antes backend/railboard.db
├── uploads/
│   ├── tts/                             # Cache de audio TTS (MD5 hash)
│   └── ...                              # Imágenes subidas (logos)
└── package.json
```

**Migraciones Automáticas:**

- Crea tablas de cero en primer run
- `stations`, `trains`, `operators`, `train_types`, `places`, `configs`, `displays`
- Datos seed opcionales con `npm run seed`

**Rutas Principales:**

- `GET /admin/trains` — lista trenes (auth requerida: `admin:railboard`)
- `POST /admin/trains` — crea tren
- `POST /admin/trains/from-route/:code` — crea desde ruta (NUEVO)
- `GET /displays` — lista displays
- `POST /displays/:id/config` — actualiza config de display
- **WebSocket `/ws`** — broadcast en tiempo real

### WebSocket

**Protocolo:**

- `{type: "hello"}` — enviado al conectar cliente
- `{type: "update", at: timestamp}` — broadcast al cambiar trenes
- Cliente escucha: `ws.on("update", handler)`, `ws.on("hello", handler)`

---

## 🔧 Cambios Técnicos Recientes (Última Sesión)

### 1. Arquitectura PIS (Réplica ADIF)

- **Ubicación:** `frontend/src/components/pis/`
  - `BoardHeader.tsx` — cabecera (logo, reloj, etiqueta Vía)
  - `DepartureRow.tsx` — fila de salidas con marquee, doble número/destino
  - `LineBadge.tsx`, `OperatorLogo.tsx`, `PisClock.tsx`
- **`Display.tsx` refactorizado** — CSS Grid 2 filas (55%/45%), columnas `12% 59% 12% 9% 8%`, virtualización de filas
- **Logo configurable** — `config.logo_url` (ADIF por defecto)

### 2. Doble Número / Destino + Alternancia

- Campos `number2`, `destination2` en `trains` (Admin + PIS + DisplayPage)
- Hook `useAlternating()` alterna destino cada 5s
- Componente `AltValue` en `DisplayPage.tsx`

### 3. Restricciones Tarifarias

- Campo JSON `fare_restrictions` (`commuterTicketsNotAccepted`, `commuterPassesNotAccepted`, `reservationRequired`)
- Checkboxes en Admin/DisplayConfig, parsing seguro en backend

### 4. Logos Cercanías Automáticos

- `trainGeneratorService.js` asigna `logo_url: /uploads/CERCANIAS.png` a tipos Cercanías/Regional
- RegEx robusto: `C10`, `C4B`, `MA-C...`, códigos exactos `C`/`R`
- `typeLogo` solo Cercanías/Regionales; resto usa `operatorLogo` o texto

### 5. Sidebar Admin Colapsable

- Mobile: overlay + hamburger; desktop: fija (`lg:static`)

### 6. UI/UX Mejorada en DisplayConfig

- **Cambio layout:** `grid-cols-1 2xl:grid-cols-[...]`
  - Vertical por defecto (mobile/tablet)
  - Dos columnas solo en 2xl (>1536px)
- **Tabla sin min-width forzado** — se adapta sin scroll horizontal
- Mejorada legibilidad en pantallas pequeñas

---

## 📊 Estado de Componentes Principales

| Componente                  | Estado      | Notas                                                |
| --------------------------- | ----------- | ---------------------------------------------------- |
| **Display (PIS público)**   | ✅ Completo | Réplica ADIF pixel-perfect, virtualización de filas  |
| **PIS Components**          | ✅ Completo | `components/pis/` — BoardHeader, DepartureRow, LineBadge, OperatorLogo, PisClock |
| **Admin (Dashboard)**       | ✅ Completo | 11 tabs, sidebar colapsable, multitud de funcionalidades |
| **DisplayConfig**           | ✅ Completo | Configuración por display, logo, layout vertical     |
| **DisplayPage**             | ✅ Completo | 4 modos de screen (platform, clock, train-info, board) con destino alternante |
| **Generación de Trenes**    | ✅ Completo | Random + Rutas + Panel Completo                      |
| **WebSocket**               | ✅ Completo | Broadcast, event listeners, fallbacks                |
| **CRUD Operadores**         | ✅ Completo | Create, read, update (logo), delete                  |
| **CRUD Tipos de Tren**      | ✅ Completo | Create, read, update, delete, logo Cercanías auto    |
| **CRUD Lugares**            | ✅ Completo | Create, read, delete                                 |
| **Multiidioma**             | ✅ Completo | ES, CA, EN, FR, EU, GL                               |
| **TTS (Text-to-Speech)**    | ✅ Completo | Server-side (macOS say + Edge TTS) + fallback navegador, 6 idiomas |
| **Doble número/destino**    | ✅ Completo | `number2`, `destination2`, destino alternante 5s     |
| **Restricciones tarifarias**| ✅ Completo | `fare_restrictions` JSON en Admin/DisplayConfig      |
| **Drag & Drop (Trains)**    | ✅ Completo | Reordenar trenes entre displays                      |

---

## 🚀 Cómo Usar: Guía de Inicio Rápido

### 1. **Inicializar Backend**

```bash
cd backend
npm install
node src/index.js
```

✅ Backend escucha en `http://localhost:4000`
✅ Migraciones auto-creadas
✅ Rutas cargadas en memoria

### 2. **Inicializar Frontend**

```bash
cd frontend
npm install
npm run dev
```

✅ Frontend serve en `http://localhost:5174` (o puerto sugerido)

### 3. **Acceder a la Aplicación**

**Display Público:**

- http://localhost:5174/ (panel default)
- http://localhost:5174/display/:id (panel específico)

**Admin Panel:**

- http://localhost:5174/admin
- Auth: Basic Auth con usuario `admin` y contraseña `railboard`

### 4. **Generar Trenes Desde Rutas**

1. En Admin, tab **"Rutas"**
2. Dropdown: selecciona región/servicio/operador
3. Click en ruta → **"Generar"**
4. Nuevo tren aparece en el panel en tiempo real (WebSocket)

### 5. **Verificar WebSocket**

1. Admin → tab "Rutas"
2. Scroll a **"WSLogPanel"** (muestra eventos en vivo)
3. Genera un tren → verás `{type: "update"}` en el log

### 6. **E2E Test**

```bash
cd backend
node scripts/ws_e2e_test.mjs C-1
```

✅ Output: `Train created: {id, number, operator, ...}`

---

## 📁 Rutas Ferroviarias Disponibles

**Total:** 57 rutas españolas

**Ejemplos:**

- `C-1` — Cercanías Cataluña (Barcelona)
- `R16` — Rodalies Valenciana
- `R01` — Renfe Regional
- `AVE` — Larga Distancia (Renfe)
- `IC` — Intercity
- `S300` — Cercanías Madrid

Para listar todas, revisar `backend/src/data/railboard_routes.json` o UI de RoutesPanel.

---

## 🔄 Flujo de Datos en Tiempo Real

```
Admin (POST /admin/trains/from-route/C-1)
    ↓
Backend (createTrain + broadcast)
    ↓
WebSocket Broadcast {type: "update"}
    ↓
Display (conectado, escucha "update")
    ↓
Renderiza nuevo tren instantáneamente
```

---

## ⚠️ Problemas Conocidos y Soluciones

| Problema                                       | Causa                            | Solución                                                                 |
| ---------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| Watch mode crash `EMFILE: too many open files` | Demasiados descriptores abiertos | Usar `node src/index.js` en lugar de `node --watch`                      |
| E2E script falla con EPERM en agente           | Sandbox sin permisos de socket   | Ejecutar en terminal local: `node backend/scripts/ws_e2e_test.mjs :code` |
| Tabla horizontal scroll en mobile              | `min-w` fijo en componente       | Removido `min-w-[980px]` de tabla                                        |

**Recomendaciones:**

- Para desarrollo local sin watch, usar `npm run dev` o manual `node src/index.js` + refresh navegador
- Para E2E automatizado en CI/CD, usar fallback curl (ya implementado en script)

---

## 📝 Trabajo Pendiente / Mejoras Futuras

### Corto Plazo (próximas sesiones)

- [ ] Convertir dynamic require de WSLogPanel a static import
- [ ] Agregar tests unitarios para componentes core (Display, Admin)
- [ ] Mejorar error boundaries en React
- [ ] Documentar endpoints de API en OpenAPI/Swagger
- [ ] Agregar rate limiting más granular por endpoint

### Medio Plazo

- [ ] Persistencia de configuración de display en localStorage
- [ ] Exportar/importar configuración de display (JSON)
- [ ] Historial de cambios de tren (audit log)
- [ ] Integración con datos reales de RENFE (API)
- [ ] Modo oscuro/claro switcheable en display público

### Largo Plazo

- [ ] Autenticación con tokens JWT
- [ ] Múltiples usuarios con roles (admin, operator, viewer)
- [ ] Webhooks para alertas externas
- [ ] Soporte de imágenes/videos en displays
- [ ] Integración de mapas (geolocalización de trenes)

---

## 📚 Referencias de Documentación

- **API REST:** [docs/api.md](api.md)
- **Arquitectura:** [docs/architecture.md](architecture.md)
- **Frontend:** [docs/frontend.md](frontend.md)
- **Backend:** [docs/backend.md](backend.md)
- **Instalación:** [README.md](../README.md)

---

## 👨‍💻 Comandos Útiles

```bash
# Backend
cd backend
npm install
npm run seed              # (Opcional) cargar datos iniciales
node src/index.js         # Iniciar servidor

# Frontend
cd frontend
npm install
npm run dev              # Dev server (hot reload)
npm run build            # Build para producción
npm run preview          # Preview del build

# E2E Testing
node backend/scripts/ws_e2e_test.mjs C-1

# Database (si necesario borrar)
rm backend/data/data.db  # y reiniciar backend para recrear
```

---

## 🎓 Notas Técnicas

1. **Migraciones SQL:** Definidas como strings en `db.js`, ejecutadas con `better-sqlite3.exec()`
2. **Auth:** Header `Authorization: Basic admin:railboard` (base64 `YWRtaW46cmFpbGJvYXJk`)
3. **CORS:** Habilitado con `cors()` middleware en Express
4. **Multiidioma:** Clave de idioma en `config.language`, archivos i18n en `frontend/src/lib/i18n.ts`
5. **Estilos:** Tailwind CSS + CSS custom properties, dark theme por defecto

---

**Fin del documento.**  
Para preguntas o actualizaciones, editar este archivo o contactar al equipo de desarrollo.
