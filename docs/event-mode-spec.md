# RailBoard — Modo Evento para Encuentros Modulares

> Versión 0.2 · Diseño funcional · Enfoque hobby, local-first

---

## 1. Escenarios de uso

### 1.1 Preparación antes del evento

El organizador abre RailBoard en su portátil una semana antes. Configura:

- Nombre del evento y estación principal
- Fecha y hora de inicio/fin
- Operadores participantes (Renfe, Iryo, Ouigo… o nombres ficticios)
- Tipos de tren permitidos
- Lista de lugares/destinos que aparecerán en el panel
- Logo del evento (opcional)

Guarda la configuración. La exporta a un archivo `.railboard.json` que comparte por USB o email con otros colaboradores.

### 1.2 Uso durante el evento

RailBoard corre en un portátil conectado a:

- Un monitor HDMI grande (pantalla pública con el panel ferroviario)
- La red local WiFi del evento

Los operadores acceden desde sus propios dispositivos (móvil, tablet, otro portátil) al panel de control.

La gente pasea, ve los trenes en la pantalla, oye los avisos de megafonía.

### 1.3 Uso desde portátil

El organizador tiene el control completo. Abre varias pestañas:

- Pestaña 1: display público (proyectado)
- Pestaña 2: Live Control (operación)
- Pestaña 3: Trains (CRUD detallado)

### 1.4 Uso desde móvil

Interfaz táctil simplificada. Acciones rápidas:

- Marcar tren como "Saliendo/Embarcando/Demorado/Suprimido"
- Añadir retraso de X minutos (botones +1, +5, +15)
- Cambiar vía
- Lanzar aviso TTS

Sin formularios largos. Sin drag & drop. Sin configuración.

### 1.5 Uso en monitor público

Pantalla completa, sin bordes del navegador, sin cursores, sin elementos de UI de admin. Solo el panel de salidas/llegadas. El footer puede mostrar el nombre del evento y mensajes rotativos.

### 1.6 Uso en red local sin Internet

Todo debe funcionar con:

- IP local (192.168.x.x)
- Sin DNS, sin certificados HTTPS válidos
- Sin CDNs (Google Fonts cargadas desde el propio servidor o bundled)
- Sin servicios externos (TTS con Web Speech API del navegador — funciona offline)
- Sin analytics, sin telemetría

### 1.7 Uso por una sola persona

Una persona lo opera todo desde un portátil. El modo "auto-pilot" puede generar trenes automáticamente simulando la operación de un club. La persona solo interviene para retrasos o incidencias.

### 1.8 Uso por varios operadores

Cada mesa del encuentro tiene un operador con móvil. Todos ven el mismo panel. Cuando un tren sale de una estación, el operador lo marca como "Departed" desde su móvil. Cuando llega a la siguiente, el operador de esa mesa lo marca como "Arrived". El display público se actualiza solo.

---

## 2. Actores

| Actor                     | Descripción                                                                     | Dispositivo | Pantallas que usa                        |
| ------------------------- | ------------------------------------------------------------------------------- | ----------- | ---------------------------------------- |
| **Organizador**           | Monta el evento, configura RailBoard, decide horarios. Es el super-admin.       | Portátil    | Event Setup, Live Control, Trains, Admin |
| **Operador de estación**  | Controla los trenes que pasan por su módulo. Marca salidas, llegadas, retrasos. | Móvil       | Mobile Quick Control, Live Control       |
| **Participante con tren** | Ha traído un tren y quiere verlo en el panel. No opera, solo consulta.          | Móvil       | Public Display (versión móvil)           |
| **Público / asistentes**  | Mira la pantalla grande y escucha la megafonía.                                 | Ninguno     | Public Display (monitor)                 |
| **Administrador técnico** | Arranca el server, soluciona problemas de red, reinicia si algo falla.          | Portátil    | Diagnostics                              |

---

## 3. Flujo operativo recomendado

### 3.1 Crear jornada

1. Abrir `http://railboard-local:4000/event-setup`
2. Rellenar: nombre del evento, fecha, estación principal, hora inicio/fin
3. Opcional: cargar configuración de un evento anterior (import .railboard.json)
4. Pulsar "Iniciar jornada"
5. RailBoard crea la jornada en BD, resetea trenes anteriores

### 3.2 Cargar trenes

