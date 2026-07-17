# Deuda Técnica — RailBoard

## DT-001: Admin.tsx monolítico (3128 líneas)

- **Categoría:** Deuda de código / arquitectura
- **Componente afectado:** `frontend/src/pages/Admin.tsx`
- **Descripción:** El componente `Admin` contiene toda la lógica de administración en un solo archivo de 3128 líneas: gestión de estado, handlers, renders condicionales para 14 pestañas, validación, importación, TTS, etc. Esto lo hace prácticamente imposible de testear y difícil de mantener.
- **Evidencia:** `frontend/src/pages/Admin.tsx` — 3128 líneas totales
- **Origen:** Crecimiento progresivo sin refactorización. Cada funcionalidad nueva se añadía como una pestaña más al mismo componente.
- **Impacto actual:** Las revisiones de código son lentas (hay que entender todo el contexto), alta probabilidad de regresiones, dificultad para aislar bugs.
- **Riesgo futuro:** Con cada nueva pestaña el problema se agrava. Puede llegar a ser inmanejable.
- **Probabilidad:** Alta
- **Severidad:** Crítica
- **Esfuerzo:** L (large)
- **Solución recomendada:** Dividir en subcomponentes por pestaña (StationTab, TrainsTab, RoutesTab, etc.), cada uno con su propio archivo y responsabilidad. Extraer la lógica de negocio a hooks o servicios.

## DT-002: routes.js con todas las responsabilidades (1676 líneas)

- **Categoría:** Deuda de código / arquitectura
- **Componente afectado:** `backend/src/routes.js`
- **Descripción:** El archivo de routes contiene 1676 líneas mezclando definición de endpoints, lógica de negocio (generación de trenes, cálculos de horarios), bancos de observaciones multilingüe, helpers de normalización, y configuración de multer.
- **Evidencia:** `backend/src/routes.js` — 1676 líneas totales. Por ejemplo, `OBSERVATION_BANK` (líneas 208-646), `pickObservation` (líneas 687-717), `generate-random-train` (líneas 1084-1222).
- **Origen:** Refactorización incompleta. Originalmente todo estaba en routes.js; se empezaron a extraer servicios pero la mayor parte de la lógica quedó en el router.
- **Impacto actual:** Testing por unidades difícil (hay que montar la aplicación Express completa). Modificaciones arriesgadas por acoplamiento.
- **Riesgo futuro:** Errores difíciles de localizar. Duplicación de lógica si otros endpoints necesitan la misma funcionalidad.
- **Probabilidad:** Media
- **Severidad:** Alta
- **Esfuerzo:** M (medium)
- **Solución recomendada:** Extraer servicios: `trainService.js` (generación, cálculos), `operatorService.js`, `observationService.js` (banco de observaciones), `normalizationService.js` (helpers). Dejar routes.js solo para definición de endpoints y delegación.

## DT-003: Migraciones inline en db.js

- **Categoría:** Deuda de datos
- **Componente afectado:** `backend/src/db.js`
- **Descripción:** Las migraciones de esquema de base de datos se hacen mediante `ALTER TABLE` condicionales con `PRAGMA table_info` directamente en el código de `db.js`. Esto crea dos fuentes de verdad para el esquema: el `CREATE TABLE IF NOT EXISTS` inicial y las migraciones inline posteriores.
- **Evidencia:** `backend/src/db.js` líneas 82-131: bloques de `PRAGMA table_info` seguidos de `ALTER TABLE`. Ejemplo: líneas 82-86 (`sort_order`), 88-91 (`observations`), 109-112 (`station_id`), 121-124 (`destination_icon_url`), 126-130 (`custom_icon_url`, `icon_mode`).
- **Origen:** Evolución rápida del esquema sin un sistema de migraciones formal.
- **Impacto actual:** Dificultad para saber el estado real del esquema solo leyendo el código. Dos fuentes de verdad. Las migraciones no son reproducibles.
- **Riesgo futuro:** Esquemas inconsistentes entre entornos. Imposible hacer rollback.
- **Probabilidad:** Media
- **Severidad:** Media
- **Esfuerzo:** S (small)
- **Solución recomendada:** Unificar en archivos `.sql` de migración numerados (ej. `migrations/001_initial.sql`, `migrations/002_add_sort_order.sql`) y ejecutarlos en orden con un migrador sencillo.

## DT-004: Tipos duplicados backend/frontend

