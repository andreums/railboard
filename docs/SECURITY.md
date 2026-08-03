# Revisión de Seguridad — RailBoard

Documento de auditoría de seguridad del proyecto. Estado: **S1 y S2 parcheados; resto pendiente** (última revisión: 3 agosto 2026).

Cada hallazgo lleva gravedad (`Crítica` / `Alta` / `Media` / `Baja`), la evidencia en el código y un plan de parcheo concreto.

---

## Resumen ejecutivo

| # | Hallazgo | Gravedad | Estado |
| - | -------- | -------- | ------ |
| S1 | Credenciales admin hardcodeadas en el frontend | **Crítica** | ✅ Parcheado |
| S2 | Contraseña por defecto predecible + autenticación Basic sin TLS | **Crítica** | 🟡 Parcial (falta TLS) |
| S3 | Path traversal en `locale/:lang` | **Alta** | ⏳ Pendiente |
| S4 | WebSocket `/ws` sin autenticación | **Media** | ⏳ Pendiente |
| S5 | Upload SVG → XSS almacenado (stored XSS) | **Alta** | ⏳ Pendiente |
| S6 | `/uploads` expuesto sin control de lectura restringido | **Media** | ⏳ Pendiente |
| S7 | Sin rate limit en el API público `/api` | **Media** | ⏳ Pendiente |
| S8 | Headers de seguridad incompletos (CSP, HSTS) | **Media** | ⏳ Pendiente |
| S9 | `/health` expone info de entorno | **Baja** | ⏳ Pendiente |

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

## S3 — Path traversal en `/admin/announcements/locale/:lang`  🟠 Alta

**Evidencia:**
- `backend/src/routes.js:856-862` `PUT /announcements/locale/:lang` → `saveLocaleContent(lang, req.body)`
- `backend/src/services/announcementComposer.js:25-29`:

