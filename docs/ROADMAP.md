# Roadmap técnico — RailBoard

> **Fecha:** 2026-07-17
> **Base:** Análisis completo del repositorio (véase ANALYSIS.md)
> **Propósito:** Hoja de ruta para reducir deuda técnica, mejorar seguridad y preparar la arquitectura para evoluciones futuras.

---

## Índice

- [Deuda identificada](#deuda-identificada)
- [Fase 0: Estabilización inmediata (semana 1)](#fase-0-estabilización-inmediata-semana-1)
- [Fase 1: Visibilidad y control (semanas 2-3)](#fase-1-visibilidad-y-control-semanas-2-3)
- [Fase 2: Reducción de deuda (semanas 4-8)](#fase-2-reducción-de-deuda-semanas-4-8)
- [Fase 3: Evolución arquitectónica (semanas 9-12)](#fase-3-evolución-arquitectónica-semanas-9-12)
- [Plan 30-60-90 días](#plan-30-60-90-días)
- [Quick wins](#quick-wins)
- [Registro de riesgos](#registro-de-riesgos)

---

## Deuda identificada

| ID | Deuda | Categoría | Esfuerzo | Riesgo | Componente |
|----|-------|-----------|----------|--------|------------|
| DT-010 | Sin backup DB | Infraestructura | XS | Crítico | docker-compose.yml |
| DT-007 | Auth básica HTTP | Seguridad | S | Alto | routes.js |
| DT-008 | Upload sin validación MIME | Seguridad | XS | Alto | routes.js (multer) |
| DT-005 | Sin tests frontend | Testing | XL | Medio | Admin, Display, Trains |
| DT-001 | Admin.tsx monolítico (3128 líneas) | Arquitectura | L | Medio | Admin.tsx |
| DT-002 | routes.js masivo (1676 líneas) | Arquitectura | M | Medio | routes.js |
| DT-003 | Migraciones inline en db.js | Datos | S | Bajo | db.js |
| DT-009 | Logs no estructurados | Observabilidad | XS | Bajo | index.js |
| DT-006 | Linting ausente | DX | XS | Bajo | ambos proyectos |
| DT-011 | Valores mágicos (station_id: 1) | Código | XS | Bajo | seed.js |
| DT-012 | Sin gestor de estado global | Arquitectura | M | Bajo | frontend |
| DT-013 | routeService.ts muerto | Código | XS | Bajo | backend/src/services/ |
| DT-014 | SW sin versionado | Rendimiento | S | Bajo | sw.js |

---

## Fase 0: Estabilización inmediata (semana 1)

Objetivo: eliminar riesgos críticos y altos en 7 días.

### Backup automático de la base de datos

| Campo | Detalle |
|-------|---------|
| **Problema** | DT-010 — Pérdida total de datos en caso de fallo del volumen Docker |
| **Dependencias** | Docker, cron (alpine) |
| **Esfuerzo** | XS (~2h) |
| **Riesgo** | Bajo — script de copia simple |
| **Resultado esperado** | Copia de `data.db` cada hora en el volumen host, rotación de 7 días |

**Implementación:**
- Script `scripts/backup.sh` que copia `data.db` a `/app/backups/` con timestamp
- Cron en el contenedor backend via `supercronic` o `crond` alpine
- Backup disparado también antes de migraciones/seed

### Forzar cambio de contraseña por defecto

| Campo | Detalle |
|-------|---------|
| **Problema** | DT-007 — `ADMIN_PASSWORD=railboard` por defecto |
| **Dependencias** | Ninguna |
| **Esfuerzo** | XS (~30min) |
| **Riesgo** | Bajo |
| **Resultado esperado** | El admin debe cambiar la contraseña al primer inicio si es el valor por defecto |

**Implementación:**
- Middleware que en la primera petición admin con password por defecto redirige a `/admin/change-password`
- O bien log de advertencia con instrucciones

### Validar MIME de los uploads

| Campo | Detalle |
|-------|---------|
| **Problema** | DT-008 — multer filtra por extensión, no por contenido real |
| **Dependencias** | Librería `file-type` o similar |
| **Esfuerzo** | XS (~2h) |
| **Riesgo** | Bajo |
| **Resultado esperado** | Los archivos subidos se validan por magic bytes antes de almacenarse |

**Implementación:**
- Middleware multer que lee los primeros bytes y comprueba MIME real
- Rechazo de archivos que no coincidan con extensión

---

## Fase 1: Visibilidad y control (semanas 2-3)

Objetivo: poner fundamentos de observabilidad y calidad de código.

### Logs estructurados

| Campo | Detalle |
|-------|---------|
| **Problema** | DT-009 — `console.log` sin niveles ni correlación |
| **Dependencias** | Ninguna |
| **Esfuerzo** | S (~4h) |
| **Riesgo** | Bajo |
| **Resultado esperado** | Logs JSON con niveles (info/warn/error), request ID, tiempo de respuesta |

**Implementación:**
- Sustituir `console.log` por [pino](https://getpino.io/) o [winston](https://github.com/winstonjs/winston)
- Middleware `X-Request-ID` via `crypto.randomUUID()`
- Formateo JSON para producción, pretty-print para dev

### ESLint + Prettier + CI

| Campo | Detalle |
|-------|---------|
| **Problema** | DT-006 — ninguna herramienta de análisis estático |
| **Dependencias** | Ninguna |
| **Esfuerzo** | XS (~2h) |
| **Riesgo** | Bajo |
| **Resultado esperado** | `npm run lint` funcional, `npm run format`, CI con GitHub Actions |

**Implementación:**
- ESLint flat config para backend (JS) y frontend (TS)
- Prettier para formato automático
- GitHub Actions workflow: lint + test en cada PR/branch
- `.vscode/settings.json` recomendado

### Health check ampliado

| Campo | Detalle |
|-------|---------|
| **Problema** | GET /health solo retorna `{ ok: true }` |
| **Dependencias** | Fase 1 (logs) |
| **Esfuerzo** | XS (~1h) |
| **Riesgo** | Bajo |
| **Resultado esperado** | Health check que verifica DB, espacio en disco, memoria, uploads accesibles |

---

## Fase 2: Reducción de deuda (semanas 4-8)

Objetivo: reducir la complejidad de los archivos más problemáticos.

### Tests de los componentes críticos (Display, Trains)

| Campo | Detalle |
|-------|---------|
| **Problema** | DT-005 — ningún test de componentes principales |
| **Dependencias** | Fase 1 (linters, CI) |
| **Esfuerzo** | M (~20h) |
| **Riesgo** | Medio — cambios de API pueden requerir actualización de tests |
| **Resultado esperado** | 10-15 tests nuevos: Display (render, poll, WS), Admin (CRUD básico), Trains (DnD) |

### Refactor routes.js en servicios

| Campo | Detalle |
|-------|---------|
| **Problema** | DT-002 — 1676 líneas con lógica de negocio, validación, transformación |
| **Dependencias** | Ninguna (se puede hacer incrementalmente) |
| **Esfuerzo** | M (~16h) |
| **Riesgo** | Medio — regresión si no hay tests de cobertura |
| **Resultado esperado** | Archivos separados por dominio: `trainService.js`, `operatorService.js`, `stationService.js`, `uploadService.js` |

**Plan de refactor:**
1. Extraer funciones auxiliares a `helpers.js`
2. Crear `trainService.js` con CRUD + generación
3. Crear `operatorService.js` y `trainTypeService.js`
4. Crear `uploadService.js` con validación MIME
5. Dejar `routes.js` solo con definición de rutas y middleware

### Unificar migraciones a SQL

| Campo | Detalle |
|-------|---------|
| **Problema** | DT-003 — migraciones inline en db.js + archivos .sql, dos fuentes de verdad |
| **Dependencias** | Ninguna |
| **Esfuerzo** | S (~6h) |
| **Riesgo** | Bajo — las migraciones existentes son estables |
| **Resultado esperado** | Todas las migraciones en archivos .sql secuenciales, db.js sin ALTER TABLE inline |

### Eliminar código muerto

| Campo | Detalle |
|-------|---------|
| **Problema** | DT-013 — `routeService.ts` duplicado de `routeService.js`, no se usa |
| **Dependencias** | Ninguna |
| **Esfuerzo** | XS (~15min) |
| **Riesgo** | Bajo |
| **Resultado esperado** | Archivo eliminado, ningún import roto |

---

## Fase 3: Evolución arquitectónica (semanas 9-12)

### Refactor Admin.tsx en subcomponentes

| Campo | Detalle |
|-------|---------|
| **Problema** | DT-001 — 3128 líneas, componente monolítico |
| **Dependencias** | Fase 2 (tests, servicios) |
| **Esfuerzo** | L (~40h) |
| **Riesgo** | Medio — no debe romperse la funcionalidad existente |
| **Resultado esperado** | 8-10 archivos independientes, lazy loading por tabs, código más testeable |

**Plan de refactor:**
1. Extraer cada tab a un componente independiente (ya hay algunos: `GenerationPanel`, `RoutesPanel`, etc.)
2. Separar lógica de sidebar, dashboard, modals
3. Añadir lazy loading con `React.lazy()` + `Suspense`
4. Mantener compatibilidad de URLs y estado

### Gestor de estado global

| Campo | Detalle |
|-------|---------|
| **Problema** | DT-012 — datos recargados en cada navegación, renders innecesarios |
| **Dependencias** | Fase 3 (Admin refactor) |
| **Esfuerzo** | M (~16h) |
| **Riesgo** | Bajo — se puede añadir gradualmente |
| **Resultado esperado** | Datos compartidos entre vistas, menos peticiones a la API, mejor experiencia de usuario |

**Recomendación:** [TanStack Query](https://tanstack.com/query/latest) para datos de API (caching, refetch, stale-while-revalidate) + [Zustand](https://github.com/pmndrs/zustand) para estado de UI (sidebar abierta, tab activo, etc.)

### Migrar auth a tokens o OAuth2 proxy

| Campo | Detalle |
|-------|---------|
| **Problema** | DT-007 — Basic auth sin HTTPS, sin MFA, sin rotación |
| **Dependencias** | Fase 1 (logs, health) |
| **Esfuerzo** | M (~20h) |
| **Riesgo** | Medio — cambio de paradigma de autenticación |
| **Resultado esperado** | Autenticación mediante JWT o proxy OAuth2 (Authelia, oauth2-proxy) |

**Opciones:**
1. **JWT local** — login POST /admin/login retorna token, middleware de validación
2. **OAuth2 proxy** — Authelia/oauth2-proxy delante de Nginx, cero cambios al backend
3. **API keys** — para integraciones automatizadas

---

## Plan 30-60-90 días

### Días 1-30: Estabilización y fundamentos

| Semana | Acción | Entregable verificable |
|--------|--------|------------------------|
| 1 | Backup DB automático + forzar cambio password + validar MIME uploads | Script `scripts/backup.sh` funcional, middleware de password por defecto, validación MIME en los uploads |
| 2 | Logs estructurados con pino/winston + Request-ID | `docker compose logs -f backend` muestra JSON, cada línea tiene `reqId` |
| 3 | ESLint + Prettier + GitHub Actions CI | `npm run lint` pasa en backend y frontend, CI verde en cada PR |
| 4 | Tests básicos de componentes frontend (Display, Trains) | 10 tests nuevos que pasan en `npm test` del frontend |

**Hitos verificables:**
- [ ] `scripts/backup.sh` existe y funciona
- [ ] Arrancar con `ADMIN_PASSWORD=railboard` muestra warning en el log
- [ ] Subir un `.exe` con extensión `.png` es rechazado
- [ ] Logs tienen formato JSON con `level`, `reqId`, `msg`
- [ ] `npm run lint` ejecuta sin errores
- [ ] GitHub Actions muestra check verde
- [ ] `npm test` frontend reporta ≥31 tests pasando

### Días 31-60: Reducción de deuda técnica

| Semana | Acción | Entregable verificable |
|--------|--------|------------------------|
| 5-6 | Refactor routes.js en servicios | Archivos `trainService.js`, `operatorService.js`, `stationService.js`, `uploadService.js` creados; `routes.js` < 500 líneas |
| 7 | Unificar migraciones SQL | Todas las migraciones en archivos `.sql` secuenciales, db.js sin ALTER TABLE inline |
| 8 | Validación de uploads con file-type + eliminar routeService.ts | `file-type` comprobando magic bytes; `routeService.ts` eliminado |

**Hitos verificables:**
- [ ] `routes.js` solo contiene definiciones de ruta y middleware
- [ ] `src/services/trainService.js` existe con CRUD
- [ ] Migraciones solo en `backend/migrations/*.sql`
- [ ] `routeService.ts` no existe en el repo
- [ ] Upload de archivo con bytes PNG pero extensión .jpg es aceptado (contenido real)

### Días 61-90: Evolución arquitectónica

| Semana | Acción | Entregable verificable |
|--------|--------|------------------------|
| 9-10 | Refactor Admin.tsx en subcomponentes | 8-10 archivos independientes, lazy loading, sidebar separada |
| 11 | Gestor de estado global (TanStack Query / Zustand) | Datos compartidos, menos renders, cache activa |
| 12 | Documentación y cierre | ROADMAP actualizado, ADRs nuevos, docs de arquitectura |

**Hitos verificables:**
- [ ] Cada tab de admin es un componente independiente
- [ ] Lazy loading activo (los tabs se cargan bajo demanda)
- [ ] Navegar de /admin a /trains no recarga operadores/tipos
- [ ] Docs de arquitectura cubren decisiones tomadas

---

## Quick wins

Acciones de esfuerzo XS (≤2h) que se pueden implementar en cualquier momento.

| Acción | Beneficio | Esfuerzo | Riesgo | Archivos |
|--------|-----------|----------|--------|----------|
| Backup DB automático | Pérdida cero de datos | XS | Bajo | `docker-compose.yml`, `scripts/backup.sh` |
| Forzar cambio password por defecto | Seguridad mejorada | XS | Bajo | `.env.docker`, `index.js` |
| Validar MIME real de los uploads | Evita RCE via archivo malicioso | XS | Bajo | `routes.js` (multer) |
| Eliminar `routeService.ts` | Código limpio, menos confusión | XS | Bajo | `backend/src/services/` |
| Añadir `.nvmrc` | Experiencia desarrollador consistente | XS | Bajo | `.nvmrc` (contenido: `20`) |
| Añadir `X-Request-ID` middleware | Depuración y correlación de logs | XS | Bajo | `index.js` |
| Añadir `.editorconfig` | Formato consistente entre editores | XS | Bajo | `.editorconfig` |
| Reemplazar `@rolldown/binding-darwin-arm64` por devDependency opcional | Evita errores de instalación | XS | Bajo | `package.json` ambos |

---

## Registro de riesgos

| ID | Riesgo | Causa | Probabilidad | Impacto | Mitigación | Contingencia |
|----|--------|-------|:------------:|:-------:|------------|--------------|
| R-01 | Pérdida de datos | Fallo volumen Docker, corrupción SQLite | Baja | Crítico | Backup automático (cron + script) en volumen separado | Restaurar desde backup, verificar integridad |
| R-02 | Acceso no autorizado | Contraseña por defecto, Basic auth sin HTTPS | Media | Alto | Forzar cambio de password al primer inicio, migrar a tokens | Revocar acceso, cambiar password, rotar secrets |
| R-03 | RCE via upload | Archivo malicioso con extensión válida (ej: .png con shell script) | Baja | Crítico | Validar MIME real con `file-type`, límite de tamaño, escaneo | Revisar logs, eliminar archivo sospechoso, audit trail |
| R-04 | Bloqueo por mantenibilidad | Admin.tsx + routes.js masivos (4804 líneas combinadas) | Alta | Medio | Refactor progresivo por fases | Congelar nuevas features hasta completar refactor |
| R-05 | Pérdida de conocimiento | Sin documentación de decisiones arquitectónicas, onboarding inexistente | Media | Alto | ADRs para decisiones importantes, ONBOARDING.md, diagramas de arquitectura | Mantener al menos ANALYSIS.md actualizado |
| R-06 | Incompatibilidad Node 22+ | Dependencias nativas (better-sqlite3) pueden no compilar en versiones futuras | Media | Medio | Testear con Node 22 en CI, pin Node 20 en el Dockerfile | Actualizar better-sqlite3, o usar versión LTS en el contenedor |
| R-07 | Regresión por refactors | Cambios en routes.js o Admin.tsx sin tests de cobertura | Media | Alto | Tests antes de refactor (Fase 2 antes de Fase 3), CI con coverage gate | Feature flags para refactors grandes, rollback plan |

---

## Resumen visual

```
Semana 1          Semana 2-3         Semana 4-8          Semana 9-12
─────────────────  ─────────────────  ───────────────────  ───────────────────
┌────────────────┐ ┌────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Backup DB      │ │ Logs (pino)    │ │ Tests frontend   │ │ Refactor Admin   │
│ Forzar pwd     │ │ ESLint+CI      │ │ Refactor routes  │ │ Gestor estado    │
│ Validar MIME   │ │ Health check   │ │ Unificar migr.   │ │ Auth tokens      │
└────────────────┘ └────────────────┘ └──────────────────┘ └──────────────────┘
     Riesgos críticos    Calidad y          Reducción           Evolución
     eliminados          observabilidad     de deuda            arquitectónica
```

> **Nota:** Este roadmap es un documento vivo. Las prioridades y el alcance de cada fase se deben revisar periódicamente basándose en el contexto del proyecto y las necesidades cambiantes.