- **Categoría:** Deuda de datos
- **Componente afectado:** `backend/src/types/railRoute.ts` y `frontend/src/types/railRoute.ts`
- **Descripción:** La interfaz `RailRoute` está definida idénticamente en el backend y en el frontend. Cualquier cambio en uno requiere cambio manual en el otro.
- **Evidencia:** `backend/src/types/railRoute.ts:1-12`, `frontend/src/types/railRoute.ts:1-12`. Ambos archivos tienen exactamente el mismo contenido (11 campos + `notes?`).
- **Origen:** Inicio del proyecto sin considerar compartir tipos.
- **Impacto actual:** Pueden divergir. Si se añade un campo en un lado y no en el otro, se pueden producir errores en tiempo de ejecución.
- **Riesgo futuro:** Bugs silenciosos por desajuste de interfaces.
- **Probabilidad:** Baja
- **Severidad:** Baja
- **Esfuerzo:** XS
- **Solución recomendada:** Compartir tipos via un paquete compartido (monorepo) o generarlos automáticamente desde el backend (ej. `openapi-typescript`).

## DT-005: Sin tests de frontend significativos

- **Categoría:** Deuda de testing
- **Componente afectado:** `frontend/src/components/__tests__/`, `frontend/src/lib/__tests__/`
- **Descripción:** Solo hay 3 tests en el frontend: `StatusPill.test.tsx`, `Clock.test.tsx`, `i18n.test.ts`. Ninguno de los componentes principales está cubierto: Display, Admin, TrainRow, etc. El backend tiene 4 archivos de test (unitario, integración, e2e) pero con cobertura limitada.
- **Evidencia:** `frontend/src/components/__tests__/StatusPill.test.tsx`, `frontend/src/components/__tests__/Clock.test.tsx`, `frontend/src/lib/__tests__/i18n.test.ts`. Backend: `backend/src/__tests__/` (4 archivos).
- **Origen:** Priorización de funcionalidad sobre calidad en etapas tempranas.
- **Impacto actual:** Sin red de seguridad para el frontend. Las refactorizaciones son arriesgadas. Regresiones frecuentes no detectadas.
- **Riesgo futuro:** El proyecto no se puede refactorizar con confianza.
- **Probabilidad:** Alta
- **Severidad:** Crítica
- **Esfuerzo:** XL (extra large)
- **Solución recomendada:** Tests de Display (renderizado, estados vacíos, errores), Admin (cada pestaña por separado), Trains (CRUD, filtros). Tests de integración para los flujos completos (generar tren, cambiar estado, etc.).

## DT-006: Sin linting/format

- **Categoría:** Deuda de experiencia desarrollador
- **Componente afectado:** Todo el proyecto (backend + frontend)
- **Descripción:** No hay configuración de ESLint, Prettier, ni ninguna herramienta de linting o formato. No hay scripts de `lint` o `format` en el `package.json`.
- **Impacto actual:** Inconsistencias de estilo, espacios en blanco inconsistentes, imports no ordenados, errores evitables (ej. variables no usadas, comparaciones inseguras).
- **Riesgo futuro:** Disminución de la calidad del código con el tiempo. Fricción en las revisiones.
- **Probabilidad:** Media
- **Severidad:** Media
- **Esfuerzo:** XS
- **Solución recomendada:** Añadir ESLint + Prettier. Configurar hooks de pre-commit (husky/lint-staged).

## DT-007: Auth básica HTTP

- **Categoría:** Deuda de seguridad
- **Componente afectado:** `backend/src/routes.js`
- **Descripción:** La autenticación de administración utiliza HTTP Basic Auth con `express-basic-auth`. Las credenciales se transmiten en texto plano (Base64) en cada petición. La contraseña por defecto es "railboard".
- **Evidencia:** `backend/src/routes.js` líneas 21-27: `ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "railboard"`, `adminAuth = basicAuth({ users: { admin: ADMIN_PASSWORD }, challenge: true })`.
- **Origen:** Solución rápida para proteger el admin.
- **Impacto actual:** Vulnerable a escucha de credenciales si no hay HTTPS. Contraseña por defecto conocida.
- **Riesgo futuro:** Si el servicio se expone sin HTTPS, las credenciales viajan en claro.
- **Probabilidad:** Media
- **Severidad:** Crítica (si no hay HTTPS) / Alta (con HTTPS)
- **Esfuerzo:** S
- **Solución recomendada:** Forzar HTTPS. Implementar autenticación basada en tokens (JWT) o sesiones con cookies httpOnly. Cambio de contraseña obligatorio al primer inicio.

## DT-008: Upload sin validación de contenido