Opción A: Generar trenes aleatorios (usando el sistema existente con rutas Cercanías/Media Distancia/AVE)
Opción B: Importar horario desde JSON/CSV
Opción C: Crear trenes manualmente uno a uno desde Live Control o /trains

### 3.3 Activar display

1. Abrir `/fullscreen` (sin UI de admin, oculta cursores, entra en fullscreen API)
2. Seleccionar modo departures o arrivals
3. Ajustar colores si es necesario

### 3.4 Controlar salidas / llegadas

Los operadores usan Mobile Quick Control para:

- Ver trenes próximos (próximos 30 minutos)
- Marcarlos como Boarding → Departed / Arrived
- Añadir retraso
- Cambiar vía

### 3.5 Marcar retrasos

Desde Live Control o Mobile:

- Botón "+5 min" en cada tren
- Botón "+15 min"
- Campo libre de minutos
- El display se actualiza automáticamente

### 3.6 Cambiar vía

- Desde Mobile Quick Control: selector rápido de vías predefinidas
- Desde Live Control: input o dropdown

### 3.7 Lanzar avisos TTS

- Botón "Anunciar" en cada tren → locución: "Atención. Tren AVE 03104 con destino a Barcelona Sants efectuará su salida por la vía 5, sector B."
- Botón "Aviso general" → mensaje personalizado + TTS
- Los avisos se escuchan por los altavoces del portátil o del monitor

### 3.8 Finalizar jornada

1. Desde Event Setup: "Finalizar jornada"
2. RailBoard guarda el histórico de todos los movimientos
3. Exporta JSON con: trenes, horarios, retrasos, cambios de vía, marcas temporales

### 3.9 Exportar histórico

- Botón "Exportar histórico" → descarga `.railboard-history.json`
- Incluye timeline completo: cada cambio de estado, retraso, cambio de vía con timestamp

---

## 4. Nuevas pantallas

### 4.1 Event Setup (`/event-setup`)

| Aspecto               | Descripción                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Objetivo**          | Configurar y lanzar una jornada de operación                                                                                      |
| **Usuario principal** | Organizador                                                                                                                       |
| **Acciones**          | Crear jornada, cargar configuración previa, importar/exportar .railboard.json, iniciar/finalizar jornada                          |
| **Datos**             | Nombre evento, fecha, hora inicio/fin, estación, operadores, modo (departures/arrivals), auto-generación sí/no                    |
| **Endpoints**         | `POST /api/event/session`, `GET /api/event/session`, `PUT /api/event/session`, `POST /api/event/export`, `POST /api/event/import` |
| **Prioridad**         | **Alta** (necesario para V0.2)                                                                                                    |

### 4.2 Live Control (`/control`)

| Aspecto               | Descripción                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Objetivo**          | Panel de control en tiempo real para operar trenes durante el evento                                                                          |
| **Usuario principal** | Operador de estación, Organizador                                                                                                             |
| **Acciones**          | Cambiar estado (Scheduled→Boarding→Departed, etc.), añadir retraso, cambiar vía, anunciar TTS, ver detalle del tren, filtrar por línea/estado |
| **Datos**             | Lista de trenes activos con tiempo restante, estado, vía, retraso acumulado. Timeline de cambios del tren seleccionado                        |
| **Endpoints**         | Los mismos que `/api/trains/*` + `GET /api/event/logs?train_id=X`                                                                             |
| **Prioridad**         | **Alta** (el corazón del modo evento)                                                                                                         |

Diseño propuesto:

- Tabla compacta con: hora, número, tipo, destino/origen, vía, estado, acciones rápidas
- Acciones inline: botones [Embarcar] [Salido] [+5] [+15] [Anunciar] [Vía]
- Filtros: solo próximos 30 min, o todos, o por línea
- Color coding: verde = a tiempo, ámbar = demorado, rojo = suprimido, gris = salido/llegado
- Timeline lateral al seleccionar un tren

### 4.3 Fullscreen Display (`/fullscreen`)

| Aspecto               | Descripción                                                                        |
| --------------------- | ---------------------------------------------------------------------------------- |
| **Objetivo**          | Pantalla pública para monitor HDMI, sin decoraciones, sin cursor                   |
| **Usuario principal** | Público                                                                            |
| **Acciones**          | Ninguna (es solo visualización). Se configura desde `/admin` o `/event-setup`      |
| **Datos**             | Los mismos que `/` pero sin loading screen, sin bordes, sin elementos interactivos |
| **Endpoints**         | Los mismos que `/api/trains`, `/api/config`                                        |
| **Prioridad**         | **Alta**                                                                           |

