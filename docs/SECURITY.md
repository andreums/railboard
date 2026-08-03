# Revisión de Seguridad — RailBoard

Documento de auditoría de seguridad del proyecto. Estado: **S1–S5 y S7–S9 parcheados; S6 documentado (decisión de diseño); falta TLS** (última revisión: 3 agosto 2026).

Cada hallazgo lleva gravedad (`Crítica` / `Alta` / `Media` / `Baja`), la evidencia en el código y un plan de parcheo concreto.

---

## Resumen ejecutivo

| # | Hallazgo | Gravedad | Estado |
| - | -------- | -------- | ------ |
| S1 | Credenciales admin hardcodeadas en el frontend | **Crítica** | ✅ Parcheado |
| S2 | Contraseña por defecto predecible + autenticación Basic sin TLS | **Crítica** | 🟡 Parcial (falta TLS) |
| S3 | Path traversal en `locale/:lang` | **Alta** | ✅ Parcheado |
| S4 | WebSocket `/ws` sin autenticación | **Media** | ✅ Parcheado |
| S5 | Upload SVG → XSS almacenado (stored XSS) | **Alta** | ✅ Parcheado |
| S6 | `/uploads` expuesto sin control de lectura restringido | **Media** | 🟢 Aceptado (por diseño) |
| S7 | Sin rate limit en el API público `/api` | **Media** | ✅ Parcheado |
| S8 | Headers de seguridad incompletos (CSP, HSTS) | **Media** | ✅ Parcheado (CSP; HSTS pendiente de TLS) |
| S9 | `/health` expone info de entorno | **Baja** | ✅ Parcheado |

**Lo que ya está bien:** todas las queries SQL usan prepared statements o whitelists de columnas hardcodeadas (`db.js` `allowed`/`fields`), multer valida MIME y contenido real vía `file-type`, hay rate limit en `/admin`, `helmet()` por defecto activo, CORS restringido en producción, y el logger no serializa credenciales ni bodies.

---

## S1 — Credenciales admin hardcodeadas en el frontend  ✅ Parcheado

**Evidencia antigua:**
- `frontend/src/lib/api.ts:9` → `_auth = btoa("admin:railboard");`
- `frontend/src/services/routeApi.ts:55` → `const auth = btoa("admin:railboard");`

**Riesgo:** el bundle del frontend (público) contenía la contraseña admin en base64.

**Parche aplicado (3 agosto 2026):**
1. Nuevo módulo `frontend/src/lib/auth.ts`: las credenciales ya NO van en código; se introducen en el **login** y se guardan en `sessionStorage` (se borran al cerrar el navegador/pestaña).
2. `api.ts` y `routeApi.ts` usan `authHeaders()` de `auth.ts` (sin secretos embebidos).
3. Nuevo `AuthGate` (`frontend/src/components/AuthGate.tsx`) envuelve las rutas admin en `main.tsx` (`/admin`, `/admin/:tab`, `/admin/displays`, `/trains`, `/train-settings`) y muestra `LoginScreen.tsx` si no hay sesión.
4. Nuevo endpoint ligero protegido `GET /admin/auth/me` para verificar credenciales.
5. Una petición 401 borra la sesión y devuelve al login automáticamente.
6. Backend: ya no existe la password por defecto `railboard` (ver S2).

**Confirmado:** `grep` de `admin:railboard` en `frontend/src` y `backend/src` no devuelve coincidencias.

---

## S2 — Contraseña predecible + Basic Auth sobre HTTP  🟡 Parcial (falta TLS)

**Evidencia antigua:**
- `backend/src/middleware/auth.js:3` → `const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "railboard";`
- `backend/src/middleware/auth.js:5-8` → `express-basic-auth` sin límite de intentos propio (solo el rate limit global de `/admin`).
- `docker/nginx.conf` → solo HTTP `listen 80;`, sin TLS.

**Parcheo aplicado (backend, 3 agosto 2026):**
1. `middleware/auth.js` reescrito:
   - En **producción** `ADMIN_PASSWORD` es **obligatoria**: si falta, lanza `throw` y el proceso no arranca.
   - En desarrollo, si falta, se genera una contraseña aleatoria por arranque (logueada una vez); nunca un secreto predecible.
   - Comparación en **tiempo constante** (`crypto.timingSafeEqual` sobre hash SHA-256 para no filtrar longitud).
   - **Anti fuerza-bruta**: 8 fallos consecutivos por IP ⇒ bloqueo 5 min (`429`).
   - Usuario admin configurable vía `ADMIN_USER` (por defecto `admin`).
2. `index.js`: `app.set("trust proxy", ...)` habilitado con `TRUST_PROXY=1` para que el lockout use la IP real tras nginx.
3. Pruebas de seguridad en `backend/src/__tests__/auth.test.js` (401 sin creds, 401 pass errónea, 200 correcta, 429 tras fuerza bruta) — 4 tests pasar.
4. Nuevo endpoint ligero `GET /admin/auth/me`.

**Pendiente (parte de S2, no aplicado):**
- TLS en nginx (sigue en 80 sin HTTPS) y redirección 80→443 + HSTS.
- Las credenciales siguen viajando como Basic Base64; sin TLS son interceptables en la red.

---

## S3 — Path traversal en `/admin/announcements/locale/:lang`  ✅ Parcheado

**Evidencia antigua:**
- `backend/src/services/announcementComposer.js` construía `path.join(LOCALES_DIR, `${language}.json`)` con `language` sin validar.

**Parche aplicado (3 agosto 2026):**
- Nueva función `safeLocaleKey(language)` en `announcementComposer.js`: valida el código con regex `/^[a-z]{2,3}$/`, y como capa defensiva hace `path.resolve` y verifica que el resultado esté dentro de `LOCALES_DIR`. Aplica a `loadLocale`, `getLocaleContent` y `saveLocaleContent`.
- Un `lang` inválido devuelve `null`/`undefined` → la ruta responde `404` (no escribe nada).