- **Categoría:** Deuda de seguridad
- **Componente afectado:** `backend/src/routes.js` (configuración multer)
- **Descripción:** El filtro de multer solo valida la extensión del archivo y el `mimetype` del `Content-Type` de la petición HTTP, que es fácilmente falseable. No se hace una validación real del contenido del archivo (ej. magic bytes).
- **Evidencia:** `backend/src/routes.js` líneas 29-52: `fileFilter` de multer comprueba `file.mimetype` y `path.extname(file.originalname)`. Líneas 54-69: mismo patrón para audio.
- **Origen:** Implementación rápida de carga de archivos.
- **Impacto actual:** Potencial RCE si un atacante sube un archivo malicioso con extensión y Content-Type falsos.
- **Riesgo futuro:** Si el directorio de uploads es accesible y los archivos son servidos, cualquier binario se puede ejecutar.
- **Probabilidad:** Media
- **Severidad:** Alta
- **Esfuerzo:** XS
- **Solución recomendada:** Validar magic bytes con `file-type` o similar. Almacenar archivos fuera del document root o con nombres no adivinables (ya se hace). Añadir Content-Disposition: attachment por defecto.

## DT-009: Logs no estructurados

- **Categoría:** Deuda de observabilidad
- **Componente afectado:** Todo el proyecto (backend)
- **Descripción:** Se utiliza `console.log` y `console.error` sin ninguna estructura, niveles, o formato. No hay una librería de logging, ni logs rotativos, ni correlación de peticiones.
- **Evidencia:** Ocurrencias de `console.log` en `backend/src/routes.js` (línea 88 por ejemplo: `console.log(\`rateLimit max=${rateLimitMax}...\`)`), `backend/src/index.js` líneas 86-88, `backend/src/seed.js` líneas 69, 206.
- **Origen:** Falta de infraestructura de observabilidad.
- **Impacto actual:** Difícil depurar errores en producción. Sin trazabilidad.
- **Riesgo futuro:** Imposibilidad de diagnosticar problemas complejos.
- **Probabilidad:** Alta
- **Severidad:** Media
- **Esfuerzo:** XS
- **Solución recomendada:** Adoptar una librería de logging (pino, winston). Usar `morgan` para logs HTTP. Estructurar logs en JSON.

## DT-010: Sin backup DB

- **Categoría:** Deuda de infraestructura
- **Componente afectado:** `backend/src/db.js` — archivo `data.db`
- **Descripción:** No hay ningún sistema de copia de seguridad para la base de datos SQLite. Si el archivo se corrompe o se sobrescribe, los datos se pierden permanentemente.
- **Impacto actual:** Pérdida total de datos posible (configuración de displays, trenes, operadores, tipos, plazas, servicios).
- **Riesgo futuro:** Pérdida irreversible de información en caso de fallo del disco, error humano, o bug.
- **Probabilidad:** Baja
- **Severidad:** Crítica
- **Esfuerzo:** XS
- **Solución recomendada:** Script de backup automático (ej. `.backup` de SQLite via cron). O documentar procedimiento manual.

## DT-011: Valores mágicos

- **Categoría:** Deuda de código
- **Componente afectado:** `backend/src/seed.js`, `backend/src/db.js`
- **Descripción:** Hay valores codificados sin constante ni configuración. Ejemplo notorio: `station_id: 1` en el seed (líneas 194, 204), `language: "es"` por defecto en múltiples sitios, strings de constantes como `"Scheduled"`, `"Delayed"` repetidas.
- **Evidencia:** `backend/src/seed.js` línea 194: `station_id: 1`
- **Origen:** Desarrollo rápido.
- **Impacto actual:** Dificultad para cambiar comportamiento, errores por inconsistencia (ej. un "Scheduled" escrito como "scheduled").
- **Riesgo futuro:** Errores sutiles al cambiar configuraciones.
- **Probabilidad:** Baja
- **Severidad:** Baja
- **Esfuerzo:** XS
- **Solución recomendada:** Definir constantes para valores repetidos e ID de referencia. Usar enums de TypeScript.

## DT-012: Sin gestor de estado global

- **Categoría:** Deuda de arquitectura
- **Componente afectado:** `frontend/src/pages/Admin.tsx`
- **Descripción:** El estado del Admin se gestiona con `useState` local dentro del componente, con efectos que recargan todos los datos en cascada. Cuando un subcomponente modifica algo, se recarga todo el dashboard. No hay una capa de estado global (Context API, Zustand, Redux) que evite re-fetches innecesarios.
- **Evidencia:** `Admin.tsx` líneas 298-346: ~50 llamadas a `useState`. Líneas 354-417: `refresh()` que recarga todo. Líneas 419-429: `useEffect` que llama a `refresh`.
- **Origen:** Prototipado rápido, sin considerar compartición de estado.
- **Impacto actual:** Re-renders innecesarios de todo el árbol de componentes. Datos recargados enteros cuando solo cambia una entidad.
- **Riesgo futuro:** Degradación de rendimiento a medida que crece el número de entidades.
- **Probabilidad:** Media
- **Severidad:** Media
- **Esfuerzo:** M
- **Solución recomendada:** Adoptar Zustand o React Context para el estado compartido. Separar lógica de datos en hooks personalizados con SWR/TanStack Query para caching y revalidación inteligente.

