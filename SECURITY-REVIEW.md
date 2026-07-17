# Revisió de Seguretat — RailBoard

## Hallazgos

| # | Troballa | Tipus | Severitat |
|---|---|---|---|
| 1 | HTTP Basic Auth sense HTTPS | vulnerabilitat confirmada | crític |
| 2 | Password admin per defecte "railboard" | vulnerabilitat confirmada | crític |
| 3 | Upload de fitxers sense validació de contingut | configuració insegura | alt |
| 4 | Sense rate limit a /api | configuració insegura | mig |
| 5 | SQLite sense xifrar | risc potencial | mig |
| 6 | CORS permet qualsevol localhost:* en no-prod | configuració insegura | mig |
| 7 | Sense protecció CSRF | risc potencial | mig |
| 8 | Helmet parcialment desactivat (crossOriginResourcePolicy: cross-origin) | bona pràctica absent | baix |
| 9 | Uploads servits a qualsevol usuari sense auth | risc potencial | mig |

---

## 1. HTTP Basic Auth sense HTTPS

- **Tipus:** vulnerabilitat confirmada
- **Severitat:** crític
- **Descripció:** L'autenticació d'administració utilitza HTTP Basic Auth (`express-basic-auth`). Les credencials es codifiquen en Base64 però no es xifren. Sense HTTPS, un atacant en la mateixa xarxa pot interceptar el trànsit i obtenir el password.
- **Impacte:** Exposició completa del panell d'administració. Un atacant pot crear, modificar o eliminar trens, operadors, configuracions de display, etc.
- **Mitigació:** Forçar HTTPS (certbot/Let's Encrypt o Traefik) a nivell de proxy invers. Alternativament, migrar a autenticació per token (JWT) amb cookies httpOnly.
- **Evidència:** `backend/src/routes.js:21-27`

## 2. Password admin per defecte "railboard"

- **Tipus:** vulnerabilitat confirmada
- **Severitat:** crític
- **Descripció:** Si no es configura la variable d'entorn `ADMIN_PASSWORD`, el password per defecte és `"railboard"`. Aquest valor és conegut públicament (codi font obert) i no es força al canvi al primer inici.
- **Impacte:** Accés no autoritzat immediat a l'admin en instal·lacions que no hagin canviat el password.
- **Mitigació:** Canvi de password obligatori al primer inici. Eliminar el valor per defecte i requerir `ADMIN_PASSWORD` a l'arrencada. Registrar un event d'alerta si es fa servir el password per defecte.
- **Evidència:** `backend/src/routes.js:21`

## 3. Upload de fitxers sense validació de contingut

- **Tipus:** configuració insegura
- **Severitat:** alt
- **Descripció:** `multer` valida l'extensió del fitxer i el `Content-Type` HTTP, però tots dos són falsejables per un atacant. No es verifiquen els magic bytes del fitxer. Un atacant pot pujar un script executable amb extensió `.png` i Content-Type `image/png`, i el sistema l'acceptarà.
- **Impacte:** Potencial Remote Code Execution (RCE) si el fitxer pujat és executable i accessible via el navegador.
- **Mitigació:** Validar magic bytes amb `file-type` o `sharp` abans d'acceptar el fitxer. Emmagatzemar fitxers fora del document root o servir-los amb `Content-Disposition: attachment`. Configurar el directori d'uploads per a no executar scripts.
- **Evidència:** `backend/src/routes.js:37-52` (upload d'imatges), `backend/src/routes.js:54-69` (upload d'àudio)

## 4. Sense rate limit a /api

- **Tipus:** configuració insegura
- **Severitat:** mig
- **Descripció:** El rate limiting (`express-rate-limit`) està aplicat només a les rutes `/admin`. Les rutes `/api` (railRoutesApi) no tenen cap limitació. Un atacant pot fer peticions massives a `/api` sense restricció.
- **Impacte:** Potencial abús de l'API de dades ferroviàries, exfiltració de dades, DoS parcial.
- **Mitigació:** Afegir el mateix `generalLimiter` a les rutes `/api`.
- **Evidència:** `backend/src/index.js:45` (`app.use("/admin", generalLimiter)`) — nota: `/api` no està protegit. `backend/src/index.js:65` (`app.use("/api", railRoutesApi)`).

## 5. SQLite sense xifrar

- **Tipus:** risc potencial
- **Severitat:** mig
- **Descripció:** La base de dades SQLite (`data.db`) s'emmagatzema en disc sense cap xifratge. Si un atacant obté accés al sistema de fitxers, pot llegir totes les dades: configuracions, trens, operadors, etc.
- **Impacte:** Exposició de dades sensibles del sistema ferroviari si es compromet el servidor o si es fa un backup del fitxer DB.
- **Mitigació:** Utilitzar SQLite amb xifratge (`sqlcipher`) o xifrar el volume/directori on resideix la DB. Assegurar que els backups també estiguin xifrats.
- **Evidència:** `backend/src/db.js:6-8` — `new Database(dbPath)`

## 6. CORS permet qualsevol localhost:* en no-prod

- **Tipus:** configuració insegura
- **Severitat:** mig
- **Descripció:** En entorns que no siguin producció (`NODE_ENV !== "production"`), qualsevol origen que comenci amb `http://localhost:` és acceptat per CORS. Això inclou llocs maliciosos que s'executin al port 5173 o qualsevol altre port de l'atacant.
- **Impacte:** Un lloc web maliciós a `http://localhost:9999` pot fer peticions CORS contra el backend si l'usuari visités aquest lloc.
- **Mitigació:** En producció, definir `CORS_ORIGIN` explícitament. No permetre comodins amplis com `localhost:*`. Considerar permetre només orígens específics.
- **Evidència:** `backend/src/index.js:21-33` — `origin?.startsWith("http://localhost:")` en no-prod.

## 7. Sense protecció CSRF

- **Tipus:** risc potencial
- **Severitat:** mig
- **Descripció:** L'aplicació no implementa tokens CSRF ni cap mecanisme de protecció contra Cross-Site Request Forgery. Les peticions d'admin s'autentiquen via Basic Auth (header `Authorization`), cosa que en teoria mitiga CSRF perquè el navegador no envia automàticament credencials Basic Auth entre orígens en mode estàndard — tot i que si el navegador guarda les credencials i el lloc maliciós fa una `fetch` amb `credentials: 'include'`, sí que les enviaria.
- **Impacte:** Potencial execució d'accions no autoritzades si un usuari autenticat visita un lloc maliciós, especialment si el navegador té les credencials emmagatzemades.
- **Mitigació:** Afegir protecció CSRF (ex. `csurf` o doble cookie). Si es migra a JWT, emmagatzemar el token en cookie httpOnly i validar `Origin`/`Referer`.
- **Evidència:** No hi ha cap middleware CSRF a `backend/src/index.js`.

## 8. Helmet parcialment desactivat (crossOriginResourcePolicy: cross-origin)

- **Tipus:** bona pràctica absent
- **Severitat:** baix
- **Descripció:** Helmet està configurat amb `crossOriginResourcePolicy: { policy: "cross-origin" }`, cosa que permet que qualsevol origen carregui recursos del backend. Això és necessari per servir imatges d'uploads als displays, però desactiva una protecció útil contra exfiltració de dades via recursos (ex. un script extern que llegeix una imatge d'uploads).
- **Impacte:** Altres orígens poden carregar recursos estàtics del backend en un context de navegador. Risc baix perquè els recursos són principalment imatges públiques.
- **Mitigació:** Si és possible, restringir `crossOriginResourcePolicy` a `same-site` o configurar un `Content-Security-Policy` estricte. Analitzar quins recursos necessiten realment CORS.
- **Evidència:** `backend/src/index.js:19`

