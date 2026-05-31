# 📊 RailBoard — Estado Actual (31 de mayo 2026)

## ✅ Completado (Última Sesión)

### Feature: Generación de Trenes desde Rutas Ferroviarias
- **57 rutas españolas** importadas (Renfe, Rodalies, Cercanías, Larga Distancia)
- **Endpoint POST `/admin/trains/from-route/:code`** — crea tren con metadatos de ruta real
- **UI RoutesPanel** — selector interactivo con filtros (región, servicio, operador)
- **WebSocket broadcast** — notificación en tiempo real cuando se crea tren desde ruta
- **E2E script `ws_e2e_test.mjs`** — automatiza test de creación + validación

### Feature: UI Debug para WebSocket
- **WSLogPanel** — widget que muestra eventos WebSocket en vivo (últimos 50)
- Integrado en Admin tab "Rutas", bajo RoutesPanel
- Ayuda a verificar que broadcast funciona correctamente

### UX: DisplayConfig Vertical
- **Layout por defecto vertical** — configuración encima, trenes abajo
- **Dos columnas solo en 2xl** (>1536px) — optimizado para tablet/laptop
- **Tabla sin scroll forzado** — se adapta al ancho disponible
- **Mejor para pantallas pequeñas** (móviles en orientación vertical)

---

## 🎯 Estado de Funcionalidades Core

| Función | Estado | Detalles |
|---------|--------|----------|
| Display público (llegadas/salidas) | ✅ | Renderiza en tiempo real, múltiples displays |
| Admin panel (11 tabs) | ✅ | Estación, Displays, Trenes, Rutas, Operadores, etc. |
| CRUD Operadores | ✅ | Create/read/edit/delete con logo |
| CRUD Tipos de tren | ✅ | Create/read/edit/delete |
| Generación aleatoria | ✅ | 1 tren, panel (8), automática (intervalo) |
| **Generación desde rutas** | ✅ | NEW — desde metadatos de 57 rutas españolas |
| WebSocket real-time | ✅ | Broadcast de cambios, event listeners |
| **WebSocket debug** | ✅ | NEW — WSLogPanel para ver eventos |
| Multiidioma (6 idiomas) | ✅ | ES, CA, EN, FR, EU, GL |
| TTS Anuncio | ✅ | Text-to-speech por navegador |
| Drag & Drop trenes | ✅ | Reordenar entre displays |
| Configuración por display | ✅ | Colores, idioma, reloj, pie, logo |

---

## 🔧 Stack Técnico

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + SQLite (better-sqlite3) + WebSocket (ws)
- **Auth:** Basic Auth (`admin:railboard`)
- **Real-time:** WebSocket para broadcast de cambios
- **Database:** SQLite con migraciones automáticas

---

## 🚀 Cómo Probar Nuevas Features

### 1. Generación desde Rutas
```bash
# Backend
cd backend && node src/index.js

# Frontend
cd frontend && npm run dev

# En Admin (http://localhost:5174/admin):
# → Tab "Rutas" → Selector → "Generar"
# → Nuevo tren aparece en tiempo real
```

### 2. Verificar WebSocket Broadcast
```bash
# En Admin tab "Rutas":
# → Scroll a "WSLogPanel" (arriba muestra eventos)
# → Genera tren → verás {type: "update"} en log
```

### 3. E2E Automático
```bash
cd backend
node scripts/ws_e2e_test.mjs C-1
# Output: Train created: {id, number, ...}
```

---

## 📁 Archivos Nuevos/Modificados (Última Sesión)

### Creados
- `backend/src/data/railboard_routes.json` — 57 rutas españolas
- `backend/scripts/ws_e2e_test.mjs` — test E2E con WebSocket
- `frontend/src/components/admin/RoutesPanel.tsx` — selector de rutas
- `frontend/src/components/admin/WSLogPanel.tsx` — debug de WebSocket
- `docs/PROGRESS.md` — este documento de progreso

### Modificados
- `backend/src/routes.js` — añadido `POST /admin/trains/from-route/:code`
- `backend/src/ws.js` — broadcast de `{type: "update"}`
- `frontend/src/pages/Admin.tsx` — integración de RoutesPanel + WSLogPanel
- `frontend/src/pages/DisplayConfig.tsx` — layout vertical (grid-cols-1 2xl:grid-cols-...)
- `frontend/src/lib/api.ts` — `generateTrainFromRoute(code)` + `connectWS()` con event listeners

---

## ⚠️ Problemas Conocidos

1. **Watch mode backend** — `node --watch` da `EMFILE: too many open files`
   - **Solución:** Usar `node src/index.js` sin watch, refresh manual en navegador

2. **E2E script en agente** — falla con EPERM socket en sandbox
   - **Solución:** Ejecutar en terminal local (ya tiene fallback curl en script)

3. **Tabla horizontal scroll en mobile** — `min-w` fijo
   - **Solución:** Removido en DisplayConfig (ya solucionado ✅)

---

## 📊 Rutas Disponibles (Ejemplos)

- `C-1` — Cercanías Barcelona
- `R16` — Rodalies Valencia
- `AVE` — Larga Distancia Renfe
- `IC` — Intercity
- ... (52 más en `railboard_routes.json`)

Ver RoutesPanel en Admin para lista completa con filtros.

---

## 📝 Próximos Pasos (Sugeridos)

1. ✅ **Hecho:** Documentar progreso (este archivo)
2. [ ] Tests unitarios para componentes core
3. [ ] OpenAPI/Swagger para documentar API
4. [ ] Agregar integración datos reales de RENFE
5. [ ] Mejorar error boundaries y manejo de errores
6. [ ] Agregar autenticación con JWT (tokens en lugar de Basic Auth)

---

**Generado:** 31 de mayo 2026  
**Versión:** 1.0 (Fase C completa)  
**Siguiente revisión:** Después de implementar tests o integración RENFE
