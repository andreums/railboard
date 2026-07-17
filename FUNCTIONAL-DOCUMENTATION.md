# Documentació funcional de RailBoard

> Sistema de panells informatius ferroviaris multiestació, inspirat en els panells Gravita/ADIF de Renfe.
> Lloc web: [https://railboard.app](https://railboard.app)

---

## Funcionalitat: Panell de sortides/arribades

**Objectiu:** Mostrar en pantalla completa els horaris de trens d'una estació, amb un disseny inspirat en els panells Gravita d'ADIF.

**Actors:** Viatgers (públic general), visitants de l'estació.

**Precondicions:** Hi ha almenys un display configurat amb una estació assignada i trens creats.

**Flux principal:**
1. El panell carrega la configuració del display (`/config`), la llista d'estacions (`/stations`) i els llocs (`/places`).
2. Sol·licita les dades del tauler via `GET /stations/:id/board?mode=departures|arrivals`.
3. Filtra els trens amb estat diferent de `Departed`/`Arrived`, els ordena per hora prevista i mostra fins a 12 files.
4. Cada fila es distribueix en dos sub-rols: superior (60%) amb TIME, DESTINATION, PRODUCT (logo + número), PLATFORM; inferior (40%) amb estat estimat, parades intermèdies, observacions i badge de Cercanías.
5. El footer mostra un text configurable amb animació `marquee`.
6. Si hi ha diversos idiomes configurats, alterna cada 5 segons entre ells.
7. El rellotge en mode real mostra l'hora del sistema; en mode fictici avança a una velocitat configurable.

**Fluxos alternatius:**
- Si l'endpoint board falla, fa fallback a `GET /trains` (llista plana de trens).
- Si no es troba cap tren o està carregant, es mostra l'animació `SteamTrain`.
- L'error de càrrega mostra un botó "Reintentar ahora".

**Errors esperables:**
- `GET /stations/:id/board` retorna 404 si l'estació no existeix.
- Error de configuració: es mostra "Error al cargar la configuración".

**Permisos:** Públic (cap autenticació).

**Dades implicades:** `Config` (estil, idiomes, mode), `Train[]` (trens), `Place[]` (destins), `Station[]` (estacions).

**Components tècnics:**
- `frontend/src/pages/Display.tsx` — Component principal del panell.
- `frontend/src/components/Clock.tsx` — Rellotge en mode real o fictici.
- `frontend/src/components/SteamTrain.tsx` — Animació de locomotora de vapor durant càrrega.
- `frontend/src/components/StatusPill.tsx` — Indicador d'estat visual.
- `frontend/src/lib/i18n.ts` — Sistema de traduccions (es, ca, en, fr, eu, gl).
- `frontend/src/lib/api.ts` — Connexió amb API i WebSocket.
- `backend/src/routes.js:1563-1674` — Endpoint `GET /stations/:stationId/board`.
- `backend/src/ws.js` — Notificacions WebSocket (`service_updated`).

**Riscos o limitacions:**
- La rotació d'idiomes mostra textos en diferents llengües sense control de temporització per fila.
- El marquee de parades es basa en `scrollWidth`, pot fallar si el text canvia dinàmicament.

**Evidències:** `frontend/src/pages/Display.tsx:1-841`, `frontend/src/components/Clock.tsx:1-45`, `frontend/src/components/SteamTrain.tsx:1-186`, `frontend/src/components/StatusPill.tsx:1-30`.

---

## Funcionalitat: Administració de trens (CRUD)

**Objectiu:** Gestionar els trens del sistema: crear, editar, eliminar, reordenar i exportar.

**Actors:** Administrador de l'estació.

**Precondicions:** L'usuari s'ha autenticat via HTTP Basic Auth.

**Flux principal:**
1. L'usuari accedeix a `/trains` (pàgina independent) o a la pestanya "Trenes" del panell d'administració.
2. Es carrega la llista de trens amb dades enriquides (operador, tipus, estació).
3. L'usuari pot:
   - **Crear:** Obre un modal amb formulari: número, operador, tipus, origen, destí, parades, hora programada/estimada, via, sector, estat, observacions, mode d'icona.
   - **Editar:** Modal preomplert amb dades del tren seleccionat.
   - **Eliminar:** Diàleg de confirmació `confirm()`.
   - **Reordenar:** Activa mode drag-and-drop amb `@dnd-kit` i envia l'ordre via `PUT /trains/reorder`.
   - **Anunciar:** Usa la Web Speech API per llegir un anunci de megafonia.
   - **Exportar:** `GET /trains/export` descarrega un JSON.

**Fluxos alternatius:**
- En mode reordenació, els IDs dels trens s'envien al backend per actualitzar `sort_order`.
- El càlcul de retràs és automàtic a partir de l'hora programada i l'estimada.

**Errors esperables:**
- `DELETE /trains/:id` → 404 si el tren no existeix.
- `POST /trains` → 400 si falten camps obligatoris.

**Permisos:** Administrador (Basic Auth).

**Dades implicades:** `Trains` (taula SQLite), `Operators`, `TrainTypes`, `Places`, `Stations`.

**Components tècnics:**
- `frontend/src/pages/Trains.tsx` — CRUD complet amb formulari, llista, drag and drop.
- `frontend/src/pages/Admin.tsx` — Secció de gestió de trens dins del panell admin (línies 639-696).
- `frontend/src/components/admin/GenerationPanel.tsx` — Generació ràpida de trens.
- `backend/src/routes.js:751-833` — Endpoints REST (`GET/POST/PUT/DELETE /trains`, `/trains/reorder`, `/trains/export`).
- `backend/src/db.js:57-301` — Taula i operacions CRUD.

**Riscos o limitacions:**
- El drag and drop només funciona en mode reordenació; no hi ha reordenació per defecte.
- L'eliminació massiva requereix header `X-Confirm: yes`.
- No hi ha paginació en llistes llargues.

**Evidències:** `frontend/src/pages/Trains.tsx:1-556`, `backend/src/routes.js:751-833`, `backend/src/db.js:57-301`.

---

## Funcionalitat: Generació intel·ligent de trens

**Objectiu:** Crear trens automàticament a partir de rutes reals del dataset ferroviari, amb horaris, retards i observacions realistes.

**Actors:** Administrador (generació manual o automàtica).

**Precondicions:** El dataset de rutes (`railboard_routes.json`) ha d'estar carregat. Hi ha d'haver operadors, tipus de tren i llocs al sistema.

**Flux principal:**
1. L'administrador prem "Generar 1 tren" o activa l'auto-generació amb interval configurable.
2. El backend crida `ensureLearnedRailData()` per assegurar que operadors, tipus i llocs base existeixen.
3. Selecciona una ruta del dataset amb ponderació inversa als usos recents (afavoreix rutes menys usades).
4. Determina direcció (anada/tornada) basada en la posició de l'estació dins la ruta.
5. Calcula l'horari: respecta `headwayMin` de la ruta, amb un 14% de probabilitat de tren "passat" (cap enrere).
6. Aplica perfil de retràs segons el tipus de tren:
   - Cercanías/Rodalies: 16% retràs, 3% cancel·lat.
   - Media Distància: 14% retràs, 3% cancel·lat.
   - AVE/AVANT/IRYO/OUIGO: 9% retràs, 2% cancel·lat.
   - Altres: 12% retràs, 3% cancel·lat.
7. Genera observacions multilingües des d'un banc de frases temàtiques (genèriques, servei, retràs, via, estat, informació).
8. Crea el tren a la base de dades i notifica via WebSocket.

**Fluxos alternatius:**
- Si no hi ha rutes disponibles per a l'estació/regió, retorna error 400.
- Si l'estació de destí és Xàtiva i la ruta és C-2, pot escurçar el trajecte (55% probabilitat).
- Les parades intermèdies es limiten a un màxim de 9; per a C-3 s'inclouen totes.

**Errors esperables:**
- 400 "No routes available from backend data" — El dataset de rutes no està carregat.
- 400 "No routes available for this display" — L'estació seleccionada no té rutes associades.

**Permisos:** Administrador (Basic Auth).

**Dades implicades:** `railboard_routes.json` (dataset), `routes` (servei), `Trains`, `Operators`, `TrainTypes`, `Places`.

**Components tècnics:**
- `backend/src/routes.js:1084-1222` — `POST /generate-random-train`.
- `backend/src/routes.js:1225-1304` — `POST /trains/from-route/:code`.
- `backend/src/services/routeService.js/ts` — Servei de rutes ferroviàries.
- `backend/src/fixtures/routes.js` — Dades de rutes (antigues RODALIA_ROUTES).
- `backend/src/fixtures/seedTrains.js` — Fixtures de demostració.
- `frontend/src/components/admin/GenerationPanel.tsx` — Interfície d'auto-generació.

**Riscos o limitacions:**
- El càlcul de `headwayMin` pot generar trens molt seguits si l'interval és massa petit.
- La generació no considera festius ni temporades.
- No hi ha validació de xoc d'horaris amb el mateix número de tren.

**Evidències:** `backend/src/routes.js:1084-1304`, `backend/src/fixtures/routes.js:1-74`, `backend/src/db.js:196-264`.

---

## Funcionalitat: Gestió d'operadors i tipus de tren

**Objectiu:** Mantenir un catàleg d'operadors ferroviaris i tipus de tren amb logotips i àudios de pre-anunci.

**Actors:** Administrador.

**Precondicions:** L'usuari està autenticat.

**Flux principal:**
1. L'usuari accedeix a `/train-settings`.
2. Es mostren dues columnes: Operadors i Tipus de tren.
3. Per a cada element, es pot:
   - **Editar:** Modal amb camps (nom, logo, àudio de pre-anunci).
   - **Eliminar:** Confirmació i eliminació directa.
   - **Crear:** Formulari inline a la part inferior de cada catàleg.
4. Els logotips es pugen com a imatges (PNG, JPG, GIF, WebP, SVG).
5. Els àudios de pre-anunci es pugen com a OGG/Opus/MP3 (màxim 5 MB).

**Fluxos alternatius:**
- Els operadors i tipus base es creen automàticament via `ensureLearnedRailData()` durant la generació de trens.

**Errors esperables:**
- L'upload de fitxers invàlids retorna error `FILE_TYPE_NOT_ALLOWED`.
- L'eliminació d'un tipus usat per trens existents deixa `train_type_id = NULL`.

**Permisos:** Administrador (Basic Auth).

**Dades implicades:** `Operators` (id, name, logo_url, pre_announce_ogg), `TrainTypes` (id, code, name, color, logo_url, destination_icon_url, pre_announce_ogg).

**Components tècnics:**
- `frontend/src/pages/TrainSettings.tsx` — Interfície de gestió amb modals i formularis.
- `backend/src/routes.js:835-966` — Endpoints REST per operadors i tipus de tren.
- `backend/src/db.js:316-374` — CRUD genèric per a operadors, tipus, places i icones.
- `backend/src/routes.js:55-69` — Configuració de `multer` per a pujada d'àudios.

**Riscos o limitacions:**
- No hi ha control de versions per a logotips.
- Els àudios de pre-anunci no es reprodueixen automàticament al panell públic.

**Evidències:** `frontend/src/pages/TrainSettings.tsx:1-203`, `backend/src/routes.js:835-966`, `backend/src/db.js:316-374`.

---

## Funcionalitat: Serveis multi-parada

**Objectiu:** Gestionar serveis ferroviaris complexos amb múltiples parades a través de diverses estacions, amb control d'estats i traçabilitat.

**Actors:** Administrador, sistema de monitoratge.

**Precondicions:** Hi ha estacions, operadors i tipus de tren configurats al sistema.

**Flux principal:**
1. L'administrador crea un servei amb número, operador, tipus de tren, origen i destí.
2. Afegeix parades al servei, cada una amb:
   - Tipus de parada: `Origin` (origen), `Stop` (aturada), `Pass` (pas sense aturada), `Destination` (destí final).
   - Horari programat d'arribada i/o sortida.
   - Via i sector assignats.
3. Durant l'operació, es marquen esdeveniments sobre cada parada:
   - `POST /stops/:id/arrival` — Marca l'arribada.
   - `POST /stops/:id/departure` — Marca la sortida.
   - `POST /stops/:id/pass` — Marca pas sense aturada.
4. El sistema propaga el retràs entre parades consecutives automàticament, tret que la parada tingui `delay_locked = true`.

**Fluxos alternatius:**
- **Cancel·lació:** `POST /services/:id/cancel` — Cancel·la el servei i totes les seves parades.
- **Retràs manual:** `POST /stops/:id/delay` — Afegeix retràs a una parada específica.
- **Reordenació:** `POST /services/:id/stops/reorder` — Reordena les parades del servei.

**Errors esperables:**
- 400 si falten camps obligatoris (`number`, `station_id`, `stop_number`, `stop_type`).
- 404 si el servei o la parada no existeixen.

**Permisos:** Administrador (Basic Auth).

**Dades implicades:**
- `services` — Servei amb estat (Scheduled → In Progress → Completed / Cancelled).
- `service_stops` — Parades amb estats (Scheduled → Arrived → Departed → Passed → Completed).
- `service_events` — Traçabilitat d'esdeveniments (audit trail).

**Components tècnics:**
- `frontend/src/components/admin/ServicesPanel.tsx` — Interfície de gestió de serveis i parades.
- `backend/src/routes.js:1306-1557` — Endpoints de serveis, parades i operacions.
- `backend/src/db.js:504-882` — Taules `services`, `service_stops`, `service_events`, operacions CRUD i màquina d'estats.
- `backend/src/ws.js` — Notificacions de canvis d'estat.

**Riscos o limitacions:**
- La propagació de retràs no considera el temps de volta ni la disponibilitat de material.
- L'audit trail (`service_events`) no és purgable; pot créixer indefinidament.

**Evidències:** `frontend/src/components/admin/ServicesPanel.tsx:1-501`, `backend/src/routes.js:1306-1557`, `backend/src/db.js:504-882`.

---

## Funcionalitat: Configuració multiestació (DisplayConfig)

**Objectiu:** Gestionar la configuració individual de cada display/estació del sistema, incloent aspectes visuals, idiomes, vies i mode de visualització.

**Actors:** Administrador.

**Precondicions:** L'usuari està autenticat.

**Flux principal:**
1. L'usuari accedeix a `/admin/displays` (ruta múltiple) o directament a `/admin/displays/:id`.
2. En mode múltiple, es mostra una graella de totes les estacions; en mode únic, es mostra directament l'única estació.
3. Per a cada display, es configuren:
   - **Config general:** Nom de l'estació, mode (sortides/llegades), regió/ciutat per filtrar rutes, idiomes (selecció múltiple de es/ca/en/fr/eu/gl), URL del logotip.
   - **Vies i sectors:** Rang mínim/màxim, opció de permetre buit, mostrar icona de destí.
   - **Estil i rellotge:** Colors (fons, capçalera, text de capçalera, fila principal, fila alterna), mode de rellotge (real/fictici), hora fictícia, avanç (1s/2s/5s/10s/15s per segon real), text del footer.
   - **Trenes:** Llista dels trens associats al display, amb accions per afegir, generar, exportar o buidar.
   - **Tipus de tren:** Assignació d'icones de destí per tipus de tren.

**Fluxos alternatius:**
- Si el mode global és `single`, s'ignora el paràmetre d'URL i es mostra sempre la mateixa estació.
- Es pot crear un nou display (estació) des del panell.

**Errors esperables:**
- Error en guardar la configuració es mostra com a notificació d'error.
- Si no hi ha displays, es mostra un missatge d'avís.

**Permisos:** Administrador (Basic Auth).

**Dades implicades:**
- `stations` — Taula d'estacions (id, name, short, logo_url, color).
- `station_display_configs` — Configuració per estació emmagatzemada com a JSON.

**Components tècnics:**
- `frontend/src/pages/DisplayConfig.tsx` — Pàgina completa de configuració de display.
- `backend/src/routes.js:727-749` — Endpoints `GET/PUT /stations/:id/config`.
- `backend/src/db.js:459-502` — Funcions `getStationDisplayConfig`, `setStationDisplayConfig`, `listStationDisplayConfigs`.

**Riscos o limitacions:**
- La configuració es guarda com a JSON sense esquema fix; canvis al schema poden requerir migracions.
- No hi ha validació de rang per a vies i sectors (es permeten valors no numèrics/alphabetics).

**Evidències:** `frontend/src/pages/DisplayConfig.tsx:1-981+`, `backend/src/routes.js:727-749`, `backend/src/db.js:459-502`.

---

## Funcionalitat: Locucions i TTS (Text-to-Speech)

**Objectiu:** Gestionar locucions de megafonia amb suport multilingüe i síntesi de veu via Web Speech API.

**Actors:** Administrador, viatgers (escolten els anuncis).

**Precondicions:** El navegador admet Web Speech API.

**Flux principal:**
1. L'administrador accedeix a la pestanya "Veu" o "Locuciones" del panell d'administració.
2. Configura les plantilles d'anunci per a sortides i arribades, amb variables `{number}`, `{type_name}`, `{destination}`, `{platform}`, `{sector}`.
3. Cada idioma pot tenir la seva pròpia plantilla via el mapa `announce_templates_map`.
4. Es poden definir presets d'anuncis (benvinguda, tancament, retràs, etc.).
5. La configuració de veu inclou: velocitat (rate), to (pitch), volum i selecció de veu per idioma.
6. L'anunci es dispara des de la interfície d'administració o des de la pàgina de trens, usant `window.speechSynthesis.speak()`.

**Fluxos alternatius:**
- **Pre-anunci:** Si el tipus de tren o l'operador té un fitxer d'àudio de pre-anunci (OGG/Opus/MP3), es reprodueix abans de la síntesi de veu.
- **Llista de veus:** Es carrega automàticament de `speechSynthesis.getVoices()`.

**Errors esperables:**
- Si el navegador no suporta Web Speech API, el botó d'anunciar no fa res visible.
- Les veus poden no estar disponibles per a tots els idiomes configurats.

**Permisos:** Administrador (Basic Auth).

**Dades implicades:**
- Config: `tts_rate`, `tts_pitch`, `tts_volume`, `tts_voice`, `tts_voice_map`, `announce_departure`, `announce_arrival`, `announce_templates_map`, `announce_presets`.
- Àudios de pre-anunci a `Operators.pre_announce_ogg`, `TrainTypes.pre_announce_ogg`, `Stations.pre_announce_ogg`.

**Components tècnics:**
- `frontend/src/lib/tts.ts` — Funcions `speak`, `renderTemplate`, `defaultTemplate`, `loadVoiceSettings`, `getVoices`, `getVoiceURIForLanguage`.
- `frontend/src/components/admin/LocutionsPanel.tsx` — Interfície de gestió de plantilles i presets.
- `frontend/src/pages/Admin.tsx:698-757` — Configuració de veu i tests d'anunci.

**Riscos o limitacions:**
- Web Speech API no funciona en tots els navegadors (especialment en iOS/chromium).
- No hi ha fallback si la veu seleccionada no està disponible (es queda en silenci).
- Els àudios de pre-anunci no tenen temporització sincronitzada amb la TTS.

**Evidències:** `frontend/src/lib/tts.ts:1-258`, `frontend/src/components/admin/LocutionsPanel.tsx:1-73`, `frontend/src/pages/Admin.tsx:698-757`.

---

## Funcionalitat: PWA i mode offline

**Objectiu:** Permetre que RailBoard funcioni com a aplicació instal·lable i tingui resiliència bàsica a fallades de xarxa.

**Actors:** Viatgers (instal·len i usen l'app), administradors (en mode offline parcial).

**Precondicions:** El navegador admet Service Workers.

**Flux principal:**
1. Al primer accés, el Service Worker (`sw.js`) s'instal·la i emmagatzema en cache recursos estàtics (`/`, `/manifest.json`, `/fonts/fonts.css`).
2. Per a peticions d'arxius estàtics (JS, CSS, PNG, JPG, ICO, SVG, WOFF2, TTF, EOT): **cache-first** — si està en cache, serveix del cache; altrament, fa fetch i l'emmagatzema.
3. Per a peticions a `/api/` o `/admin/`: **network-first** — primer intenta xarxa; si falla, serveix del cache.
4. Per a navegació: network-first, amb caiguda a la pàgina principal en cache.

**Fluxos alternatius:**
- Si tot falla en mode offline per a una API, retorna `{"error": "Offline"}` amb codi 503.

**Errors esperables:**
- 503 "Offline" per a peticions d'API quan no hi ha cache ni connexió.

**Permisos:** Públic (cap autenticació).

**Dades implicades:**
- `CACHE = "railboard-v1"` — Nom del cache.
- `manifest.json` — Configuració d'instal·lació (name, short_name, description, icons).

**Components tècnics:**
- `frontend/public/sw.js` — Service Worker amb estratègies cache-first / network-first.
- `frontend/public/manifest.json` — Manifest d'aplicació web progressiva.
- `frontend/public/fonts/` — 6 famílies de fonts tipogràfiques locals (Oswald, Roboto Condensed, Roboto Mono, etc.).
- `frontend/src/pages/Display.tsx:36-42` — Injecció dinàmica del full d'estils de fonts via JavaScript.

**Riscos o limitacions:**
- Estratègia cache-first per a estàtics: les actualitzacions requereixen un nou `CACHE` versionat.
- Les peticions d'admin amb Basic Auth no es cachegen correctament si la resposta no inclou els headers adequats.
- No hi ha cache per a imatges dinàmiques (logotips, icones pujats per l'usuari).
- L'aplicació no pot funcionar completament offline perquè les dades de trens requereixen API.

**Evidències:** `frontend/public/sw.js:1-82`, `frontend/public/manifest.json:1-16`, `frontend/public/fonts/fonts.css`.

---

## Funcionalitat: Panell d'administració complet

**Objectiu:** Proporcionar una interfície unificada per a totes les operacions de gestió del sistema RailBoard.

**Actors:** Administrador.

**Precondicions:** L'usuari està autenticat.

**Flux principal:**
1. L'administrador accedeix a `/admin` i veu un panell amb barra lateral esquerra organitzada en grups:
   - **General:** Dashboard, Validació, Importació de dades.
   - **Infraestructura ferroviària:** Rutes, Operadors, Trenes, Tipus de tren, Destins, Serveis.
   - **Displays i señalètica:** Displays, Estació actual, Estils.
   - **Audio i locucions:** Veu i idiomes, Locuciones.
2. Cada pestanya mostra el seu contingut específic:
   - **Dashboard:** KPIs (rutes, estacions, xarxes, operadors, displays, trens), estat del backend, resum operatiu.
   - **Estació:** Configuració general (nom, mode, idioma, footer).
   - **Rutes:** Navegador de rutes amb filtres per regió/xarxa/operador, generació de trens des de ruta.
   - **Validation:** Anàlisi de consistència de dades (rutes duplicades, estacions sense display).
   - **Import:** Validació i previsualització d'importació JSON de rutes.
   - **Estils:** Personalització visual (colors de fons, capçalera, files).
   - **Destins:** CRUD de llocs/destins.
   - **Serveis:** Gestió de serveis multi-parada.
   - **Displays:** Enllaç a `DisplayConfig.tsx`.

**Fluxos alternatius:**
- El panell mostra notificacions toast per a operacions exitoses/fallides.
- Les dades es refresquen automàticament via WebSocket i polling.

**Errors esperables:**
- Errors d'API es capturen i es mostren com a notificacions o missatges d'error inline.
- La validació de rutes detecta errors (falten camps, rutes duplicades) i warnings (sense estacions, sense displays).

**Permisos:** Administrador (Basic Auth).

**Dades implicades:** Totes les taules del sistema: Config, Stations, Trains, Operators, TrainTypes, Places, Routes, Services, ServiceStops.

**Components tècnics:**
- `frontend/src/pages/Admin.tsx` — Component principal del panell d'administració.
- `frontend/src/components/admin/GenerationPanel.tsx` — Generació i auto-generació de trens.
- `frontend/src/components/admin/RoutesPanel.tsx` — Navegador de rutes amb filtres.
- `frontend/src/components/admin/ServicesPanel.tsx` — Gestió de serveis multi-parada.
- `frontend/src/components/admin/StationPanel.tsx` — Configuració de l'estació actual.
- `frontend/src/components/admin/StylesPanel.tsx` — Personalització d'estils.
- `frontend/src/components/admin/LocutionsPanel.tsx` — Plantilles de locucions.
- `frontend/src/components/admin/PlacesPanel.tsx` — CRUD de destins.
- `frontend/src/components/admin/WSLogPanel.tsx` — Log de WebSocket.
- `frontend/src/components/admin/StationPanel.tsx` — Configuració de display per estació.

**Riscos o limitacions:**
- La interfície d'administració no és responsiva per a dispositius mòbils (sidebar ocult en `lg:`).
- La validació de rutes és bàsica (format de camps, sense verificació de consistència geogràfica).

**Evidències:** `frontend/src/pages/Admin.tsx:1-1121+`, `frontend/src/components/admin/GenerationPanel.tsx:1-35`, `frontend/src/components/admin/RoutesPanel.tsx:1-214`, `frontend/src/components/admin/ServicesPanel.tsx:1-501`, `frontend/src/components/admin/StylesPanel.tsx:1-43`, `frontend/src/components/admin/LocutionsPanel.tsx:1-73`, `backend/src/routes.js:1-1676`.
