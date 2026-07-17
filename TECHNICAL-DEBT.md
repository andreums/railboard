# Deute Tècnic — RailBoard

## DT-001: Admin.tsx monolític (3128 línies)

- **Categoria:** Deute de codi / arquitectura
- **Component afectat:** `frontend/src/pages/Admin.tsx`
- **Descripció:** El component `Admin` conté tota la lògica d'administració en un sol fitxer de 3128 línies: gestió d'estat, handlers, renders condicionals per a 14 pestanyes, validació, importació, TTS, etc. Això el fa pràcticament impossible de testejar i difícil de mantenir.
- **Evidència:** `frontend/src/pages/Admin.tsx` — 3128 línies totals
- **Origen:** Creixement progressiu sense refactorització. Cada funcionalitat nova s'afegia com una pestanya més al mateix component.
- **Impacte actual:** Les revisions de codi són lentes (cal entendre tot el context), alta probabilitat de regressions, dificultat per aïllar bugs.
- **Risc futur:** Amb cada nova pestanya el problema s'agreuja. Pot arribar a ser inmanejable.
- **Probabilitat:** Alta
- **Severitat:** Crítica
- **Esforç:** L (large)
- **Solució recomanada:** Dividir en subcomponents per pestanya (StationTab, TrainsTab, RoutesTab, etc.), cadascun amb el seu propi fitxer i responsabilitat. Extreure la lògica de negoci a hooks o serveis.

## DT-002: routes.js amb totes les responsabilitats (1676 línies)