---

## S4 — WebSocket `/ws` sin autenticación  ✅ Parcheado

**Evidencia antigua:**
- `backend/src/ws.js:13-15` `attachWebSocket` aceptaba cualquier conexión en `/ws`; `heartbeat`/`identify` ejecutaban `upsertDevice` sin validar.

**Parche aplicado (3 agosto 2026):**
- El handshake autentica la conexión (`?auth=<base64 user:password>` o `?user=&token=`), validado con `verifyCredentials()` (comparación timing-safe).
- Los mensajes **privilegiados** `heartbeat`/`identify` (que escriben en `devices`) requieren `ws.__authenticated`; si no, responden `{ type: "error", error: "No autorizado" }`.
- El `subscribe`/`unsubscribe` (solo lectura, usado por las pantallas públicas) sigue siendo público.
- **Rate limit de mensajes** por conexión (120 mensajes / 30s).
- `connectWS()` en el frontend añade `?auth=` automáticamente cuando hay credenciales.

---

## S5 — SVG subido → XSS almacenado (stored XSS)  ✅ Parcheado

**Evidencia antigua:**
- `backend/src/services/uploadService.js` aceptaba `image/svg+xml` y lo servía como estático inline.

**Parche aplicado (3 agosto 2026):**
1. Nueva función `sanitizeSvg()` en `uploadService.js`: al validar el contenido, elimina `<script>`, handlers `on*`, URLs `javascript:` y `foreignObject` del SVG antes de guardarlo.
2. Servir los uploads con `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff` para `.svg` (y `.html/.htm/.xhtml`) en `index.js`, de modo que nunca se rendericen inline en el navegador.
3. CSP estricto añadido en nginx (S8): `object-src 'none'`, `script-src 'self'`.

**Nota:** el sanitizador es ligero (regex); para un despliegue en Internet conviene migrar a una librería de saneo robusta (p.ej. `sanitize-html` o `DOMPurify` server-side) o desactivar SVG para admins remotos.

---

## S6 — `/uploads` expuesto  🟢 Aceptado (por diseño)

**Evidencia:**
- `backend/src/index.js:66` → `app.use("/uploads", express.static(....../uploads))` sin auth.

**Riesgo:** cualquiera puede listar/descargar los ficheros subidos (logos, audios TTS, pre-anuncios).

**Decisión (3 agosto 2026):** los logos/audios de los paneles PIS **públicos** se sirven desde `/uploads` por diseño, así que restringir el acceso rompería las pantallas públicas. Se mantiene abierto, pero:
- Los SVG se sirven como `attachment` (S5), eliminando el vector de ejecución.
- Se añade rate limit y headers de seguridad.
- Si en el futuro los uploads deben ser privados, mover los assets detrás de auth y servir solo los públicos (o usar un CDN con firma de URLs).

---

## S7 — Sin rate limit en el API público `/api`  ✅ Parcheado

**Evidencia antigua:**
- `backend/src/index.js` solo aplicaba rate limit a `/admin`.

**Parche aplicado (3 agosto 2026):**
- Nuevo `publicLimiter` en `index.js` aplicado a `/api` (300 req/min por defecto, configurable con `PUBLIC_RATE_LIMIT_MAX`).

**Evidencia:**
- `backend/src/index.js:66` → `app.use("/uploads", express.static(...../uploads))` sin auth.

**Riesgo:** cualquiera puede listar/descargar todos los ficheros subidos (logos, audios TTS, pre-anuncios). No es fatal por sí solo (son assets), pero la cache TTS y audios de anuncios pueden ser sensibles si hay contenido no público.

**Parcheo:**
1. Si los uploads no deben ser públicos, moverlos detrás de auth o servir solo los de lectura pública necesarios.
2. `express.static` ya no recarga config; añadir `fallthrough: false` y maxAge controlado.
3. Evitar que servidor `uploads` exponga `tts` completo si no se desea.

---

## S8 — Cabeceras de seguridad incompletas en source  ✅ Parcheado (CSP; HSTS pendiente de TLS)

**Evidencia antigua:**
- `docker/nginx.conf:91-94` definía `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy` pero faltaba CSP y HSTS.

**Parche aplicado (3 agosto 2026):**
- Añadida `Content-Security-Policy` en `docker/nginx.conf`: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'`.
- HSTS comentado (requiere TLS): al activar HTTPS, descomentar `Strict-Transport-Security "max-age=31536000; includeSubDomains"`.

---

## S9 — `/health` expone información de entorno  ✅ Parcheado

**Evidencia antigua:**
- `backend/src/index.js:110-114` `/health` devolvía `env`, `node`, `memory`, `uptime`, `fileCount`.

**Parche aplicado (3 agosto 2026):**
- En producción (`NODE_ENV === "production"`) `/health` devuelve solo `{ ok, checks }` sin `detail` (ni versión de node, ni env, ni memoria, ni conteo de ficheros). El detalle completo solo se muestra en desarrollo.

---

## Checklist de parcheo recomendado (orden)

1. **[S1,S2]** Eliminar credenciales embebidas + obligar `ADMIN_PASSWORD` en producción + TLS + fuerza-bruta.
2. **[S3]** Sanear `lang` en locales.
3. **[S5]** Restringir SVG o sanearlo; CSP estricto.
4. **[S4]** Autenticar WS.
5. **[S6,S7]** Rate limit `/api` + control de uploads.
6. **[S8,S9]** Headers CSP/HSTS y `/health` mínimo.

Para implementar los parches concretos, cada hallazgo tiene su fichero/línea. Se recomienda abordarlos en orden crítico→alto.