Diferencias con `/` actual:

- Sin padding/márgenes del navegador (fullscreen API)
- Sin cursor tras 3s de inactividad
- Sin SteamTrain loading (pasa directo a datos o mensaje "Próximamente...")
- Header más compacto
- Footer más destacado (nombre del evento grande)
- Opcional: modo quiose (no recargar con F5, bloqueador de interacción)

### 4.4 Mobile Quick Control (`/mobile`)

| Aspecto               | Descripción                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| **Objetivo**          | Control táctil rápido desde móvil para operadores de módulo                  |
| **Usuario principal** | Operador de estación                                                         |
| **Acciones**          | Marcar Boarding/Departed/Arrived, +5 min, cambio rápido de vía, anunciar TTS |
| **Datos**             | Solo trenes próximos (30 min), tarjetas grandes con botones                  |
| **Endpoints**         | Los mismos de trains + delay + platform + status                             |
| **Prioridad**         | **Alta**                                                                     |

Diseño propuesto:

- Tarjetas verticales, una por tren
- Cada tarjeta: hora, destino, tipo, vía, estado actual
- Botones grandes (touch target ≥ 48px): [▶ Salido] [⏱ +5] [⏱ +15] [🛤 Vía] [🔊]
- Sin drag & drop, sin formularios, sin navegación compleja
- Pull-to-refresh + WebSocket para actualización en tiempo real
- Auto-scroll al tren más próximo

### 4.5 Import / Export (modal o página)

| Aspecto               | Descripción                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| **Objetivo**          | Compartir configuración entre eventos o entre organizadores                                            |
| **Usuario principal** | Organizador                                                                                            |
| **Acciones**          | Exportar configuración actual (.railboard.json), importar configuración, exportar histórico de jornada |
| **Datos**             | Config completa (estación, colores, operadores, tipos, lugares) + horario de trenes                    |
| **Endpoints**         | `GET /api/event/export`, `POST /api/event/import`                                                      |
| **Prioridad**         | **Media** (para V0.3)                                                                                  |

### 4.6 Diagnostics (`/diagnostics`)

| Aspecto               | Descripción                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Objetivo**          | Diagnóstico rápido para el admin técnico durante el evento                                                           |
| **Usuario principal** | Administrador técnico                                                                                                |
| **Acciones**          | Ver estado del servidor, conexiones WS activas, última actualización, test TTS, test WS broadcast, forzar refresh DB |
| **Datos**             | Uptime, número de clientes WS, última petición, estado SQLite, versión                                               |
| **Endpoints**         | `GET /api/status` (info server), `GET /api/ws/clients` (número conexiones)                                           |
| **Prioridad**         | **Baja** (útil pero no bloqueante)                                                                                   |

---

## 5. Mejoras sobre páginas actuales

### 5.1 `/` (Display)

- Añadir modo kiosko (fullscreen API + ocultar cursor)
- Añadir nombre del evento en header (desde config)
- Añadir indicador de "EN DIRECTO" con punto verde parpadeante
- El footer debe poder mostrar un mensaje configurable grande (el nombre del evento)
- Google Fonts: bundled o self-hosted para funcionar sin Internet

### 5.2 `/admin`

- Ya es la página de configuración general. Debe seguir siéndolo.
- Añadir sección "Evento" con: nombre, fecha, estado (inactivo/activo/finalizado)
- Añadir botón de exportar/importar configuración
- Mover generación aleatoria a Event Setup o Live Control (no mezclar con config de estación)
- El auto-generate puede estar aquí o en Event Setup

### 5.3 `/trains`

- Ya funciona bien para CRUD detallado. Mantener para el organizador.
- Añadir filtro rápido: "Solo activos" / "Todos"
- Añadir columna "Evento" (a qué jornada pertenece) — opcional, para V0.3
- El formulario de edición puede mostrar el timeline de cambios del tren

### 5.4 `/train-settings`

- Ya funciona bien. Mantener.
- Añadir posibilidad de crear operadores "invitados" (solo para este evento, borrar al finalizar)
- Indicar visualmente qué operadores/tipos se usarán en el evento actual

---

## 6. Requisitos funcionales

### RF-001: Gestión de jornada

El sistema debe permitir crear una jornada de evento con nombre, fecha, hora de inicio y fin, y estación principal.