```js
export function saveLocaleContent(language, data) {
  const filePath = path.join(LOCALES_DIR, `${language}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  ...
}
```

**Riesgo:** `language` proviene directamente del path param. `path.join` no bloquea `..`, así que `lang = ../../data/data` escribiría `data.json` fuera de `LOCALES_DIR` (o sobreescribir ficheros `.json` existentes). Aunque exige `adminAuth`, permite a un admin (o a un atacante que lograra la auth) escribir/sobreescribir cualquier fichero `.json` del servidor.

**Parcheo:**
1. Validar el param: regex `/^[a-z]{2,3}$/` (y rechazar `..`, `/`, `\`, extensión) antes de usarlo en `getLocaleContent`/`saveLocaleContent`.
2. Centralizar en una función `safeLocalePath(language)` que haga `path.resolve` y verifique que el resultado empiece por `LOCALES_DIR`.
3. Preferir guardar locales en la BD, no en el filesystem.

---

## S4 — WebSocket `/ws` sin autenticación  🟠 Media

**Evidencia:**
- `backend/src/ws.js:13-15` `attachWebSocket` acepta cualquier conexión en `/ws` sin comprobar credenciales.
- Cualquier cliente puede enviar `heartbeat`/`identify` y ejecutar `upsertDevice(...)` (ws.js:79, 89) creando/actualizando dispositivos (`ws.__deviceInfo.deviceId` libre).
- `broadcast` (ws.js:124-130) difunde datos a todos los clientes conectados.

**Riesgo:**
- Suplantación de dispositivos para envenenar el panel admin de dispositivos.
- Los clientes sujer a subs abiertas — aunque los datos broadcast son tableros públicos, permite DoS de subs y spoofing de ID.

**Parcheo:**
1. Añadir autenticación en el handshake del WS (en `wss.on("connection", ws, req)`) validando un token de en el query/header (p.ej. para admin) o limitar qué tipos pueden `identify`/`heartbeat`.
2. Validar `deviceId` con un formato permitido (longitud/regex) y no permitir claves reservadas.
3. Rate-limit de mensajes por conexión.
4. Solo permitir `upsertDevice`/`identify` tras handshake autenticado; a las pantallas públicas solo `subscribe` de solo lectura.

---

## S5 — SVG subido → XSS almacenado (stored XSS)  🟠 Alta

**Evidencia:**
- `backend/src/services/uploadService.js:78-80` → `upload` acepta `image/svg+xml`.
- `backend/src/services/uploadService.js:33-46` `validateFileType` valida contenido con `file-type`, pero `file-type` NO identifica de forma fiable el XML/SVG (retorna null para muchos SVG), por lo que muchos SVGs se guardan igual.
- `docker/nginx.conf:85` sirve `.svg` con caché y como estático.

**Riesgo:** un SVG subido como logo (operador, tipo, estación) puede contener `<script>`/event handlers. Si se sirve en contexto del mismo origen puede ejecutar JS (robo de sesión, etc.) o ser usado en phishing. `helmet()` pone CSP por defecto que mitiga parcialmente, pero el CSP por defecto de helmet bloquea `unsafe-inline` y `unsafe-eval` en general, aunque no cubre SVG en `<img>` con `crossorigin`.

**Parcheo:**
1. No permitir SVG subidos por usuarios admin remotos; convertir a PNG o usuar un almacén aislado.
2. Si se mantiene SVG: sanear el contenido (restringir a elementos seguros, sin `script` ni `foreignObject`, sin handlers `on*`) y servirlo con `Content-Disposition: attachment` y `Content-Type: image/svg+xml; charset=utf-8`.
3. Asegurar CSP estricto en `helmet({ contentSecurityPolicy: { directives: { scriptSrc: ["'self'"], ... } } })` y `object-src 'none'`.
4. Servir uploads con inmutabilidad + `Cross-Origin-Resource-Policy: cross-origin` (ya activo) y considerar `SameSite` en cookies (no hay cookies ahora, pero para el futuro).

---

## S6 — `/uploads` expuesto  🟠 Media

**Evidencia:**
- `backend/src/index.js:66` → `app.use("/uploads", express.static(...../uploads))` sin auth.

**Riesgo:** cualquiera puede listar/descargar todos los ficheros subidos (logos, audios TTS, pre-anuncios). No es fatal por sí solo (son assets), pero la cache TTS y audios de anuncios pueden ser sensibles si hay contenido no público.

**Parcheo:**
1. Si los uploads no deben ser públicos, moverlos detrás de auth o servir solo los de lectura pública necesarios.
2. `express.static` ya no recarga config; añadir `fallthrough: false` y maxAge controlado.
3. Evitar que servidor `uploads` exponga `tts` completo si no se desea.

---

## S7 — Sin rate limit en `/api` público  🟠 Media

**Evidencia:**
- `backend/src/index.js:47-55` `generalLimiter` se aplica solo a `/admin`.
- `/api` (`railRoutesApi.js`) NO tiene rate limit.

**Riesgo:** abuso/DoS de los endpoints públicos (`/api/stations/search`, `/api/stations/:id/board`, etc.).

**Parcheo:**
- Aplicar un rate limit (125 req/min por IP, por ej.) sobre `/api` y por defecto a todas las rutas, con `trust proxy` correctamente configurado tras nginx para no limitar erroneamente.
- Configurar `app.set("trust proxy", 1)` en index.js cuando está detrás de nginx.

---

## S8 — Cabeceras de seguridad incompletas en source  🟠 Media

**Evidencia:**
- `docker/nginx.conf:91-94` define `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy` (bien) pero falta CSP y HSTS.

**Parcheo:**
1. Añadir `Content-Security-Policy` estricta en nginx (basada en la que deje helmet en el backend).
2. Añadir HSTS `Strict-Transport-Security` (cuando haya TLS).
3. Revisar que helmet en el backend no se sobreescriba ni se debilite.

---

## S9 — `/health` expone información de entorno  🟢 Baja

**Evidencia:**
- `backend/src/index.js:110-114` `/health` devuelve `env`, `node`, `memory`, `uptime`, `fileCount`.

**Riesgo:** baja, pero expone versión de node y vars de entorno a cualquiera.

**Parcheo:** en producción responder solo `{ ok: true }` sin `detail.node/env` (proteger el objeto si no es admin), u ocultar `env`/`node` fuera de dev.

---

## Checklist de parcheo recomendado (orden)

1. **[S1,S2]** Eliminar credenciales embebidas + obligar `ADMIN_PASSWORD` en producción + TLS + fuerza-bruta.
2. **[S3]** Sanear `lang` en locales.
3. **[S5]** Restringir SVG o sanearlo; CSP estricto.
4. **[S4]** Autenticar WS.
5. **[S6,S7]** Rate limit `/api` + control de uploads.
6. **[S8,S9]** Headers CSP/HSTS y `/health` mínimo.

Para implementar los parches concretos, cada hallazgo tiene su fichero/línea. Se recomienda abordarlos en orden crítico→alto.