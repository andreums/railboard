# Revisión de Seguridad — RailBoard

## Hallazgos

| #   | Hallazgo                                                                  | Tipo                      | Severidad |
| --- | ------------------------------------------------------------------------- | ------------------------- | --------- |
| 1   | HTTP Basic Auth sin HTTPS                                                 | vulnerabilidad confirmada | crítico   |
| 2   | Password admin por defecto "railboard"                                    | vulnerabilidad confirmada | crítico   |
| 3   | Upload de archivos sin validación de contenido                            | configuración insegura    | alto      |
| 4   | Sin rate limit en /api                                                    | configuración insegura    | medio     |
| 5   | SQLite sin cifrar                                                         | riesgo potencial          | medio     |
| 6   | CORS permite cualquier localhost:* en no-prod                             | configuración insegura    | medio     |
| 7   | Sin protección CSRF                                                       | riesgo potencial          | medio     |
| 8   | Helmet parcialmente desactivado (crossOriginResourcePolicy: cross-origin) | buena práctica ausente    | bajo      |
| 9   | Uploads servidos a cualquier usuario sin auth                             | riesgo potencial          | medio     |

---

## 1. HTTP Basic Auth sin HTTPS

- **Tipo:** vulnerabilidad confirmada
- **Severidad:** crítico
- **Descripción:** La autenticación de administración utiliza HTTP Basic Auth (`express-basic-auth`). Las credenciales se codifican en Base64 pero no se cifran. Sin HTTPS, un atacante en la misma red puede interceptar el tráfico y obtener la contraseña.
- **Impacto:** Exposición completa del panel de administración. Un atacante puede crear, modificar o eliminar trenes, operadores, configuraciones de display, etc.
- **Mitigación:** Forzar HTTPS (certbot/Let's Encrypt o Traefik) a nivel de proxy inverso. Alternativamente, migrar a autenticación por token (JWT) con cookies httpOnly.
- **Evidencia:** `backend/src/routes.js:21-27`

## 2. Password admin por defecto "railboard"

- **Tipo:** vulnerabilidad confirmada
- **Severidad:** crítico
- **Descripción:** Si no se configura la variable de entorno `ADMIN_PASSWORD`, la contraseña por defecto es `"railboard"`. Este valor es conocido públicamente (código fuente abierto) y no se fuerza el cambio al primer inicio.
- **Impacto:** Acceso no autorizado inmediato al admin en instalaciones que no hayan cambiado la contraseña.
- **Mitigación:** Cambio de contraseña obligatorio al primer inicio. Eliminar el valor por defecto y requerir `ADMIN_PASSWORD` en el arranque. Registrar un evento de alerta si se usa la contraseña por defecto.
- **Evidencia:** `backend/src/routes.js:21`

## 3. Upload de archivos sin validación de contenido

- **Tipo:** configuración insegura
- **Severidad:** alto
- **Descripción:** `multer` valida la extensión del archivo y el `Content-Type` HTTP, pero ambos son falseables por un atacante. No se verifican los magic bytes del archivo. Un atacante puede subir un script ejecutable con extensión `.png` y Content-Type `image/png`, y el sistema lo aceptará.
- **Impacto:** Potencial Remote Code Execution (RCE) si el archivo subido es ejecutable y accesible via el navegador.
- **Mitigación:** Validar magic bytes con `file-type` o `sharp` antes de aceptar el archivo. Almacenar archivos fuera del document root o servirlos con `Content-Disposition: attachment`. Configurar el directorio de uploads para que no ejecute scripts.
- **Evidencia:** `backend/src/routes.js:37-52` (upload de imágenes), `backend/src/routes.js:54-69` (upload de audio)

## 4. Sin rate limit en /api

- **Tipo:** configuración insegura
- **Severidad:** medio
- **Descripción:** El rate limiting (`express-rate-limit`) está aplicado solo a las rutas `/admin`. Las rutas `/api` (railRoutesApi) no tienen ninguna limitación. Un atacante puede hacer peticiones masivas a `/api` sin restricción.
- **Impacto:** Potencial abuso de la API de datos ferroviarios, exfiltración de datos, DoS parcial.
- **Mitigación:** Añadir el mismo `generalLimiter` a las rutas `/api`.
- **Evidencia:** `backend/src/index.js:45` (`app.use("/admin", generalLimiter)`) — nota: `/api` no está protegido. `backend/src/index.js:65` (`app.use("/api", railRoutesApi)`).

## 5. SQLite sin cifrar

- **Tipo:** riesgo potencial
- **Severidad:** medio
- **Descripción:** La base de datos SQLite (`data.db`) se almacena en disco sin ningún cifrado. Si un atacante obtiene acceso al sistema de archivos, puede leer todos los datos: configuraciones, trenes, operadores, etc.
- **Impacto:** Exposición de datos sensibles del sistema ferroviario si se compromete el servidor o si se hace un backup del archivo DB.
- **Mitigación:** Utilizar SQLite con cifrado (`sqlcipher`) o cifrar el volumen/directorio donde reside la DB. Asegurar que los backups también estén cifrados.
- **Evidencia:** `backend/src/db.js:6-8` — `new Database(dbPath)`

## 6. CORS permite cualquier localhost:* en no-prod

- **Tipo:** configuración insegura
- **Severidad:** medio
- **Descripción:** En entornos que no sean producción (`NODE_ENV !== "production"`), cualquier origen que comience con `http://localhost:` es aceptado por CORS. Esto incluye sitios maliciosos que se ejecuten en el puerto 5173 o cualquier otro puerto del atacante.
- **Impacto:** Un sitio web malicioso en `http://localhost:9999` puede hacer peticiones CORS contra el backend si el usuario visitara ese sitio.
- **Mitigación:** En producción, definir `CORS_ORIGIN` explícitamente. No permitir comodines amplios como `localhost:*`. Considerar permitir solo orígenes específicos.
- **Evidencia:** `backend/src/index.js:21-33` — `origin?.startsWith("http://localhost:")` en no-prod.

## 7. Sin protección CSRF

- **Tipo:** riesgo potencial
- **Severidad:** medio
- **Descripción:** La aplicación no implementa tokens CSRF ni ningún mecanismo de protección contra Cross-Site Request Forgery. Las peticiones de admin se autentican via Basic Auth (header `Authorization`), lo que en teoría mitiga CSRF porque el navegador no envía automáticamente credenciales Basic Auth entre orígenes en modo estándar — aunque si el navegador guarda las credenciales y el sitio malicioso hace una `fetch` con `credentials: 'include'`, sí las enviaría.
- **Impacto:** Potencial ejecución de acciones no autorizadas si un usuario autenticado visita un sitio malicioso, especialmente si el navegador tiene las credenciales almacenadas.
- **Mitigación:** Añadir protección CSRF (ej. `csurf` o doble cookie). Si se migra a JWT, almacenar el token en cookie httpOnly y validar `Origin`/`Referer`.
- **Evidencia:** No hay ningún middleware CSRF en `backend/src/index.js`.

## 8. Helmet parcialmente desactivado (crossOriginResourcePolicy: cross-origin)

- **Tipo:** buena práctica ausente
- **Severidad:** bajo
- **Descripción:** Helmet está configurado con `crossOriginResourcePolicy: { policy: "cross-origin" }`, lo que permite que cualquier origen cargue recursos del backend. Esto es necesario para servir imágenes de uploads en los displays, pero desactiva una protección útil contra exfiltración de datos via recursos (ej. un script externo que lee una imagen de uploads).
- **Impacto:** Otros orígenes pueden cargar recursos estáticos del backend en un contexto de navegador. Riesgo bajo porque los recursos son principalmente imágenes públicas.
- **Mitigación:** Si es posible, restringir `crossOriginResourcePolicy` a `same-site` o configurar un `Content-Security-Policy` estricto. Analizar qué recursos necesitan realmente CORS.
- **Evidencia:** `backend/src/index.js:19`

## 9. Uploads servidos a cualquier usuario sin auth

- **Tipo:** riesgo potencial
- **Severidad:** medio
- **Descripción:** El directorio `/uploads` se sirve de forma estática sin ninguna autenticación (`express.static`). Cualquier persona que conozca la URL de un archivo subido puede acceder a él, incluyendo archivos de audio (pre-announce) y logotipos.
- **Impacto:** Exposición de archivos que un usuario malicioso podría referenciar o descargar. Si un archivo malicioso se subiera (ver #3), estaría disponible para todos.
- **Mitigación:** Servir uploads con autenticación o al menos restringir el acceso por IP. Considerar servir archivos via un endpoint que valide permisos. Añadir `Content-Disposition: attachment` y headers de cache apropiados.
- **Evidencia:** `backend/src/index.js:56` — `app.use("/uploads", express.static(...))`

---

## Controles de seguridad existentes

| Control                   | Detalle                                                                              | Efectividad                               |
| ------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| Helmet security headers   | `helmet()` con `crossOriginResourcePolicy: cross-origin`                             | Parcial (un header desactivado)           |
| CORS restriction          | Origen permitido es `CORS_ORIGIN` o `localhost:5173` (cualquier puerto local en dev) | Buena en prod, demasiado permisiva en dev |
| Rate limiting en /admin   | 1000 req/min (dev) / 120 req/min (prod) en general, 30 req/min en write              | Buena, pero no cubre /api                 |
| Input validation (multer) | Extensión y mimetype para imágenes y audio                                           | Superficie solo, no valida contenido real |
| File size limits          | 15MB (nginx), 10MB (imágenes multer), 5MB (audio multer)                             | Correcto                                  |

---

## Resumen de recomendaciones

1. **Forzar HTTPS** (certbot o Traefik) — crítico, prerrequisito para cualquier mejora de seguridad.
2. **Cambio de contraseña obligatorio al primer inicio** — eliminar el valor por defecto, requerir variable de entorno.
3. **Validar MIME real de los archivos subidos** con `file-type` (magic bytes) — cerrar el vector RCE.
4. **Añadir rate limit en /api** — mismo `generalLimiter` que en /admin.
5. **Cifrar SQLite o el volumen** donde reside la base de datos.
6. **Revisar CORS para producción** — definir `CORS_ORIGIN` estrictamente y no permitir comodines.
7. **Añadir headers de seguridad**:
   - `Content-Security-Policy` para restringir orígenes de scripts, estilos, y fuentes.
   - `Permissions-Policy` para limitar APIs del navegador (micrófono, cámara, etc.).
   - `Cross-Origin-Resource-Policy: same-site` (si los recursos no necesitan ser cross-origin).
8. **Proteger /uploads con autenticación** o servir archivos via un endpoint que valide permisos.
9. **Implementar protección CSRF** si se migra a autenticación por sesión/token.