## 9. Uploads servits a qualsevol usuari sense auth

- **Tipus:** risc potencial
- **Severitat:** mig
- **Descripció:** El directori `/uploads` es serveix de forma estàtica sense cap autenticació (`express.static`). Qualsevol persona que conegui la URL d'un fitxer pujat pot accedir-hi, incloent fitxers d'àudio (pre-announce) i logotips.
- **Impacte:** Exposició de fitxers que un usuari maliciós podria referenciar o descarregar. Si un fitxer maliciós es pugés (veure #3), estaria disponible per a tothom.
- **Mitigació:** Servir uploads amb autenticació o almenys restringir l'accés per IP. Considerar servir fitxers via un endpoint que validi permisos. Afegir `Content-Disposition: attachment` i headers de cache apropiats.
- **Evidència:** `backend/src/index.js:56` — `app.use("/uploads", express.static(...))`

---

## Controls de seguretat existents

| Control | Detall | Efectivitat |
|---|---|---|
| Helmet security headers | `helmet()` amb `crossOriginResourcePolicy: cross-origin` | Parcial (un header desactivat) |
| CORS restriction | Origen permès és `CORS_ORIGIN` o `localhost:5173` (qualsevol port local en dev) | Bona en prod, massa permissiva en dev |
| Rate limiting a /admin | 1000 req/min (dev) / 120 req/min (prod) al general, 30 req/min als write | Bona, però no cobreix /api |
| Input validation (multer) | Extensió i mimetype per a imatges i àudio | Superfície només, no valida contingut real |
| File size limits | 15MB (nginx), 10MB (imatges multer), 5MB (àudio multer) | Correcte |

---

## Resum de recomanacions

1. **Forçar HTTPS** (certbot o Traefik) — crític, prerequisit per a qualsevol millora de seguretat.
2. **Canvi de password obligatori al primer inici** — eliminar el valor per defecte, requerir variable d'entorn.
3. **Validar MIME real dels fitxers pujats** amb `file-type` (magic bytes) — tancar el vector RCE.
4. **Afegir rate limit a /api** — mateix `generalLimiter` que a /admin.
5. **Xifrar SQLite o el volume** on resideix la base de dades.
6. **Revisar CORS per a producció** — definir `CORS_ORIGIN` estrictament i no permetre comodins.
7. **Afegir headers de seguretat**:
   - `Content-Security-Policy` per restringir orígens de scripts, estils, i fonts.
   - `Permissions-Policy` per limitar APIs del navegador (micròfon, càmera, etc.).
   - `Cross-Origin-Resource-Policy: same-site` (si els recursos no necessiten ser cross-origin).
8. **Protegir /uploads amb autenticació** o servir fitxers via un endpoint que validi permisos.
9. **Implementar protecció CSRF** si es migra a autenticació per sessió/token.