## DT-013: routeService.ts código muerto

- **Categoría:** Deuda de código
- **Componente afectado:** `backend/src/services/routeService.ts`
- **Descripción:** Existe una versión TypeScript de `routeService.ts` (139 líneas, tipada) que no es importada por ningún archivo JS/TS del proyecto. El único archivo que lo importa es `routes.js`, que lo hace desde `routeService.js` (la versión JS no tipada).
- **Evidencia:** `backend/src/services/routeService.ts` — archivo completo. `backend/src/services/routeService.js` — versión JS equivalente (182 líneas) importada en `routes.js:17`.
- **Origen:** Migración incompleta de JS a TS.
- **Impacto actual:** Dos archivos que mantener. El archivo TS puede divergir de la versión JS en uso. Confusión para desarrolladores.
- **Riesgo futuro:** Un desarrollador podría modificar el .TS pensando que está activo.
- **Probabilidad:** Baja
- **Severidad:** Baja
- **Esfuerzo:** XS
- **Solución recomendada:** Eliminar el archivo .TS (o completar la migración a TypeScript y eliminar el .JS).

## DT-014: Service Worker sin versionado de cache

- **Categoría:** Deuda de rendimiento
- **Componente afectado:** `frontend/public/sw.js`
- **Descripción:** El Service Worker usa un nombre de cache fijo (`"railboard-v1"`). Cuando se cambia el Service Worker, no hay un mecanismo de versionado automático; la cache vieja solo se borra si el nombre es diferente. El usuario puede seguir sirviendo assets antiguos.
- **Evidencia:** `frontend/public/sw.js` línea 1: `const CACHE = "railboard-v1";` Líneas 14-21: evento `activate` borra caches que no coincidan con `CACHE`.
- **Origen:** Implementación básica de PWA.
- **Impacto actual:** Si se cambia el SW sin cambiar el nombre de cache, los assets viejos pueden servirse hasta que el usuario cierre la pestaña. Si se cambia el nombre manualmente, la cache anterior se limpia correctamente.
- **Riesgo futuro:** Usuarios con versión obsoleta de la aplicación por no invalidar la cache.
- **Probabilidad:** Media
- **Severidad:** Baja
- **Esfuerzo:** S
- **Solución recomendada:** Incorporar hash/versión al nombre de cache generado automáticamente (ej. `railboard-${BUILD_ID}`) o utilizar un plugin de Workbox en la herramienta de build.

---

## Matriz de Priorización

| ID | Deuda | Severidad | Esfuerzo | Prio | Justificación |
|----|-------|-----------|----------|------|---------------|
| DT-001 | Admin.tsx monolítico | Crítica | L | 1 | Bloquea el desarrollo, revisiones lentas, regresiones frecuentes |
| DT-005 | Sin tests frontend | Crítica | XL | 1 | Sin red de seguridad; riesgo alto de regresión en cada cambio |
| DT-007 | Auth básica HTTP | Crítica | S | 2 | Credenciales en claro, contraseña por defecto conocida |
| DT-010 | Sin backup DB | Crítica | XS | 2 | Pérdida total de datos posible |
| DT-002 | routes.js monolítico | Alta | M | 3 | Testing difícil, modificaciones arriesgadas |
| DT-008 | Upload sin validación | Alta | XS | 3 | Potencial RCE por contenido malicioso |
| DT-003 | Migraciones inline | Media | S | 4 | Dos fuentes de verdad para el esquema |
| DT-009 | Logs no estructurados | Media | XS | 4 | Sin observabilidad en producción |
| DT-012 | Sin gestor de estado | Media | M | 4 | Rendimiento degradado, re-fetches innecesarios |
| DT-014 | SW sin versionado | Baja | S | 5 | Cache obsoleta, bajo impacto |
| DT-006 | Sin linting/format | Media | XS | 5 | Inconsistencias de estilo, sin calidad de código |
| DT-004 | Tipos duplicados | Baja | XS | 6 | Riesgo de divergencia, baja probabilidad |
| DT-011 | Valores mágicos | Baja | XS | 6 | Errores sutiles, bajo impacto |
| DT-013 | routeService.ts código muerto | Baja | XS | 6 | Confusión, no afecta el funcionamiento |
