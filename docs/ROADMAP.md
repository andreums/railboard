# Roadmap técnico — RailBoard

> **Fecha:** 2026-07-17
> **Base:** Análisis completo del repositorio (véase ANALYSIS.md)
> **Propósito:** Hoja de ruta para reducir deuda técnica, mejorar seguridad y preparar la arquitectura para evoluciones futuras.

---

## Índice

- [Estado actual](#estado-actual)
- [Deuda identificada](#deuda-identificada)
- [Fase 0: Estabilización inmediata ✅](#fase-0-estabilización-inmediata-)
- [Fase 1: Visibilidad y control ✅](#fase-1-visibilidad-y-control-)
- [Fase 2: Reducción de deuda ✅](#fase-2-reducción-de-deuda-)
- [Fase 3: Evolución arquitectónica (pendiente)](#fase-3-evolución-arquitectónica-pendiente)
- [Plan 30-60-90 días](#plan-30-60-90-días)
- [Quick wins restantes](#quick-wins-restantes)
- [Registro de riesgos](#registro-de-riesgos)

---

## Estado actual

### ✅ Implementado (julio 2026)

| ID     | Acción                                                 | Archivos                                                                                                                           | Fecha      |
| ------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| DT-010 | Backup DB automático                                   | `scripts/backup.sh`, `docker-compose.yml`, `package.json`                                                                          | 2026-07-17 |
| DT-008 | Validación MIME real de uploads (file-type)            | `routes.js`, `package.json`                                                                                                        | 2026-07-17 |
| DT-013 | `routeService.ts` eliminado                            | `backend/src/services/routeService.ts`                                                                                             | 2026-07-17 |
| DT-009 | Logs estructurados (pino) + Request-ID en logger       | `logger.js`, `index.js`, `migrations.js`, `seed.js`, `railRoutesApi.js`, `routeService.js`                                         | 2026-07-17 |
| DT-006 | ESLint + Prettier + CI                                 | `eslint.config.js` (ambos), `.prettierrc`, `.prettierignore`, `.github/workflows/ci.yml`                                           | 2026-07-17 |
| DT-011 | Valores mágicos (`station_id: 1`)                      | `seed.js`                                                                                                                          | 2026-07-17 |
| DT-014 | Service Worker con versionado de caché                 | `sw.js`, `main.tsx`, `Dockerfile`, `.env.example`                                                                                  | 2026-07-17 |
| —      | Health check ampliado (DB, uploads, memoria)           | `index.js`                                                                                                                         | 2026-07-17 |
| —      | `.nvmrc` añadido                                       | `.nvmrc`                                                                                                                           | 2026-07-17 |
| —      | `X-Request-ID` middleware                              | `index.js`                                                                                                                         | 2026-07-17 |
| —      | Advertencia contraseña por defecto en `.env.docker`    | `.env.docker`                                                                                                                      | 2026-07-17 |
| —      | Documentación completa (10 docs)                       | `docs/`                                                                                                                            | 2026-07-17 |
| DT-003 | Unificar migraciones a `.sql` secuenciales             | `migrations/000-initial-schema.sql`, `migrations/004..010-*.sql`, `db.js`, `migrations.js`                                         | 2026-07-17 |
| DT-002 | Refactor `routes.js` (1725→688 líneas) en servicios    | `services/{uploadService,trainGeneratorService,boardService}.js`, `middleware/auth.js`, `data/observationBank.js`, `lib/random.js` | 2026-07-17 |
| DT-005 | Tests de componentes frontend (Display, Admin, Trains) | `pages/__tests__/{Display,Admin,Trains}.test.tsx` — 21 tests nuevos                                                                | 2026-07-17 |

### 📋 Pendiente

| ID     | Deuda                                              | Categoría    | Esfuerzo | Riesgo | Componente        |
| ------ | -------------------------------------------------- | ------------ | -------- | ------ | ----------------- |
| DT-007 | Migrar auth básica a tokens o proxy OAuth2         | Seguridad    | M        | Alto   | routes.js + nginx |
| DT-001 | Refactor Admin.tsx monolítico (3128 líneas)        | Arquitectura | L        | Medio  | Admin.tsx         |
| DT-012 | Gestor de estado global (TanStack Query / Zustand) | Arquitectura | M        | Bajo   | frontend          |

---

## Fase 0: Estabilización inmediata ✅

**Estado: COMPLETADA** (julio 2026)

| Acción                       | Archivos                                        | Fecha implementación |
| ---------------------------- | ----------------------------------------------- | -------------------- |
| Backup DB automático         | `scripts/backup.sh`, `docker-compose.yml`       | 2026-07-17           |
| Validar MIME real de uploads | `routes.js` (middleware `contentTypeValidator`) | 2026-07-17           |
| `X-Request-ID` middleware    | `index.js`                                      | 2026-07-17           |
| `.nvmrc`                     | `.nvmrc`                                        | 2026-07-17           |
| Advertencia contraseña       | `.env.docker`                                   | 2026-07-17           |

---

## Fase 1: Visibilidad y control ✅

**Estado: COMPLETADA** (julio 2026)

| Acción                                             | Archivos                                               | Fecha implementación |
| -------------------------------------------------- | ------------------------------------------------------ | -------------------- |
| Logs estructurados con pino + Request-ID en logger | `backend/src/logger.js`, resto de módulos backend      | 2026-07-17           |
| ESLint + Prettier + CI                             | `eslint.config.js` (ambos), `.github/workflows/ci.yml` | 2026-07-17           |
| Health check ampliado (DB, uploads, memoria)       | `index.js`                                             | 2026-07-17           |

---

## Fase 2: Reducción de deuda ✅

**Estado: COMPLETADA** (julio 2026)

| Acción                                   | Archivos                                                                                                                                                    | Fecha implementación |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Refactor routes.js en servicios (DT-002) | `services/{uploadService,trainGeneratorService,boardService}.js`, `middleware/auth.js`                                                                      | 2026-07-17           |
| Unificar migraciones a SQL (DT-003)      | `migrations/000-initial-schema.sql`, `migrations/004..010-*.sql`                                                                                            | 2026-07-17           |
| Tests de componentes críticos (DT-005)   | `pages/__tests__/{Display,Admin,Trains}.test.tsx` — 21 tests: Display (render, board fallback, error/retry, WS), Admin (CRUD Destinos), Trains (CRUD + DnD) | 2026-07-17           |

---

## Fase 3: Evolución arquitectónica (pendiente)

### Refactor Admin.tsx en subcomponentes

| Campo                  | Detalle                                             |
| ---------------------- | --------------------------------------------------- |
| **Problema**           | DT-001 — 3128 líneas, componente monolítico         |
| **Dependencias**       | Fase 2 (tests, servicios)                           |
| **Esfuerzo**           | L (~40h)                                            |
| **Riesgo**             | Medio                                               |
| **Resultado esperado** | 8-10 archivos independientes, lazy loading por tabs |

### Gestor de estado global

| Campo                  | Detalle                                              |
| ---------------------- | ---------------------------------------------------- |
| **Problema**           | DT-012 — datos recargados en cada navegación         |
| **Dependencias**       | Fase 3 (Admin refactor)                              |
| **Esfuerzo**           | M (~16h)                                             |
| **Riesgo**             | Bajo                                                 |
| **Resultado esperado** | Datos compartidos entre vistas, menos peticiones API |

**Recomendación:** TanStack Query para datos de API + Zustand para estado de UI.

### Migrar auth a tokens o OAuth2 proxy

| Campo                  | Detalle                                          |
| ---------------------- | ------------------------------------------------ |
| **Problema**           | DT-007 — Basic auth sin HTTPS, sin MFA           |
| **Dependencias**       | Fase 1 (logs, health)                            |
| **Esfuerzo**           | M (~20h)                                         |
| **Riesgo**             | Medio                                            |
| **Resultado esperado** | JWT local o proxy OAuth2 (Authelia/oauth2-proxy) |

---

## Plan 30-60-90 días

### Días 1-30: Fundamentos de calidad ✅ / 🏗️

| Semana | Acción                                                  | Estado        |
| ------ | ------------------------------------------------------- | ------------- |
| 1      | Backup DB + validación MIME + X-Request-ID + .nvmrc     | ✅ Completado |
| 2      | Logs estructurados con pino + Request-ID                | ✅ Completado |
| 3      | ESLint + Prettier + GitHub Actions CI                   | ✅ Completado |
| 4      | Tests básicos de componentes frontend (Display, Trains) | ✅ Completado |

### Días 31-60: Reducción de deuda ✅

| Semana | Acción                                           | Entregable                                                               |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------ |
| 5-6    | Refactor routes.js en servicios                  | ✅ Completado — routes.js 1725→688 líneas, 6 módulos nuevos              |
| 7      | Unificar migraciones SQL + Health check ampliado | ✅ Completado — db.js sin ALTER TABLE inline, health check ✅ completado |
| 8      | Tests restantes                                  | ✅ Completado — 21 tests nuevos (Display, Admin, Trains)                 |

### Días 61-90: Evolución arquitectónica

| Semana | Acción                                             | Entregable                        |
| ------ | -------------------------------------------------- | --------------------------------- |
| 9-10   | Refactor Admin.tsx en subcomponentes               | 8-10 archivos, lazy loading       |
| 11     | Gestor de estado global (TanStack Query + Zustand) | Cache compartida                  |
| 12     | Auth tokens + documentación ADRs                   | Migración auth, ADRs actualizados |

---

## Quick wins restantes

| Acción                                              | Beneficio                    | Esfuerzo | Riesgo | Archivos       |
| --------------------------------------------------- | ---------------------------- | -------- | ------ | -------------- |
| `@rolldown/binding-darwin-arm64` a devDeps opcional | Evita errores de instalación | XS       | Bajo   | `package.json` |

Todos los demás quick wins de esta lista (console.log→pino, ESLint+Prettier, health check, valores mágicos, SW versionado, `.editorconfig`) ya están implementados — véase [Estado actual](#estado-actual).

---

## Registro de riesgos

| ID   | Riesgo                     | Causa                                        | Probabilidad | Impacto | Mitigación                              | Contingencia                     |
| ---- | -------------------------- | -------------------------------------------- | :----------: | :-----: | --------------------------------------- | -------------------------------- |
| R-01 | Pérdida de datos           | Fallo volumen Docker, corrupción SQLite      |     Baja     | Crítico | ✅ Backup automático implementado       | Restaurar desde backup           |
| R-02 | Acceso no autorizado       | Contraseña por defecto, Basic auth sin HTTPS |    Media     |  Alto   | Forzar cambio password, migrar a tokens | Revocar acceso, rotar secrets    |
| R-03 | RCE via upload             | Archivo malicioso con extensión válida       |     Baja     | Crítico | ✅ Validación MIME real implementada    | Revisar logs, eliminar archivo   |
| R-04 | Bloqueo por mantenibilidad | Admin.tsx + routes.js masivos (4804 líneas)  |     Alta     |  Medio  | Refactor progresivo (Fase 2-3)          | Congelar features hasta refactor |
| R-05 | Pérdida de conocimiento    | Sin ADRs, onboarding inexistente             |    Media     |  Alto   | ✅ Documentación completa en docs/      | Mantener docs actualizados       |
| R-06 | Incompatibilidad Node 22+  | Dependencias nativas                         |    Media     |  Medio  | Testear con Node 22 en CI               | Pin Node 20 en Dockerfile        |
| R-07 | Regresión por refactors    | Cambios sin tests de cobertura               |    Media     |  Alto   | Tests antes de refactor (Fase 2 → 3)    | Feature flags, rollback plan     |

---

> **Nota:** Este roadmap es un documento vivo. Las prioridades y el alcance de cada fase se deben revisar periódicamente basándose en el contexto del proyecto y las necesidades cambiantes.