- **Categoria:** Deute de codi / arquitectura
- **Component afectat:** `backend/src/routes.js`
- **Descripció:** El fitxer de routes conté 1676 línies barrejant definició d'endpoints, lògica de negoci (generació de trens, càlculs d'horaris), bancs d'observacions multilingüe, helpers de normalització, i configuració de multer.
- **Evidència:** `backend/src/routes.js` — 1676 línies totals. Per exemple, `OBSERVATION_BANK` (línies 208-646), `pickObservation` (línies 687-717), `generate-random-train` (línies 1084-1222).
- **Origen:** Refactorització incompleta. Originalment tot era a routes.js; es van començar a extreure serveis però la major part de la lògica va quedar al router.
- **Impacte actual:** Testing per unitats difícil (cal montar l'aplicació Express sencera). Modificacions arriscades per acoblament.
- **Risc futur:** Errors difícils de localitzar. Duplicació de lògica si altres endpoints necessiten la mateixa funcionalitat.
- **Probabilitat:** Mitja
- **Severitat:** Alta
- **Esforç:** M (medium)
- **Solució recomanada:** Extreure serveis: `trainService.js` (generació, càlculs), `operatorService.js`, `observationService.js` (banc d'observacions), `normalizationService.js` (helpers). Deixar routes.js només per a definició d'endpoints i delegació.

## DT-003: Migracions inline a db.js

- **Categoria:** Deute de dades
- **Component afectat:** `backend/src/db.js`
- **Descripció:** Les migracions d'esquema de base de dades es fan mitjançant `ALTER TABLE` condicionals amb `PRAGMA table_info` directament al codi de `db.js`. Això crea dues fonts de veritat per a l'esquema: el `CREATE TABLE IF NOT EXISTS` inicial i les migracions inline posteriors.
- **Evidència:** `backend/src/db.js` línies 82-131: blocs de `PRAGMA table_info` seguits de `ALTER TABLE`. Exemple: línies 82-86 (`sort_order`), 88-91 (`observations`), 109-112 (`station_id`), 121-124 (`destination_icon_url`), 126-130 (`custom_icon_url`, `icon_mode`).
- **Origen:** Evolució ràpida de l'esquema sense un sistema de migracions formal.
- **Impacte actual:** Dificultat per saber l'estat real de l'esquema només llegint el codi. Dues fonts de veritat. Les migracions no són reproduïbles.
- **Risc futur:** Esquemes inconsistents entre entorns. Impossible fer rollback.
- **Probabilitat:** Mitja
- **Severitat:** Mitja
- **Esforç:** S (small)
- **Solució recomanada:** Unificar a fitxers `.sql` de migració numerats (ex. `migrations/001_initial.sql`, `migrations/002_add_sort_order.sql`) i executar-los en ordre amb un migrador senzill.

## DT-004: Tipus duplicats backend/frontend

- **Categoria:** Deute de dades
- **Component afectat:** `backend/src/types/railRoute.ts` i `frontend/src/types/railRoute.ts`
- **Descripció:** La interfície `RailRoute` està definida idènticament al backend i al frontend. Qualsevol canvi en un requereix canvi manual a l'altre.
- **Evidència:** `backend/src/types/railRoute.ts:1-12`, `frontend/src/types/railRoute.ts:1-12`. Ambdós fitxers tenen exactament el mateix contingut (11 camps + `notes?`).
- **Origen:** Inici del projecte sense considerar compartir tipus.
- **Impacte actual:** Poden divergir. Si s'afegeix un camp a un costat i no a l'altre, es poden produir errors en temps d'execució.
- **Risc futur:** Bugs silenciosos per desajust d'interfícies.
- **Probabilitat:** Baixa
- **Severitat:** Baixa
- **Esforç:** XS
- **Solució recomanada:** Compartir tipus via un paquet compartit (monorepo) o generar-los automàticament des del backend (ex. `openapi-typescript`).

## DT-005: Sense tests de frontend significatius

- **Categoria:** Deute de testing
- **Component afectat:** `frontend/src/components/__tests__/`, `frontend/src/lib/__tests__/`
- **Descripció:** Només hi ha 3 tests al frontend: `StatusPill.test.tsx`, `Clock.test.tsx`, `i18n.test.ts`. Cap dels components principals està cobert: Display, Admin, TrainRow, etc. El backend té 4 fitxers de test (unitari, integració, e2e) però amb cobertura limitada.
- **Evidència:** `frontend/src/components/__tests__/StatusPill.test.tsx`, `frontend/src/components/__tests__/Clock.test.tsx`, `frontend/src/lib/__tests__/i18n.test.ts`. Backend: `backend/src/__tests__/` (4 fitxers).
- **Origen:** Priorització de funcionalitat sobre qualitat en etapes primerenques.
- **Impacte actual:** Sense xarxa de seguretat per al frontend. Les refactoritzacions són arriscades. Regressions freqüents no detectades.
- **Risc futur:** El projecte no es pot refactoritzar amb confiança.
- **Probabilitat:** Alta
- **Severitat:** Crítica
- **Esforç:** XL (extra large)
- **Solució recomanada:** Tests de Display (renderitzat, estats buits, errors), Admin (cada pestanya per separat), Trains (CRUD, filtres). Tests d'integració per als fluxos complets (generar tren, canviar estat, etc.).

## DT-006: Sense linting/format

- **Categoria:** Deute d'experiència desenvolupador
- **Component afectat:** Tot el projecte (backend + frontend)
- **Descripció:** No hi ha configuració de ESLint, Prettier, ni cap eina de linting o format. No hi ha scripts de `lint` o `format` al `package.json`.
- **Impacte actual:** Inconsistències d'estil, espais en blanc inconsistents, imports no ordenats, errors evitables (ex. variables no usades, comparacions insegures).
- **Risc futur:** Disminució de la qualitat del codi amb el temps. Fricció en les revisions.
- **Probabilitat:** Mitja
- **Severitat:** Mitja
- **Esforç:** XS
- **Solució recomanada:** Afegir ESLint + Prettier. Configurar hooks de pre-commit (husky/lint-staged).

## DT-007: Auth bàsica HTTP

- **Categoria:** Deute de seguretat
- **Component afectat:** `backend/src/routes.js`
- **Descripció:** L'autenticació d'administració utilitza HTTP Basic Auth amb `express-basic-auth`. Les credencials es transmeten en text pla (Base64) a cada petició. El password per defecte és "railboard".
- **Evidència:** `backend/src/routes.js` línies 21-27: `ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "railboard"`, `adminAuth = basicAuth({ users: { admin: ADMIN_PASSWORD }, challenge: true })`.
- **Origen:** Solució ràpida per protegir l'admin.
- **Impacte actual:** Vulnerable a escolta de credencials si no hi ha HTTPS. Password per defecte conegut.
- **Risc futur:** Si el servei s'exposa sense HTTPS, les credencials viatgen en clar.
- **Probabilitat:** Mitja
- **Severitat:** Crítica (si no hi ha HTTPS) / Alta (amb HTTPS)
- **Esforç:** S
- **Solució recomanada:** Forçar HTTPS. Implementar autenticació basada en tokens (JWT) o sessions amb cookies httpOnly. Canvi de password obligatori al primer inici.

## DT-008: Upload sense validació de contingut

- **Categoria:** Deute de seguretat
- **Component afectat:** `backend/src/routes.js` (configuració multer)
- **Descripció:** El filtre de multer només valida l'extensió del fitxer i el `mimetype` del `Content-Type` de la petició HTTP, que és fàcilment falsejable. No es fa una validació real del contingut del fitxer (ex. magic bytes).
- **Evidència:** `backend/src/routes.js` línies 29-52: `fileFilter` de multer comprova `file.mimetype` i `path.extname(file.originalname)`. Línies 54-69: mateix patró per a àudio.
- **Origen:** Implementació ràpida de càrrega de fitxers.
- **Impacte actual:** Potencial RCE si un atacant puja un fitxer maliciós amb extensió i Content-Type falsos.
- **Risc futur:** Si el directori d'uploads és accessible i els fitxers són servits, qualsevol binari es pot executar.
- **Probabilitat:** Mitja
- **Severitat:** Alta
- **Esforç:** XS
- **Solució recomanada:** Validar magic bytes amb `file-type` o similar. Emmagatzemar fitxers fora del document root o amb noms no endevinables (ja es fa). Afegir Content-Disposition: attachment per defecte.

## DT-009: Logs no estructurats

- **Categoria:** Deute d'observabilitat
- **Component afectat:** Tot el projecte (backend)
- **Descripció:** S'utilitza `console.log` i `console.error` sense cap estructura, nivells, o format. No hi ha una llibreria de logging, ni logs rotatius, ni correlació de peticions.
- **Evidència:** Ocurrències de `console.log` a `backend/src/routes.js` (linia 88 per exemple: `console.log(`rateLimit max=${rateLimitMax}...`)``), `backend/src/index.js` línies 86-88, `backend/src/seed.js` línies 69, 206.
- **Origen:** Manca d'infraestructura d'observabilitat.
- **Impacte actual:** Difícil depurar errors en producció. Sense traçabilitat.
- **Risc futur:** Impossibilitat de diagnosticar problemes complexos.
- **Probabilitat:** Alta
- **Severitat:** Mitja
- **Esforç:** XS
- **Solució recomanada:** Adoptar una llibreria de logging (pino, winston). Usar `morgan` per a logs HTTP. Estructurar logs en JSON.

## DT-010: Sense backup DB

- **Categoria:** Deute d'infraestructura
- **Component afectat:** `backend/src/db.js` — fitxer `data.db`
- **Descripció:** No hi ha cap sistema de còpia de seguretat per a la base de dades SQLite. Si el fitxer es corromp o se sobreescriu, les dades es perden permanentment.
- **Impacte actual:** Pèrdua total de dades possible (configuració de displays, trens, operadors, tipus, places, serveis).
- **Risc futur:** Pèrdua irreversible d'informació en cas de fallada del disc, error humà, o bug.
- **Probabilitat:** Baixa
- **Severitat:** Crítica
- **Esforç:** XS
- **Solució recomanada:** Script de backup automàtic (ex. `.backup` de SQLite via cron). O documentar procediment manual.

## DT-011: Valors màgics

- **Categoria:** Deute de codi
- **Component afectat:** `backend/src/seed.js`, `backend/src/db.js`
- **Descripció:** Hi ha valors codificats sense constant ni configuració. Exemple notori: `station_id: 1` al seed (línies 194, 204), `language: "es"` per defecte en múltiples llocs, strings de constants com `"Scheduled"`, `"Delayed"` repetides.
- **Evidència:** `backend/src/seed.js` línia 194: `station_id: 1`
- **Origen:** Desenvolupament ràpid.
- **Impacte actual:** Dificultat per canviar comportament, errors per inconsistència (ex. un "Scheduled" escrit com "scheduled").
- **Risc futur:** Errors subtils en canviar configuracions.
- **Probabilitat:** Baixa
- **Severitat:** Baixa
- **Esforç:** XS
- **Solució recomanada:** Definir constants per a valors repetits i ID de referència. Usar enums de TypeScript.

## DT-012: Sense gestor d'estat global

- **Categoria:** Deute d'arquitectura
- **Component afectat:** `frontend/src/pages/Admin.tsx`
- **Descripció:** L'estat de l'Admin es gestiona amb `useState` local dins del component, amb efectes que recarreguen totes les dades en cascade. Quan un subcomponent modifica alguna cosa, es recarrega tot el dashboard. No hi ha una capa d'estat global (Context API, Zustand, Redux) que eviti re-fetches innecessaris.
- **Evidència:** `Admin.tsx` línies 298-346: ~50 `useState` crides. Línies 354-417: `refresh()` que recarrega tot. Línies 419-429: `useEffect` que crida `refresh`.
- **Origen:** Prototipat ràpid, sense considerar compartició d'estat.
- **Impacte actual:** Re-renders innecessaris de tot l'arbre de components. Dades recarregades sencers quan només canvia una entitat.
- **Risc futur:** Degradació de rendiment a mesura que creix el nombre d'entitats.
- **Probabilitat:** Mitja
- **Severitat:** Mitja
- **Esforç:** M
- **Solució recomanada:** Adoptar Zustand o React Context per a l'estat compartit. Separar lògica de dades en hooks personalitzats amb SWR/TanStack Query per a caching i revalidació intel·ligent.

## DT-013: routeService.ts codi mort

- **Categoria:** Deute de codi
- **Component afectat:** `backend/src/services/routeService.ts`
- **Descripció:** Existeix una versió TypeScript de `routeService.ts` (139 línies, tipada) que no és importada per cap fitxer JS/TS del projecte. L'únic fitxer que l'importa és `routes.js`, que ho fa des de `routeService.js` (la versió JS no tipada).
- **Evidència:** `backend/src/services/routeService.ts` — fitxer complet. `backend/src/services/routeService.js` — versió JS equivalent (182 línies) importada a `routes.js:17`.
- **Origen:** Migració incompleta de JS a TS.
- **Impacte actual:** Dos fitxers per mantenir. El fitxer TS pot divergir de la versió JS en ús. Confusió per a desenvolupadors.
- **Risc futur:** Un desenvolupador podria modificar el .TS pensant que està actiu.
- **Probabilitat:** Baixa
- **Severitat:** Baixa
- **Esforç:** XS
- **Solució recomanada:** Eliminar el fitxer .TS (o completar la migració a TypeScript i eliminar el .JS).

## DT-014: Service Worker sense versionat de cache

- **Categoria:** Deute de rendiment
- **Component afectat:** `frontend/public/sw.js`
- **Descripció:** El Service Worker usa un nom de cache fix (`"railboard-v1"`). Quan es canvia el Service Worker, no hi ha un mecanisme de versionat automàtic; la cache vella només s'esborra si el nom és diferent. L'usuari pot seguir servint assets antics.
- **Evidència:** `frontend/public/sw.js` línia 1: `const CACHE = "railboard-v1";` Línies 14-21: `activate` event esborra caches que no coincideixin amb `CACHE`.
- **Origen:** Implementació bàsica de PWA.
- **Impacte actual:** Si es canvia el SW sense canviar el nom de cache, els assets vells poden servir-se fins que l'usuari tanqui la pestanya. Si es canvia el nom manualment, la cache anterior es neteja correctament.
- **Risc futur:** Usuaris amb versió obsoleta de l'aplicació per no invalidar la cache.
- **Probabilitat:** Mitja
- **Severitat:** Baixa
- **Esforç:** S
- **Solució recomanada:** Incorporar hash/versió al nom de cache generat automàticament (ex. `railboard-${BUILD_ID}`) o utilitzar un plugin de Workbox a l'eina de build.

---

## Matriu de Priorització

| ID | Deute | Severitat | Esforç | Prio | Justificació |
|---|---|---|---|---|---|
| DT-001 | Admin.tsx monolític | Crítica | L | 1 | Bloqueja el desenvolupament, revisions lentes, regressions freqüents |
| DT-005 | Sense tests frontend | Crítica | XL | 1 | Sense xarxa de seguretat; risc alt de regressió en cada canvi |
| DT-007 | Auth bàsica HTTP | Crítica | S | 2 | Credencials en clar, password per defecte conegut |
| DT-010 | Sense backup DB | Crítica | XS | 2 | Pèrdua total de dades possible |
| DT-002 | routes.js monolític | Alta | M | 3 | Testing difícil, modificacions arriscades |
| DT-008 | Upload sense validació | Alta | XS | 3 | Potencial RCE per contingut maliciós |
| DT-003 | Migracions inline | Mitja | S | 4 | Dues fonts de veritat per a l'esquema |
| DT-009 | Logs no estructurats | Mitja | XS | 4 | Sense observabilitat en producció |
| DT-012 | Sense gestor d'estat | Mitja | M | 4 | Rendiment degradat, re-fetches innecessaris |
| DT-014 | SW sense versionat | Baixa | S | 5 | Cache obsoleta, baix impacte |
| DT-006 | Sense linting/format | Mitja | XS | 5 | Inconsistències d'estil, sense qualitat de codi |
| DT-004 | Tipus duplicats | Baixa | XS | 6 | Risc de divergència, baixa probabilitat |
| DT-011 | Valors màgics | Baixa | XS | 6 | Errors subtils, baix impacte |
| DT-013 | routeService.ts codi mort | Baixa | XS | 6 | Confusió, no afecta el funcionament |