### RF-002: Display público

El sistema debe mostrar un panel de salidas/llegadas en pantalla completa, sin elementos de administración, apto para proyección en monitor HDMI.

### RF-003: Control en tiempo real

El sistema debe permitir a múltiples operadores cambiar el estado, vía y retraso de los trenes desde dispositivos móviles, con actualización inmediata en todos los clientes.

### RF-004: Operación táctil

La interfaz móvil debe tener botones de al menos 48×48px y soportar gestos táctiles sin necesidad de teclado o ratón.

### RF-005: Histórico de operación

El sistema debe registrar cada cambio de estado, retraso y cambio de vía con timestamp, y permitir exportar el histórico al finalizar la jornada.

### RF-006: Importar/Exportar configuración

El sistema debe permitir exportar la configuración completa (operadores, tipos, lugares, colores, horarios) a un archivo JSON, e importarla en otra instancia.

### RF-007: Auto-generación contextual

El sistema debe generar trenes realistas basados en las rutas, operadores y tipos configurados, respetando horarios y frecuencias.

### RF-008: Megafonía TTS

El sistema debe poder anunciar por voz la salida/llegada de un tren, incluyendo número, destino/origen, vía y sector.

### RF-009: Avisos generales

El sistema debe permitir lanzar mensajes de megafonía personalizados (ej. "Atención, el taller de iniciación a la soldadura comenzará en 5 minutos").

### RF-010: Multi-operador

El sistema debe soportar múltiples conexiones simultáneas sin autenticación por usuario (la red local es el cortafuegos).

### RF-011: Modo sin conexión

El sistema debe funcionar completamente sin acceso a Internet (fuentes bundled, sin dependencias externas).

### RF-012: Indicador de estado

El display público debe mostrar un indicador visual de "EN DIRECTO" para que el público sepa que la información es actual.

---

## 7. Requisitos no funcionales

### RNF-001: LAN-first

Todo el tráfico es local. No requiere conexión a Internet. No requiere DNS. Funciona con IPs.

### RNF-002: Resiliencia ante recarga

Si cualquier cliente recarga la página, debe recuperar el estado completo sin pérdida de datos. El servidor SQLite persiste todo.

### RNF-003: Persistencia SQLite

Toda la configuración, trenes e histórico se guardan en SQLite. Sin migraciones destructivas.

### RNF-004: Pantalla completa

El display público debe soportar Fullscreen API y ocultar el cursor tras inactividad.

### RNF-005: Rendimiento en pantallas grandes

El display debe funcionar fluidamente en 1080p y 4K. Las animaciones deben estar aceleradas por GPU (CSS transform/opacity, no layout thrashing).

### RNF-006: Accesibilidad mínima

- Contraste suficiente entre texto y fondo (ratio ≥ 4.5:1 para texto normal)
- Tamaño de fuente mínimo 16px en móvil
- Etiquetas aria en botones de control
- Navegación por teclado en Live Control

### RNF-007: Seguridad razonable en red compartida

- BasicAuth en writes (ya implementado)
- Rate limiting (ya implementado)
- Sin exposición de la BD
- El admin password debe poderse cambiar por env var

### RNF-008: Sin dependencias externas en runtime

Google Fonts debe servirse desde local o bundled. Sin CDNs. Sin APIs externas. Sin telemetría.

---

## 8. Roadmap

### Versión 0.2 — Usable en evento pequeño (próximo hito)

Objetivo: Una persona con un portátil + monitor HDMI puede poner RailBoard en un encuentro pequeño de 5-10 personas.

- [x] Display público existente
- [x] CRUD trenes existente
- [x] CRUD operadores/tipos/lugares existente
- [ ] **NUEVO: Live Control** (`/control`) — tabla compacta con acciones rápidas
- [ ] **NUEVO: Gestión de jornada** — crear/finalizar jornada, estado activo/inactivo
- [ ] **MEJORA: Fullscreen API** en `/` + ocultar cursor
- [ ] **MEJORA: Google Fonts bundled** o self-hosted
- [ ] **MEJORA: Footer configurable** con nombre del evento
- [ ] **MEJORA: Indicador "EN DIRECTO"** en display
- [ ] **MEJORA: Filtro "Solo activos"** en `/trains`
- [ ] **NUEVO: Export/import configuración** básico (JSON)
- [ ] Tests: Admin.tsx, Trains.tsx

