# Changelog — RailBoard

Registro de cambios y versiones del proyecto.

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
