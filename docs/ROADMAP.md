# Roadmap tècnic — RailBoard

> **Data:** 2026-07-17
> **Base:** Anàlisi completa del repositori (vegeu ANALYSIS.md)
> **Propòsit:** Full de ruta per reduir deute tècnic, millorar seguretat i preparar l'arquitectura per a evolucions futures.

---

## Índex

- [Deute identificat](#deute-identificat)
- [Fase 0: Estabilització immediata (setmana 1)](#fase-0-estabilització-immediata-setmana-1)
- [Fase 1: Visibilitat i control (setmanes 2-3)](#fase-1-visibilitat-i-control-setmanes-2-3)
- [Fase 2: Reducció de deute (setmanes 4-8)](#fase-2-reducció-de-deute-setmanes-4-8)
- [Fase 3: Evolució arquitectònica (setmanes 9-12)](#fase-3-evolució-arquitectònica-setmanes-9-12)
- [Pla 30-60-90 dies](#pla-30-60-90-dies)
- [Quick wins](#quick-wins)
- [Registre de riscos](#registre-de-riscos)

---

## Deute identificat

| ID | Deute | Categoria | Esforç | Risc | Component |
|----|-------|-----------|--------|------|-----------|
| DT-010 | Sense backup DB | Infraestructura | XS | Crític | docker-compose.yml |
| DT-007 | Auth bàsica HTTP | Seguretat | S | Alt | routes.js |
| DT-008 | Upload sense validació MIME | Seguretat | XS | Alt | routes.js (multer) |
| DT-005 | Sense tests frontend | Testing | XL | Mig | Admin, Display, Trains |
| DT-001 | Admin.tsx monolític (3128 línies) | Arquitectura | L | Mig | Admin.tsx |
| DT-002 | routes.js massiu (1676 línies) | Arquitectura | M | Mig | routes.js |
| DT-003 | Migracions inline a db.js | Dades | S | Baix | db.js |
| DT-009 | Logs no estructurats | Observabilitat | XS | Baix | index.js |
| DT-006 | Linting absent | DX | XS | Baix | ambdós projectes |
| DT-011 | Valors màgics (station_id: 1) | Codi | XS | Baix | seed.js |
| DT-012 | Sense gestor d'estat global | Arquitectura | M | Baix | frontend |
| DT-013 | routeService.ts mort | Codi | XS | Baix | backend/src/services/ |
| DT-014 | SW sense versionat | Rendiment | S | Baix | sw.js |

---

## Fase 0: Estabilització immediata (setmana 1)

Objectiu: eliminar riscos crítics i alts en 7 dies.

### Backup automàtic de la base de dades

| Camp | Detall |
|------|--------|
| **Problema** | DT-010 — Pèrdua total de dades en cas de fallada del volume Docker |
| **Dependències** | Docker, cron (alpine) |
| **Esforç** | XS (~2h) |
| **Risc** | Baix — script de copia simple |
| **Resultat esperat** | Còpia de `data.db` cada hora al volume host, rotació de 7 dies |

**Implementació:**
- Script `scripts/backup.sh` que copia `data.db` a `/app/backups/` amb timestamp
- Cron al contenidor backend via `supercronic` o `crond` alpine
- Backup disparat també abans de migracions/seed

### Forçar canvi de contrasenya per defecte

| Camp | Detall |
|------|--------|
| **Problema** | DT-007 — `ADMIN_PASSWORD=railboard` per defecte |
| **Dependències** | Cap |
| **Esforç** | XS (~30min) |
| **Risc** | Baix |
| **Resultat esperat** | L'admin ha de canviar la contrasenya al primer inici si és el valor per defecte |

**Implementació:**
- Middleware que a la primera petició admin amb password per defecte redirigeix a `/admin/change-password`
- O bé log d'advertència amb instruccions

### Validar MIME dels uploads

| Camp | Detall |
|------|--------|
| **Problema** | DT-008 — multer filtra per extensió, no per contingut real |
| **Dependències** | Llar d'infants `file-type` o similar |
| **Esforç** | XS (~2h) |
| **Risc** | Baix |
| **Resultat esperat** | Els fitxers pujats es validen per magic bytes abans d'emmagatzemar-se |

**Implementació:**
- Middleware multer que llegeix els primers bytes i comprova MIME real
- Rebuig de fitxers que no coincideixin amb extensió

---

## Fase 1: Visibilitat i control (setmanes 2-3)

Objectiu: posar fonaments d'observabilitat i qualitat de codi.

### Logs estructurats

| Camp | Detall |
|------|--------|
| **Problema** | DT-009 — `console.log` sense nivells ni correlació |
| **Dependències** | Cap |
| **Esforç** | S (~4h) |
| **Risc** | Baix |
| **Resultat esperat** | Logs JSON amb nivells (info/warn/error), request ID, temps de resposta |

**Implementació:**
- Substituir `console.log` per [pino](https://getpino.io/) o [winston](https://github.com/winstonjs/winston)
- Middleware `X-Request-ID` via `crypto.randomUUID()`
- Formateig JSON per a producció, pretty-print per a dev

### ESLint + Prettier + CI

| Camp | Detall |
|------|--------|
| **Problema** | DT-006 — cap eina d'anàlisi estàtica |
| **Dependències** | Cap |
| **Esforç** | XS (~2h) |
| **Risc** | Baix |
| **Resultat esperat** | `npm run lint` funcional, `npm run format`, CI amb GitHub Actions |

**Implementació:**
- ESLint flat config per a backend (JS) i frontend (TS)
- Prettier per a format automàtic
- GitHub Actions workflow: lint + test a cada PR/branch
- `.vscode/settings.json` recomanat

### Health check ampliat

| Camp | Detall |
|------|--------|
| **Problema** | GET /health només retorna `{ ok: true }` |
| **Dependències** | Fase 1 (logs) |
| **Esforç** | XS (~1h) |
| **Risc** | Baix |
| **Resultat esperat** | Health check que verifica DB, espai en disc, memòria, uploads accessibles |

---

## Fase 2: Reducció de deute (setmanes 4-8)

Objectiu: reduir la complexitat dels fitxers més problemàtics.

### Tests dels components crítics (Display, Trains)

| Camp | Detall |
|------|--------|
| **Problema** | DT-005 — cap test de components principals |
| **Dependències** | Fase 1 (linters, CI) |
| **Esforç** | M (~20h) |
| **Risc** | Mig — canvis d'API poden requerir actualització de tests |
| **Resultat esperat** | 10-15 tests nous: Display (render, poll, WS), Admin (CRUD bàsic), Trains (DnD) |

### Refactor routes.js en serveis

| Camp | Detall |
|------|--------|
| **Problema** | DT-002 — 1676 línies amb lògica de negoci, validació, transformació |
| **Dependències** | Cap (es pot fer incrementalment) |
| **Esforç** | M (~16h) |
| **Risc** | Mig — regressió si no hi ha tests de cobertura |
| **Resultat esperat** | Fitxers separats per domini: `trainService.js`, `operatorService.js`, `stationService.js`, `uploadService.js` |

**Pla de refactor:**
1. Extreure funcions auxiliars a `helpers.js`
2. Crear `trainService.js` amb CRUD + generació
3. Crear `operatorService.js` i `trainTypeService.js`
4. Crear `uploadService.js` amb validació MIME
5. Deixar `routes.js` només amb definició de rutes i middleware

### Unificar migracions a SQL

| Camp | Detall |
|------|--------|
| **Problema** | DT-003 — migracions inline a db.js + fitxers .sql, dues fonts de veritat |
| **Dependències** | Cap |
| **Esforç** | S (~6h) |
| **Risc** | Baix — les migracions existents són estables |
| **Resultat esperat** | Totes les migracions en fitxers .sql seqüencials, db.js sense ALTER TABLE inline |

### Eliminar codi mort

| Camp | Detall |
|------|--------|
| **Problema** | DT-013 — `routeService.ts` duplicat de `routeService.js`, no s'usa |
| **Dependències** | Cap |
| **Esforç** | XS (~15min) |
| **Risc** | Baix |
| **Resultat esperat** | Fitxer eliminat, cap import trencat |

---

## Fase 3: Evolució arquitectònica (setmanes 9-12)

### Refactor Admin.tsx en subcomponents

| Camp | Detall |
|------|--------|
| **Problema** | DT-001 — 3128 línies, component monolític |
| **Dependències** | Fase 2 (tests, serveis) |
| **Esforç** | L (~40h) |
| **Risc** | Mig — cal no trencar funcionalitat existent |
| **Resultat esperat** | 8-10 fitxers independents, lazy loading per tabs, codi més testeable |

**Pla de refactor:**
1. Extreure cada tab a un component independent (ja hi ha alguns: `GenerationPanel`, `RoutesPanel`, etc.)
2. Separar lògica de sidebar, dashboard, modals
3. Afegir lazy loading amb `React.lazy()` + `Suspense`
4. Mantenir compatibilitat d'URLs i estat

### Gestor d'estat global

| Camp | Detall |
|------|--------|
| **Problema** | DT-012 — dades recarregades a cada navegació, renders innecessaris |
| **Dependències** | Fase 3 (Admin refactor) |
| **Esforç** | M (~16h) |
| **Risc** | Baix — es pot afegir gradualment |
| **Resultat esperat** | Dades compartides entre vistes, menys peticions a l'API, millor experiència d'usuari |

**Recomanació:** [TanStack Query](https://tanstack.com/query/latest) per a dades d'API (caching, refetch, stale-while-revalidate) + [Zustand](https://github.com/pmndrs/zustand) per a estat d'UI (sidebar oberta, tab actiu, etc.)

### Migrar auth a tokens o OAuth2 proxy

| Camp | Detall |
|------|--------|
| **Problema** | DT-007 — Basic auth sense HTTPS, sense MFA, sense rotació |
| **Dependències** | Fase 1 (logs, health) |
| **Esforç** | M (~20h) |
| **Risc** | Mig — canvi de paradigma d'autenticació |
| **Resultat esperat** | Autenticació mitjançant JWT o proxy OAuth2 (Authelia, oauth2-proxy) |

**Opcions:**
1. **JWT local** — login POST /admin/login retorna token, middleware de验证
2. **OAuth2 proxy** — Authelia/oauth2-proxy davant de Nginx, zero canvis al backend
3. **API keys** — per a integracions automatitzades

---

## Pla 30-60-90 dies

### Dies 1-30: Estabilització i fonaments

| Setmana | Acció | Entregable verificable |
|---------|-------|------------------------|
| 1 | Backup DB automàtic + forçar canvi password + validar MIME uploads | Script `scripts/backup.sh` funcional, middleware de password per defecte, validació MIME als uploads |
| 2 | Logs estructurats amb pino/winston + Request-ID | `docker compose logs -f backend` mostra JSON, cada línia té `reqId` |
| 3 | ESLint + Prettier + GitHub Actions CI | `npm run lint` passa a backend i frontend, CI verd a cada PR |
| 4 | Tests bàsics de components frontend (Display, Trains) | 10 tests nous que passen a `npm test` del frontend |

**Fites verificables:**
- [ ] `scripts/backup.sh` existeix i funciona
- [ ] Engegar amb `ADMIN_PASSWORD=railboard` mostra warning al log
- [ ] Pujar un `.exe` amb extensió `.png` és rebutjat
- [ ] Logs tenen format JSON amb `level`, `reqId`, `msg`
- [ ] `npm run lint` executa sense errors
- [ ] GitHub Actions mostra check verd
- [ ] `npm test` frontend reporta ≥31 tests passant

### Dies 31-60: Reducció de deute tècnic

| Setmana | Acció | Entregable verificable |
|---------|-------|------------------------|
| 5-6 | Refactor routes.js en serveis | Fitxers `trainService.js`, `operatorService.js`, `stationService.js`, `uploadService.js` creats; `routes.js` < 500 línies |
| 7 | Unificar migracions SQL | Totes les migracions en fitxers `.sql` seqüencials, db.js sense ALTER TABLE inline |
| 8 | Validació d'uploads amb file-type + eliminar routeService.ts | `file-type` comprovant magic bytes; `routeService.ts` eliminat |

**Fites verificables:**
- [ ] `routes.js` només conté definicions de ruta i middleware
- [ ] `src/services/trainService.js` existeix amb CRUD
- [ ] Migracions només a `backend/migrations/*.sql`
- [ ] `routeService.ts` no existeix al repo
- [ ] Upload de fitxer amb bytes PNG però extensió .jpg és acceptat (contingut real)

### Dies 61-90: Evolució arquitectònica

| Setmana | Acció | Entregable verificable |
|---------|-------|------------------------|
| 9-10 | Refactor Admin.tsx en subcomponents | 8-10 fitxers independents, lazy loading, sidebar separada |
| 11 | Gestor d'estat global (TanStack Query / Zustand) | Dades compartides, menys renders, cache activa |
| 12 | Documentació i tancament | ROADMAP actualitzat, ADRs nous, docs d'arquitectura |

**Fites verificables:**
- [ ] Cada tab d'admin és un component independent
- [ ] Lazy loading actiu (els tabs es carreguen sota demanda)
- [ ] Navegar de /admin a /trains no recarrega operadors/tipus
- [ ] Docs d'arquitectura cobreixen decisions preses

---

## Quick wins

Accions d'esforç XS (≤2h) que es poden implementar en qualsevol moment.

| Acció | Benefici | Esforç | Risc | Arxils |
|-------|----------|--------|------|--------|
| Backup DB automàtic | Pèrdua zero de dades | XS | Baix | `docker-compose.yml`, `scripts/backup.sh` |
| Forçar canvi password per defecte | Seguretat millorada | XS | Baix | `.env.docker`, `index.js` |
| Validar MIME real dels uploads | Evita RCE via fitxer maliciós | XS | Baix | `routes.js` (multer) |
| Eliminar `routeService.ts` | Codi net, menys confusió | XS | Baix | `backend/src/services/` |
| Afegir `.nvmrc` | Experiència desenvolupador consistent | XS | Baix | `.nvmrc` (contingut: `20`) |
| Afegir `X-Request-ID` middleware | Depuració i correlació de logs | XS | Baix | `index.js` |
| Afegir `.editorconfig` | Format consistent entre editors | XS | Baix | `.editorconfig` |
| Reemplaçar `@rolldown/binding-darwin-arm64` per devDependency opcional | Evita errors d'instal·lació | XS | Baix | `package.json` ambdós |

---

## Registre de riscos

| ID | Risc | Causa | Probabilitat | Impacte | Mitigació | Contingència |
|----|------|-------|:------------:|:-------:|-----------|--------------|
| R-01 | Pèrdua de dades | Fallada volume Docker, corrupció SQLite | Baixa | Crític | Backup automàtic (cron + script) a volume separat | Restaurar des de backup, verificar integritat |
| R-02 | Accés no autoritzat | Contrasenya per defecte, Basic auth sense HTTPS | Mitjana | Alt | Forçar canvi de password al primer inici, migrar a tokens | Revocar accés, canviar password, rotar secrets |
| R-03 | RCE via upload | Fitxer maliciós amb extensió vàlida (ex: .png amb shell script) | Baixa | Crític | Validar MIME real amb `file-type`, límit de mida, escaneig | Revisar logs, eliminar fitxer sospitós, audit trail |
| R-04 | Bloqueig per mantenibilitat | Admin.tsx + routes.js massius (4804 línies combinades) | Alta | Mig | Refactor progressiu per fases | Congelar noves features fins a completar refactor |
| R-05 | Pèrdua de coneixement | Cap documentació de decisions arquitectòniques, onboarding inexistent | Mitjana | Alt | ADRs per a decisions importants, ONBOARDING.md, diagrames d'arquitectura | Mantenir almenys ANALYSIS.md actualitzat |
| R-06 | Incompatibilitat Node 22+ | Dependències natives (better-sqlite3) poden no compilar en versions futures | Mitjana | Mig | Testjar amb Node 22 a CI, pin Node 20 al Dockerfile | Actualitzar better-sqlite3, o usar versió LTS al contenidor |
| R-07 | Regressió per refactors | Canvis a routes.js o Admin.tsx sense tests de cobertura | Mitjana | Alt | Tests abans de refactor (Fase 2 abans de Fase 3), CI amb coverage gate | Feature flags per a refactors grans, rollback plan |

---

## Resum visual

```
Setmana 1          Setmana 2-3         Setmana 4-8          Setmana 9-12
─────────────────  ─────────────────  ───────────────────  ───────────────────
┌────────────────┐ ┌────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Backup DB      │ │ Logs (pino)    │ │ Tests frontend   │ │ Refactor Admin   │
│ Forçar pwd     │ │ ESLint+CI      │ │ Refactor routes  │ │ Gestor estat     │
│ Validar MIME   │ │ Health check   │ │ Unificar migr.   │ │ Auth tokens      │
└────────────────┘ └────────────────┘ └──────────────────┘ └──────────────────┘
     Riscos crítics    Qualitat i         Reducció            Evolució
     eliminats         observabilitat     de deute            arquitectònica
```

> **Nota:** Aquest roadmap és un document viu. Les prioritats i l'abast de cada fase s'han de revisar periòdicament basant-se en el context del projecte i les necessitats canviants.