### Versión 0.3 — Evento modular completo

Objetivo: Varios operadores desde móvil. Histórico. Experiencia completa.

- [ ] **NUEVO: Mobile Quick Control** (`/mobile`) — tarjetas táctiles
- [ ] **NUEVO: Fullscreen Display** (`/fullscreen`) — modo kiosko puro
- [ ] **NUEVO: Histórico de operación** — log de cambios con timestamp
- [ ] **NUEVO: Exportar histórico** al finalizar jornada
- [ ] **MEJORA: Timeline de cambios** en detalle de tren
- [ ] **NUEVO: Avisos generales TTS** — mensaje personalizado + locución
- [ ] **MEJORA: Event Setup** como página dedicada
- [ ] **MEJORA: Operadores/tipos "de evento"** con flag temporal
- [ ] **NUEVO: Configuración de evento** en admin (nombre, fechas)

### Versión 0.4 — Experiencia ferroviaria avanzada

Objetivo: Funcionalidades que elevan la experiencia por encima de un simple panel.

- [ ] **NUEVO: Diagnostics** (`/diagnostics`) — estado del servidor, WS clients
- [ ] **NUEVO: Editor de rutas visual** — crear/modificar rutas desde la UI
- [ ] **NUEVO: Mapa de red** — representación visual de la maqueta con posición de trenes
- [x] **MEJORA: TTS multilingüe** — voz en valenciano/euskera/gallego para encuentros locales
- [ ] **NUEVO: Programación horaria** — asignar horarios fijos a trenes para simulación realista
- [ ] **NUEVO: Eventos programados** — cambios automáticos de vía/estado a horas concretas
- [ ] **NUEVO: Temas visuales** — paletas predefinidas (clásico RENFE, moderno, oscuro, vintage)
- [ ] **MEJORA: Panel de estadísticas** — trenes por hora, retraso medio, puntualidad
- [ ] Docker + docker-compose para deploy rápido en cualquier máquina

---

## 9. Backlog técnico

### Backend

| ID    | Tarea                                                                          | Prioridad | Versión |
| ----- | ------------------------------------------------------------------------------ | --------- | ------- |
| BE-01 | Crear tabla `sessions` (id, name, date, start_time, end_time, station, active) | Alta      | 0.2     |
| BE-02 | Crear endpoints CRUD para sesiones                                             | Alta      | 0.2     |
| BE-03 | Añadir campo `session_id` a tabla `trains`                                     | Alta      | 0.2     |
| BE-04 | Endpoint `GET /api/event/logs?train_id=X&session_id=Y` (histórico)             | Alta      | 0.3     |
| BE-05 | Endpoint `POST /api/event/export` → JSON completo                              | Alta      | 0.2     |
| BE-06 | Endpoint `POST /api/event/import` → cargar JSON                                | Alta      | 0.2     |
| BE-07 | Endpoint `GET /api/status` → info servidor (uptime, version, ws count)         | Baja      | 0.4     |
| BE-08 | Endpoint `GET /api/ws/clients` → número de conexiones WS activas               | Baja      | 0.4     |
| BE-09 | Endpoint `POST /api/announce` → broadcast de mensaje TTS a todos los clientes  | Alta      | 0.3     |
| BE-10 | Middleware de logging para histórico de cambios en trains                      | Alta      | 0.3     |
| BE-11 | Servir Google Fonts desde /static en lugar de Google CDN                       | Alta      | 0.2     |
| BE-12 | Añadir `POST /api/config/export` y `POST /api/config/import`                   | Media     | 0.2     |

### Frontend

