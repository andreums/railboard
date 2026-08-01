# 📊 RailBoard — Estado Actual (29 de julio 2026)

## ✅ Completado (Última Sesión)

### Feature: PIS Pixel-Perfect (Réplica ADIF)

- **Nueva arquitectura `frontend/src/components/pis/`** — BoardHeader, DepartureRow, LineBadge, OperatorLogo, PisClock
- **`Display.tsx` refactorizado** — réplica exacta del panel ADIF/Gravita:
  - CSS Grid 2 filas (55%/45%), columnas `12% 59% 12% 9% 8%`
  - Colores de fila alternados `#1A3355` / `#0F2441`
  - Escalado `clamp()` para 16:9, 16:10 y ultrawide
  - Marquee en destino, paradas y observaciones
  - Cancelado: hora tachada, etiqueta naranja, opacidad 0.45
- **Virtualización de filas** — renderiza solo filas visibles (scroll + ResizeObserver)
- **Logo configurable** — ADIF por defecto (`/adif.svg`) o `logo_url` personalizado

### Feature: Doble Número / Destino + Alternancia

- Campos `number2` y `destination2` por tren (Admin, PIS, DisplayPage)
- **Destino alternante** cada 5s — hook `useAlternating()` + componente `AltValue`
- PIS muestra dos números (principal + secundario)

### Feature: Restricciones Tarifarias

- Campo JSON `fare_restrictions` (`commuterTicketsNotAccepted`, `commuterPassesNotAccepted`, `reservationRequired`)
- Checkboxes en Admin y DisplayConfig
- Parsing seguro en backend (JSON string u objeto, guard anti-corrupción)

### Feature: Logos Cercanías Automáticos

- `trainGeneratorService.js` asigna logo Cercanías a tipos generados desde rutas
- RegEx robusto (`C10`, `C4B`, `MA-C...`, códigos exactos `C`/`R`)
- `typeLogo` solo Cercanías/Regionales; resto de tipos usan `operatorLogo` o texto

### UX: Sidebar Admin Colapsable

- Mobile: overlay + hamburger; desktop: fija (`lg:static`)

---

## 🎯 Estado de Funcionalidades Core

| Función                            | Estado | Detalles                                            |
| ---------------------------------- | ------ | --------------------------------------------------- |
| Display PIS (ADIF pixel-perfect)   | ✅     | Grid 55%/45%, columnas ADIF, virtualización filas   |
| Admin panel (11 tabs)              | ✅     | Estación, Displays, Trenes, Rutas, Operadores, etc. |
| CRUD Operadores                    | ✅     | Create/read/edit/delete con logo                    |
| CRUD Tipos de tren                 | ✅     | Create/read/edit/delete, logo Cercanías auto        |
| Generación aleatoria               | ✅     | 1 tren, panel (8), automática (intervalo)           |
| Generación desde rutas             | ✅     | Desde metadatos de 57 rutas españolas               |
| Doble número / destino             | ✅     | NEW — `number2`, `destination2`, destino alternante |
| Restricciones tarifarias           | ✅     | NEW — `fare_restrictions` JSON                      |
| WebSocket real-time                | ✅     | Broadcast de cambios, event listeners               |
| WebSocket debug                    | ✅     | WSLogPanel para ver eventos                         |
| Multiidioma (6 idiomas)            | ✅     | ES, CA, EN, FR, EU, GL                              |
| TTS Anuncio                        | ✅     | Server-side (macOS say + Edge TTS) + navegador      |
| Megafonía                          | ✅     | 15 presets, composición, cola, WebSocket push       |
| Drag & Drop trenes                 | ✅     | Reordenar entre displays                            |
| Configuración por display          | ✅     | Colores, idioma, reloj, pie, logo                   |

---

## 🔧 Stack Técnico

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + SQLite (better-sqlite3) + WebSocket (ws)
- **Auth:** Basic Auth (`admin:railboard`)
- **Real-time:** WebSocket para broadcast de cambios
- **Database:** SQLite con migraciones automáticas en `backend/data/data.db` (WAL)

---

## 🚀 Cómo Probar Nuevas Features

### 1. Panel PIS con doble destino

```bash
# Backend
cd backend && node src/index.js

# Frontend
cd frontend && npm run dev

# En Admin (http://localhost:5174/admin):
# → Tab "Trenes" → Editar tren → añadir N.º 2 y Destino 2
# → Ver en http://localhost:5174/ — el destino alterna cada 5s
```

### 2. Restricciones tarifarias

```bash
# Admin → Tab "Trenes" → Editar tren → sección "Restricciones tarifarias"
# Activa billetes/abonos de cercanías no válidos, reserva obligatoria
```

### 3. Logo del panel

```bash
# DisplayConfig → campo "Logo URL" (vacío = ADIF por defecto)
```

### 4. E2E Automático

```bash
cd backend
node scripts/ws_e2e_test.mjs C-1
# Output: Train created: {id, number, ...}
```

---

## ⚠️ Problemas Conocidos

1. **Watch mode backend** — `node --watch` da `EMFILE: too many open files`
   - **Solución:** Usar `node src/index.js` sin watch, refresh manual en navegador

2. **E2E script en agente** — falla con EPERM socket en sandbox
   - **Solución:** Ejecutar en terminal local (ya tiene fallback curl en script)

---

## 📝 Próximos Pasos (Sugeridos)

1. [ ] Tests unitarios para componentes core (Display, Admin, PIS)
2. [ ] OpenAPI/Swagger para documentar API
3. [ ] Integración datos reales de RENFE
4. [ ] Mejorar error boundaries y manejo de errores
5. [ ] Autenticación con JWT (tokens en lugar de Basic Auth)

---

**Generado:** 29 de julio 2026  
**Versión:** 1.0 (Fase C completa, PIS pixel-perfect)  
**Siguiente revisión:** Después de implementar tests o integración RENFE