| ID    | Tarea                                                                        | Prioridad | Versión |
| ----- | ---------------------------------------------------------------------------- | --------- | ------- |
| FE-01 | Crear página `/control` (Live Control) con tabla compacta y acciones rápidas | Alta      | 0.2     |
| FE-02 | Crear página `/event-setup` (gestión de jornada)                             | Alta      | 0.2     |
| FE-03 | Implementar Fullscreen API en Display con toggle                             | Alta      | 0.2     |
| FE-04 | Ocultar cursor tras 3s sin movimiento en display público                     | Alta      | 0.2     |
| FE-05 | Bundlear Google Fonts o servirlas desde backend                              | Alta      | 0.2     |
| FE-06 | Mostrar nombre del evento + "EN DIRECTO" en header del display               | Alta      | 0.2     |
| FE-07 | Crear página `/mobile` (Mobile Quick Control) con diseño táctil              | Alta      | 0.3     |
| FE-08 | Implementar filtro "Solo trenes activos" en `/trains`                        | Alta      | 0.2     |
| FE-09 | Implementar export/import de configuración desde admin                       | Media     | 0.2     |
| FE-10 | Añadir timeline de cambios en formulario de edición de tren                  | Media     | 0.3     |
| FE-11 | Modal de aviso general TTS con campo de texto                                | Media     | 0.3     |
| FE-12 | Crear página `/diagnostics`                                                  | Baja      | 0.4     |
| FE-13 | Añadir animación de "EN DIRECTO" (punto verde parpadeante)                   | Baja      | 0.2     |
| FE-14 | Tests para Admin.tsx                                                         | Alta      | 0.2     |
| FE-15 | Tests para Trains.tsx                                                        | Alta      | 0.2     |
| FE-16 | Tests para Live Control                                                      | Alta      | 0.3     |
| FE-17 | Tests para Mobile Quick Control                                              | Alta      | 0.3     |

---

## 10. Criterios de aceptación

RailBoard está listo para un encuentro real cuando:

1. **Display público**: Un monitor HDMI muestra el panel de salidas en pantalla completa, sin bordes ni cursores, actualizándose en tiempo real.

2. **Operación básica**: El organizador puede, desde el portátil, generar trenes, marcarlos como Boarding/Departed/Delayed, cambiarles la vía, y ver los cambios reflejados al instante en el display.

3. **Sin Internet**: Todo funciona con el portátil en modo avión. Fuentes cargadas, sin errores de red, sin CDNs.

4. **Resiliencia**: Si el navegador del display se cierra, al recargar vuelve al mismo estado sin pérdida de datos.

5. **Estabilidad**: El servidor no se cae durante 8 horas de uso continuo con refrescos cada 5 segundos.

6. **Rendimiento**: El display funciona a 60fps en 1080p con 20+ trenes visibles.

7. **Configuración rápida**: Un organizador nuevo puede tener RailBoard funcionando en menos de 5 minutos (descargar → npm install → npm run dev → abrir pantalla).

8. **Cierre ordenado**: Al finalizar, se puede exportar el histórico de la jornada.

---

## Apéndice A: Esquema de tabla `sessions`

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    date        TEXT NOT NULL,          -- ISO date
    start_time  TEXT NOT NULL,          -- HH:MM
    end_time    TEXT,                    -- HH:MM (nullable hasta que finalice)
    station     TEXT NOT NULL DEFAULT '',
    active      INTEGER NOT NULL DEFAULT 0,  -- 0=inactive, 1=active
    config      TEXT NOT NULL DEFAULT '{}',  -- snapshot JSON de la config
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE trains ADD COLUMN session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS event_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    train_id    INTEGER REFERENCES trains(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,    -- 'status_change', 'delay', 'platform_change', 'announcement', 'general_announce'
    old_value   TEXT,
    new_value   TEXT,
    message     TEXT,             -- human-readable description
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Apéndice B: Formato .railboard.json

```json
{
  "version": 1,
  "event": {
    "name": "Trobenord 2026",
    "date": "2026-06-15",
    "startTime": "10:00",
    "endTime": "19:00",
    "station": "Estación de Trobenord"
  },
  "config": {
    "station_name": "Estación de Trobenord",
    "mode": "departures",
    "language": "ca",
    "bgColor": "#050a14",
    "headerBgColor": "#BFEFD5",
    "headerTextColor": "#102341",
    "rowBgColor": "#1A3254",
    "altBgColor": "#102341",
    "footerText": "Trobenord 2026 · Bienvenidos"
  },
  "operators": [{ "name": "Renfe" }, { "name": "Iryo" }],
  "trainTypes": [{ "code": "AVE", "name": "Alta Velocidad", "color": "#7c1d2e" }],
  "places": [{ "name": "Madrid Puerta de Atocha" }, { "name": "Barcelona Sants" }],
  "trains": [
    {
      "number": "03104",
      "operator": "Renfe",
      "type": "AVE",
      "origin": "Estación de Trobenord",
      "destination": "Barcelona Sants",
      "scheduled_time": "10:15",
      "platform": "1"
    }
  ]
}
```

---

_Documento generado el 30 de mayo de 2026. Próximo hito: Versión 0.2._
