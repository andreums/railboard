import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Route as RouteIcon,
  Building2,
  Train as TrainIcon,
  MapPin,
  GitBranch,
  Monitor,
} from "lucide-react";
import {
  api,
  connectWS,
  fileUrl,
  type Config,
  type Place,
  type Train,
  type Route,
  type Operator,
  type TrainType,
  type Station,
  type DisplaySummary,
} from "../lib/api";
import { fetchNetworks, fetchStations, reloadRailwayRoutes, type RailwayReloadStats } from "../services/routeApi";
import GenerationPanel from "../components/admin/GenerationPanel";
import ServicesPanel from "../components/admin/ServicesPanel";
import RoutesPanel from "../components/admin/RoutesPanel";
import WSLogPanel from "../components/admin/WSLogPanel";
import MegaphonyPanel from "../components/admin/MegaphonyPanel";
import DisplayScreensPanel from "../components/admin/DisplayScreensPanel";
import DevicesPanel from "../components/admin/DevicesPanel";
import SimulationPanel from "../components/admin/SimulationPanel";
import HardwarePanel from "../components/admin/HardwarePanel";
import AudioNodesPanel from "../components/admin/AudioNodesPanel";
import AutomationPanel from "../components/admin/AutomationPanel";
import AdminSidebar from "../components/admin/AdminSidebar";
import { findNavTitle } from "../lib/adminNav";
import { LANGUAGES, type Language } from "../lib/i18n";
import {
  speak,
  loadVoiceSettings,
  getVoices,
  defaultTemplate,
  getAnnouncementTemplate,
  getVoiceURIForLanguage,
  renderTemplate,
  type AnnouncePreset,
  type VoiceSettings,
} from "../lib/tts";
import { handleImgError } from "../lib/svgPlaceholder";
import { buildPlatformOptions, buildSectorOptions } from "../lib/trainOptions";
import { normalizeStops, type TrainStop } from "../lib/trainStops";
import StopsEditor from "../components/admin/StopsEditor";

type TabType =
  | "dashboard"
  | "station"
  | "displays"
  | "displayScreens"
  | "trains"
  | "routes"
  | "operators"
  | "types"
  | "styles"
  | "places"
  | "services"
  | "locutions"
  | "voice"
  | "validation"
  | "import"
  | "megaphony"
  | "devices"
  | "simulation"
  | "hardware"
  | "audioNodes"
  | "automation";
type NotificationType = "success" | "error" | "info";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
}

const TEST_TEXTS: Record<string, string> = {
  es: "Prueba de voz del sistema de megafonía. Velocidad, tono y volumen configurados correctamente.",
  ca: "Prova de veu del sistema de megafonia. Velocitat, to i volum configurats correctament.",
  en: "Voice test of the public address system. Speed, pitch and volume configured correctly.",
  fr: "Test vocal du système de sonorisation. Vitesse, ton et volume configurés correctement.",
  eu: "Megafonia sistemaren ahots proba. Abiadura, tonua eta bolumena behar bezala konfiguratuta.",
  gl: "Proba de voz do sistema de megafonía. Velocidade, ton e volume configurados correctamente.",
};

type AnnouncementScenarioKey =
  | "departure"
  | "arrival"
  | "delay"
  | "cancelled"
  | "maintenance"
  | "platform_change"
  | "service_normal"
  | "welcome"
  | "closing"
  | "information";

const SAMPLE_DEPARTURE = {
  number: "AVE 123",
  type_name: "AVE",
  type_code: "AVE",
  origin: "Madrid Puerta de Atocha",
  destination: "Barcelona Sants",
  platform: "1",
  sector: "A",
  status: "Scheduled",
  stops: ["Zaragoza-Delicias", "Lleida"],
};

const SAMPLE_ARRIVAL = {
  number: "AVE 123",
  type_name: "AVE",
  type_code: "AVE",
  origin: "Barcelona Sants",
  destination: "Madrid Puerta de Atocha",
  platform: "4",
  sector: "B",
  status: "Scheduled",
  stops: ["Lleida", "Zaragoza-Delicias"],
};

const ANNOUNCEMENT_SCENARIOS: Array<{
  key: AnnouncementScenarioKey;
  label: Record<Language, string>;
  build: (language: Language) => string;
}> = [
  {
    key: "departure",
    label: { es: "Salida", ca: "Eixida", va: "Eixida", en: "Departure", fr: "Départ", eu: "Irteera", gl: "Saída" },
    build: (language) => renderTemplate(defaultTemplate("departures", language), SAMPLE_DEPARTURE, language),
  },
  {
    key: "arrival",
    label: { es: "Llegada", ca: "Arribada", va: "Arribada", en: "Arrival", fr: "Arrivée", eu: "Iritsiera", gl: "Chegada" },
    build: (language) => renderTemplate(defaultTemplate("arrivals", language), SAMPLE_ARRIVAL, language),
  },
  {
    key: "delay",
    label: { es: "Retraso", ca: "Retard", va: "Retard", en: "Delay", fr: "Retard", eu: "Atzerapena", gl: "Retraso" },
    build: (language) =>
      ({
        es: "Atención. El tren AVE 123 con destino a Barcelona Sants presenta un retraso de 12 minutos por una incidencia en la infraestructura.",
        ca: "Atenció. El tren AVE 123 amb destinació a Barcelona Sants presenta un retard de 12 minuts per una incidència a la infraestructura.",
        va: "Atenció. El tren AVE 123 amb destinació a Barcelona Sants presenta un retard de 12 minuts per una incidència en la infraestructura.",
        en: "Attention. Train AVE 123 to Barcelona Sants is running 12 minutes late due to an infrastructure incident.",
        fr: "Attention. Le train AVE 123 à destination de Barcelone-Sants accuse un retard de 12 minutes en raison d’un incident d’infrastructure.",
        eu: "Adi. Barcelona Santsera doan AVE 123 trenak 12 minutuko atzerapena du azpiegiturako gorabehera baten ondorioz.",
        gl: "Atención. O tren AVE 123 con destino a Barcelona Sants leva un retraso de 12 minutos por unha incidencia na infraestrutura.",
      })[language],
  },
  {
    key: "cancelled",
    label: { es: "Cancelación", ca: "Cancel·lació", va: "Cancel·lació", en: "Cancellation", fr: "Annulation", eu: "Ezeztapena", gl: "Cancelación" },
    build: (language) =>
      ({
        es: "Atención. El tren AVE 123 ha sido cancelado por motivos operativos. Rogamos disculpen las molestias.",
        ca: "Atenció. El tren AVE 123 ha estat cancel·lat per motius operatius. Disculpeu les molèsties.",
        va: "Atenció. El tren AVE 123 ha sigut cancel·lat per motius operatius. Disculpeu les molèsties.",
        en: "Attention. Train AVE 123 has been cancelled for operational reasons. We apologise for the inconvenience.",
        fr: "Attention. Le train AVE 123 a été annulé pour des raisons opérationnelles. Nous vous prions de nous excuser pour la gêne occasionnée.",
        eu: "Adi. AVE 123 trena arrazoi operatiboengatik ezeztatu da. Barkatu eragozpenak.",
        gl: "Atención. O tren AVE 123 foi cancelado por motivos operativos. Rogamos desculpen as molestias.",
      })[language],
  },
  {
    key: "maintenance",
    label: { es: "Obras", ca: "Obres", va: "Obres", en: "Maintenance", fr: "Travaux", eu: "Mantentzea", gl: "Obras" },
    build: (language) =>
      ({
        es: "Atención. Rogamos disculpen las molestias. Se están realizando trabajos de mantenimiento en la infraestructura.",
        ca: "Atenció. Disculpeu les molèsties. S’estan realitzant treballs de manteniment a la infraestructura.",
        va: "Atenció. Disculpeu les molèsties. S’estan realitzant treballs de manteniment en la infraestructura.",
        en: "Attention. We apologise for the inconvenience. Maintenance work is being carried out on the infrastructure.",
        fr: "Attention. Nous vous prions de nous excuser pour la gêne occasionnée. Des travaux de maintenance sont en cours sur l’infrastructure.",
        eu: "Adi. Barkatu eragozpenak. Azpiegituran mantentze lanak egiten ari dira.",
        gl: "Atención. Rogamos desculpen as molestias. Estanse realizando traballos de mantemento na infraestrutura.",
      })[language],
  },
  {
    key: "platform_change",
    label: {
      es: "Cambio de vía",
      ca: "Canvi de via",
      va: "Canvi de via",
      en: "Platform change",
      fr: "Changement de voie",
      eu: "Nasa aldaketa",
      gl: "Cambio de vía",
    },
    build: (language) =>
      ({
        es: "Atención. El tren AVE 123 efectuará su salida por la vía 4, sector B. Les rogamos consulten el panel.",
        ca: "Atenció. El tren AVE 123 efectuarà la sortida per la via 4, sector B. Consulteu el panell.",
        va: "Atenció. El tren AVE 123 efectuarà l’eixida per la via 4, sector B. Consulteu el panell.",
        en: "Attention. Train AVE 123 will depart from platform 4, sector B. Please check the information board.",
        fr: "Attention. Le train AVE 123 partira voie 4, secteur B. Veuillez consulter le panneau.",
        eu: "Adi. AVE 123 trena 4. bidetik, B sektorean, irtengo da. Mesedez, kontsultatu panela.",
        gl: "Atención. O tren AVE 123 sairá pola vía 4, sector B. Consulten o panel informativo.",
      })[language],
  },
  {
    key: "service_normal",
    label: {
      es: "Servicio normal",
      ca: "Servei normal",
      va: "Servei normal",
      en: "Normal service",
      fr: "Service normal",
      eu: "Zerbitzu arrunta",
      gl: "Servizo normal",
    },
    build: (language) =>
      ({
        es: "Atención. Servicio habitual. No se registran incidencias en la circulación.",
        ca: "Atenció. Servei habitual. No es registren incidències en la circulació.",
        va: "Atenció. Servei habitual. No es registren incidències en la circulació.",
        en: "Attention. Normal service is operating. No incidents have been reported.",
        fr: "Attention. Service normal en cours. Aucun incident n’a été signalé.",
        eu: "Adi. Zerbitzu arrunta martxan dago. Ez da gorabeherarik jakinarazi.",
        gl: "Atención. Servizo normal en funcionamento. Non se rexistraron incidencias na circulación.",
      })[language],
  },
  {
    key: "welcome",
    label: { es: "Bienvenida", ca: "Benvinguda", va: "Benvinguda", en: "Welcome", fr: "Bienvenue", eu: "Ongi etorri", gl: "Benvida" },
    build: (language) =>
      ({
        es: "Bienvenidos a la estación. Mantengan su billete a mano y no crucen las vías.",
        ca: "Benvinguts a l’estació. Mantingueu el vostre bitllet a mà i no creueu les vies.",
        va: "Benvinguts a l’estació. Mantingueu el vostre bitllet a mà i no creueu les vies.",
        en: "Welcome to the station. Please keep your ticket handy and do not cross the tracks.",
        fr: "Bienvenue en gare. Gardez votre billet à portée de main et ne traversez pas les voies.",
        eu: "Ongi etorri geltokira. Gorde txartela eskura eta ez gurutzatu bideak.",
        gl: "Benvidos á estación. Manteñan o billete á man e non crucen as vías.",
      })[language],
  },
  {
    key: "closing",
    label: { es: "Cierre", ca: "Tancament", va: "Tancament", en: "Closing", fr: "Fermeture", eu: "Itxiera", gl: "Peche" },
    build: (language) =>
      ({
        es: "Atención. La estación va a cerrar en breve. Asegúrense de recoger todas sus pertenencias.",
        ca: "Atenció. L’estació tancarà en breu. Assegureu-vos de recollir totes les vostres pertinences.",
        va: "Atenció. L’estació tancarà en breu. Assegureu-vos de recollir totes les vostres pertinences.",
        en: "Attention. The station will close shortly. Please make sure you have all your belongings.",
        fr: "Attention. La gare va fermer prochainement. Veuillez vérifier que vous avez bien toutes vos affaires.",
        eu: "Adi. Geltokia laster itxiko da. Ziurtatu zure gauza guztiak jasotzen dituzula.",
        gl: "Atención. A estación vai pechar en breve. Asegúrense de recoller todas as súas pertenzas.",
      })[language],
  },
  {
    key: "information",
    label: { es: "Información", ca: "Informació", va: "Informació", en: "Information", fr: "Information", eu: "Informazioa", gl: "Información" },
    build: (language) =>
      ({
        es: "Atención. Para información adicional, consulten los paneles de salida o al personal de estación.",
        ca: "Atenció. Per a informació addicional, consulteu els panells de sortida o el personal de l’estació.",
        va: "Atenció. Per a informació addicional, consulteu els panells d’eixida o el personal de l’estació.",
        en: "Attention. For further information, please check the departure boards or ask station staff.",
        fr: "Attention. Pour toute information complémentaire, veuillez consulter les panneaux de départ ou le personnel en gare.",
        eu: "Adi. Informazio gehiago nahi izanez gero, kontsultatu irteera panelak edo geltokiko langileak.",
        gl: "Atención. Para información adicional, consulten os paneis de saída ou ao persoal da estación.",
      })[language],
  },
];

const normalizeStationName = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const LANGUAGE_KEYS = Object.keys(LANGUAGES) as Language[];

type AnnouncementTemplateSet = {
  departures: string;
  arrivals: string;
};

type ValidationIssue = {
  level: "error" | "warning";
  title: string;
  detail: string;
};

type ImportedRouteSummary = {
  valid: boolean;
  routes: number;
  stations: number;
  networks: number;
  operators: number;
  issues: ValidationIssue[];
};

const buildTemplateDefaults = (language: Language): AnnouncementTemplateSet => ({
  departures: defaultTemplate("departures", language),
  arrivals: defaultTemplate("arrivals", language),
});

const normalizeRouteKey = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeDisplayLanguages = (config: Config | null): Language[] => {
  const langs = config?.languages?.length ? config.languages : [(config?.language as Language) ?? "es"];
  return Array.from(new Set(langs.map((language) => language as Language))).filter(Boolean);
};

function computeRouteValidation(routes: Route[], stations: Station[], displays: DisplaySummary[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const duplicated = new Set<string>();

  routes.forEach((route) => {
    const codeKey = normalizeRouteKey(route.code);
    if (seen.has(codeKey)) duplicated.add(route.code);
    seen.add(codeKey);
    if (!route.name?.trim()) issues.push({ level: "error", title: `Ruta ${route.code}`, detail: "Falta el nombre de la ruta." });
    if (!route.network?.trim()) issues.push({ level: "error", title: `Ruta ${route.code}`, detail: "Falta la red ferroviaria." });
    if (!route.operator?.trim()) issues.push({ level: "error", title: `Ruta ${route.code}`, detail: "Falta el operador." });
    if (!Array.isArray(route.stations) || route.stations.length === 0) {
      issues.push({ level: "warning", title: `Ruta ${route.code}`, detail: "No tiene estaciones asociadas." });
    }
  });

  duplicated.forEach((code) => {
    issues.push({ level: "error", title: `Ruta duplicada`, detail: `Existe más de una ruta con el código ${code}.` });
  });

  if (stations.length === 0) {
    issues.push({ level: "warning", title: "Estaciones", detail: "No hay estaciones cargadas en el sistema." });
  }
  if (displays.length === 0) {
    issues.push({ level: "warning", title: "Displays", detail: "No hay displays configurados." });
  }

  return issues;
}

function summarizeImportedRoutes(raw: any): ImportedRouteSummary {
  const payload = Array.isArray(raw) ? raw : Array.isArray(raw?.routes) ? raw.routes : [];
  const issues: ValidationIssue[] = [];
  const validRoutes = (payload as any[]).filter((route: any) => {
    const required = ["code", "name", "network", "operator", "color", "headwayMin", "platforms", "numbers", "stations"];
    if (!route || typeof route !== "object") return false;
    for (const field of required) {
      if (!(field in route)) {
        issues.push({ level: "error", title: "Importación JSON", detail: `Falta el campo obligatorio "${field}" en una ruta.` });
        return false;
      }
    }
    return true;
  });

  const stations = new Set<string>();
  const networks = new Set<string>();
  const operators = new Set<string>();
  validRoutes.forEach((route: any) => {
    if (typeof route.network === "string") networks.add(route.network.trim());
    if (typeof route.operator === "string") operators.add(route.operator.trim());
    if (Array.isArray(route.stations)) {
      route.stations.forEach((station: string) => station && stations.add(String(station).trim()));
    }
  });

  return {
    valid: issues.filter((issue) => issue.level === "error").length === 0,
    routes: validRoutes.length,
    stations: stations.size,
    networks: networks.size,
    operators: operators.size,
    issues,
  };
}

function VoiceSelect({ voices, value, onChange, placeholder }: {
  voices: SpeechSynthesisVoice[];
  value: string;
  onChange: (uri: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [serverVoices, setServerVoices] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open || serverVoices.length > 0) return;
    api.ttsListVoices().then(setServerVoices).catch(() => {});
  }, [open, serverVoices.length]);

  const allVoices = [
    ...serverVoices.map((v) => ({ voiceURI: v.id || v.name || v.uri || "", name: v.name || v.id || "", lang: v.lang || v.language || "", source: "server" as const })),
    ...voices.map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang, source: "browser" as const })),
  ];

  const selected = allVoices.find((v) => v.voiceURI === value);
  const filtered = allVoices.filter((v) => {
    const q = search.toLowerCase();
    return !q || v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q);
  });
  const serverFiltered = filtered.filter((v) => v.source === "server");
  const browserFiltered = filtered.filter((v) => v.source === "browser");

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen(true); setSearch(""); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="w-full flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-slate-300 transition text-left">
        <span className={selected ? "text-slate-800" : "text-slate-400"}>
          {selected ? `${selected.name} · ${selected.lang}` : (placeholder || "Seleccionar voz")}
        </span>
        <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input ref={inputRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar voz..." className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:border-blue-900 focus:outline-none" />
          </div>
          <div className="max-h-56 overflow-y-auto py-0.5">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition ${!value ? "bg-blue-50 text-blue-900 font-medium" : "text-slate-500"}`}>
              {placeholder || "Voz por defecto"}
            </button>
            {serverFiltered.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Servidor (neural)</div>
                {serverFiltered.map((v) => (
                  <button key={`srv-${v.voiceURI}`} type="button"
                    onClick={() => { onChange(v.voiceURI); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition flex items-center justify-between ${value === v.voiceURI ? "bg-blue-50 text-blue-900 font-medium" : "text-slate-800"}`}>
                    <span className="truncate">{v.name}</span>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">{v.lang}</span>
                  </button>
                ))}
              </>
            )}
            {browserFiltered.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Navegador</div>
                {browserFiltered.map((v) => (
                  <button key={`brw-${v.voiceURI}`} type="button"
                    onClick={() => { onChange(v.voiceURI); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition flex items-center justify-between ${value === v.voiceURI ? "bg-blue-50 text-blue-900 font-medium" : "text-slate-800"}`}>
                    <span className="truncate">{v.name}</span>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">{v.lang}</span>
                  </button>
                ))}
              </>
            )}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-xs text-slate-400 text-center">Sin resultados</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [config, setConfig] = useState<Config | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [displays, setDisplays] = useState<DisplaySummary[]>([]);
  const [displaysSaving, setDisplaysSaving] = useState<Record<number, boolean>>({});
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [routeRegionFilter, setRouteRegionFilter] = useState("all");
  const [routeServiceFilter, setRouteServiceFilter] = useState("all");
  const [routeOperatorFilter, setRouteOperatorFilter] = useState("all");
  const [routeReloading, setRouteReloading] = useState(false);
  const [routeDatasetStats, setRouteDatasetStats] = useState<RailwayReloadStats | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [importSourceName, setImportSourceName] = useState<string>("railboard_routes.json");
  const [importSummary, setImportSummary] = useState<ImportedRouteSummary | null>(null);
  const [importPreview, setImportPreview] = useState<string>("");
  const [importLoading, setImportLoading] = useState(false);
  const [trains, setTrains] = useState<Train[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [trainTypes, setTrainTypes] = useState<TrainType[]>([]);
  const [typeSearch, setTypeSearch] = useState("");
  const [typeCercaniasFilter, setTypeCercaniasFilter] = useState("all");
  const [typeCategoryFilter, setTypeCategoryFilter] = useState("all");
  const [typeAttributeFilter, setTypeAttributeFilter] = useState("");
  const [modal, setModal] = useState<Notification | null>(null);
  const [editingTrain, setEditingTrain] = useState<Train | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Train>>({});
  const [editStops, setEditStops] = useState<TrainStop[]>([]);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [editingType, setEditingType] = useState<TrainType | null>(null);
  const [operatorLogo, setOperatorLogo] = useState<File | null>(null);
  const [typeLogo, setTypeLogo] = useState<File | null>(null);
  const [typeDestinationIcon, setTypeDestinationIcon] = useState<File | null>(null);
  const [departureTmpl, setDepartureTmpl] = useState("");
  const [arrivalTmpl, setArrivalTmpl] = useState("");
  const [presets, setPresets] = useState<AnnouncePreset[]>([]);
  const [newPreset, setNewPreset] = useState({ label: "", text: "" });
  const [ttsVoiceMap, setTtsVoiceMap] = useState<Record<string, string>>({});
  const [templateMap, setTemplateMap] = useState<Record<string, AnnouncementTemplateSet>>({});
  const [voicePreviewLanguage, setVoicePreviewLanguage] = useState<Language>("es");
  const [voiceVisibleLangs, setVoiceVisibleLangs] = useState<Language[]>(["es", "ca", "en", "eu", "gl"]);
  const [voiceLangDropdownOpen, setVoiceLangDropdownOpen] = useState(false);
  const voiceLangDropdownRef = useRef<HTMLDivElement>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({ rate: 0.95, pitch: 1, volume: 1, voiceURI: "" });
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementModalLanguage, setAnnouncementModalLanguage] = useState<Language>("es");
  const [announcementModalScenario, setAnnouncementModalScenario] = useState<AnnouncementScenarioKey>("service_normal");
  const [announcementModalText, setAnnouncementModalText] = useState("");
  const { tab: urlTab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const activeTab = (urlTab as TabType) || "dashboard";
  const setActiveTab = useCallback((tab: TabType) => {
    navigate(tab === "dashboard" ? "/admin" : `/admin/${tab}`, { replace: true });
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, [navigate]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newPlace, setNewPlace] = useState("");
  const [autoGen, setAutoGen] = useState(false);
  const [autoInterval, setAutoInterval] = useState(5);
  const [selectedTrainStationId, setSelectedTrainStationId] = useState<number | null>(null);
  const autoRef = useRef<number | null>(null);

  const showNotification = (type: NotificationType, title: string, message: string) => {
    const id = Math.random().toString(36);
    setModal({ id, type, title, message });
    setTimeout(() => setModal(null), 3000);
  };

  const refresh = async () => {
    setRoutesLoading(true);
    setRoutesError(null);
    try {
      const [c, stRows, pl, ro, op, tt, networkList, stationList, displayRows] = await Promise.all([
        api.getConfig(),
        api.listStations(),
        api.listPlaces(),
        api.listRoutes(),
        api.listOperators(),
        api.listTrainTypes(),
        fetchNetworks(),
        fetchStations(),
        api.listDisplays(),
      ]);
      const inferredStationId =
        selectedTrainStationId ??
        stRows.find((station) => normalizeStationName(station.name) === normalizeStationName(c.station_name || ""))?.id ??
        stRows[0]?.id ??
        null;
      const tr = await api.listTrains(inferredStationId ?? undefined);
      setConfig(c);
      setStations(stRows);
      setPlaces(pl);
      setRoutes(ro);
      setDisplays(displayRows);
      setTrains(tr);
      setOperators(op);
      setTrainTypes(tt);
      if (selectedTrainStationId == null && inferredStationId != null) {
        setSelectedTrainStationId(inferredStationId);
      }
      setRouteDatasetStats((prev) => ({
        success: true,
        routes: ro.length,
        stations: stationList.length,
        networks: networkList.length,
        reloadedAt: prev?.reloadedAt || new Date().toISOString(),
      }));
      setDepartureTmpl(c.announce_departure || defaultTemplate("departures"));
      setArrivalTmpl(c.announce_arrival || defaultTemplate("arrivals"));
      setPresets(JSON.parse(c.announce_presets || "[]"));
      setTtsVoiceMap(JSON.parse(c.tts_voice_map || "{}"));
      const parsedTemplateMap = JSON.parse(c.announce_templates_map || "{}");
      setTemplateMap(
        Object.fromEntries(
          LANGUAGE_KEYS.map((language) => {
            const current = parsedTemplateMap?.[language];
            return [
              language,
              {
                departures: current?.departures || defaultTemplate("departures", language),
                arrivals: current?.arrivals || defaultTemplate("arrivals", language),
              },
            ];
          }),
        ),
      );
    } catch (error: any) {
      setRoutesError(error?.message || "No se pudieron cargar las rutas");
    } finally {
      setRoutesLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const loadVoices = () => setVoices(getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    const ws = connectWS(refresh);
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      if (ws && typeof ws.close === "function") ws.close();
    };
  }, []);

  useEffect(() => {
    if (config) setVoiceSettings(loadVoiceSettings(config));
  }, [config]);

  useEffect(() => {
    if (selectedTrainStationId == null) return;
    api
      .listTrains(selectedTrainStationId)
      .then(setTrains)
      .catch(() => setTrains([]));
  }, [selectedTrainStationId]);

  useEffect(() => {
    if (!voiceLangDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (voiceLangDropdownRef.current && !voiceLangDropdownRef.current.contains(e.target as Node)) setVoiceLangDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [voiceLangDropdownOpen]);

  useEffect(() => {
    if (autoGen) {
      autoRef.current = window.setInterval(
        async () => {
          try {
            await api.generateRandomTrain(selectedTrainStationId ?? undefined);
            await refresh();
          } catch {
            /* auto-generate may fail silently */
          }
        },
        Math.max(1000, autoInterval * 1000),
      );
    } else {
      if (autoRef.current) {
        clearInterval(autoRef.current);
        autoRef.current = null;
      }
    }
    return () => {
      if (autoRef.current) {
        clearInterval(autoRef.current);
        autoRef.current = null;
      }
    };
  }, [autoGen, autoInterval, selectedTrainStationId]);

  const handleSaveConfig = async () => {
    try {
      await api.setConfig(config!);
      showNotification("success", "✓ Guardado", "Configuración de estación actualizada");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo guardar");
    }
  };

  const handleSaveStyles = async () => {
    try {
      await api.setConfig(config!);
      showNotification("success", "✓ Guardado", "Estilos actualizados");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudieron guardar");
    }
  };

  const handleDeletePlace = async (id: number) => {
    try {
      await api.deletePlace(id);
      await refresh();
      showNotification("success", "✓ Eliminado", "Destino eliminado");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo eliminar");
    }
  };

  const handleAddPlace = async () => {
    if (!newPlace.trim()) {
      showNotification("error", "⚠ Vacío", "Ingresa un nombre");
      return;
    }
    try {
      await api.createPlace(newPlace);
      setNewPlace("");
      await refresh();
      showNotification("success", "✓ Agregado", `${newPlace} añadido`);
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo agregar");
    }
  };

  const handleGenerateRandomTrain = async () => {
    try {
      await api.generateRandomTrain(selectedTrainStationId ?? undefined);
      await refresh();
      showNotification("success", "✓ Tren generado", "Nuevo tren agregado al panel");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo generar");
    }
  };

  const handleClearTrains = async () => {
    const stationName = stations.find((s) => s.id === selectedTrainStationId)?.name;
    const message = selectedTrainStationId
      ? `⚠️ ¿Eliminar todos los trenes de ${stationName}? Esta acción no se puede deshacer.`
      : "⚠️ ¿Eliminar TODOS los trenes? Esta acción no se puede deshacer.";
    if (!confirm(message)) return;
    try {
      await api.clearTrains(selectedTrainStationId ?? undefined);
      await refresh();
      showNotification(
        "success",
        "✓ Panel limpiado",
        selectedTrainStationId ? `Trenes eliminados en ${stationName}` : "Todos los trenes han sido eliminados",
      );
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudieron eliminar");
    }
  };

  const handleGenerateBoard = async () => {
    try {
      await api.clearTrains(selectedTrainStationId ?? undefined);
      for (let i = 0; i < 8; i++) {
        await api.generateRandomTrain(selectedTrainStationId ?? undefined);
      }
      await refresh();
      showNotification("success", "✓ Panel generado", "8 trenes con horarios escalonados");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo generar el panel");
    }
  };

  const handleGenerateOnePerDisplay = async () => {
    if (!stations.length) {
      showNotification("error", "✗ Sin estaciones", "No hay estaciones disponibles");
      return;
    }
    try {
      for (const station of stations) {
        const stationTrains = await api.listTrains(station.id);
        if (stationTrains.length === 0) {
          await api.generateRandomTrain(station.id);
        }
      }
      await refresh();
      showNotification("success", "✓ Displays cubiertos", "Cada display tiene al menos 1 tren");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo completar la generación por display");
    }
  };

  const handleAddDisplay = async () => {
    const nextIndex = stations.length + 1;
    const name = window.prompt("Nombre del nuevo display", `Display ${nextIndex}`);
    if (name === null) return;
    const short = window.prompt("Nombre corto", name.slice(0, 18)) ?? name;
    try {
      await api.createStation({
        name: name.trim() || `Display ${nextIndex}`,
        short: short.trim() || name.trim() || `Display ${nextIndex}`,
        color: "#1A3254",
      });
      await refresh();
      showNotification("success", "✓ Display creado", name.trim() || `Display ${nextIndex}`);
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo crear el display");
    }
  };

  const handleDeleteDisplay = async (station: Station) => {
    if (stations.length <= 1) {
      showNotification("error", "✗ Bloqueado", "Debe existir al menos un display");
      return;
    }
    const confirmed = confirm(`¿Eliminar el display "${station.short || station.name}"?`);
    if (!confirmed) return;
    try {
      await api.deleteStation(station.id);
      if (selectedTrainStationId === station.id) {
        setSelectedTrainStationId(stations.find((s) => s.id !== station.id)?.id ?? null);
      }
      await refresh();
      showNotification("success", "✓ Display eliminado", station.short || station.name);
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo eliminar el display");
    }
  };

  const updateDisplayConfig = (stationId: number, patch: Partial<Config>) => {
    const nextPatch: Partial<Config> = { ...patch };
    if (Array.isArray((nextPatch as any).languages) && (nextPatch as any).languages.length > 0) {
      const languages = Array.from(new Set((nextPatch as any).languages as Language[]));
      nextPatch.languages = languages;
      nextPatch.language = languages[0];
    } else if (nextPatch.language && !("languages" in nextPatch)) {
      nextPatch.languages = [nextPatch.language as Language];
    }
    setDisplays((prev) =>
      prev.map((display) => (display.station.id === stationId ? { ...display, config: { ...display.config, ...nextPatch } } : display)),
    );
  };

  const saveDisplayConfig = async (stationId: number) => {
    const display = displays.find((item) => item.station.id === stationId);
    if (!display) return;
    try {
      setDisplaysSaving((prev) => ({ ...prev, [stationId]: true }));
      // Save station name to station record if changed
      const cfgName = display.config.station_name?.trim();
      if (cfgName && cfgName !== display.station.name && cfgName !== display.station.short) {
        await api.updateStation(stationId, { name: cfgName, short: cfgName });
      }
      await api.saveStationDisplayConfig(stationId, display.config);
      await refresh();
      showNotification("success", "✓ Display guardado", display.station.short || display.station.name);
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo guardar la configuración del display");
    } finally {
      setDisplaysSaving((prev) => ({ ...prev, [stationId]: false }));
    }
  };

  const handleNewTrain = () => {
    const station = stations.find((s) => s.id === selectedTrainStationId);
    setEditFormData({
      number: "",
      origin: station?.short || config?.station_name || "",
      destination: "",
      scheduled_time: "12:00",
      expected_time: "12:00",
      platform: "",
      sector: "",
      status: "Scheduled" as Train["status"],
      observations: "",
      stops: [],
      station_id: selectedTrainStationId,
    });
    setEditingTrain({ id: 0 } as Train);
    setEditStops([]);
  };

  const handleEditTrain = (train: Train) => {
    setEditingTrain(train);
    setEditFormData({ ...train });
    setEditStops(normalizeStops(train.stops));
  };

  const handleSaveEditedTrain = async () => {
    if (!editingTrain) return;
    try {
      const stops = normalizeStops(editStops);
      const payload = { ...editFormData, stops, station_id: selectedTrainStationId ?? editFormData.station_id ?? null };
      if (editingTrain.id && editingTrain.id > 0) {
        await api.updateTrain(editingTrain.id, payload);
        showNotification("success", "✓ Tren actualizado", "Los cambios se han guardado");
      } else {
        await api.createTrain(payload);
        showNotification("success", "✓ Tren creado", "Nuevo tren agregado al panel");
      }
      await refresh();
      setEditingTrain(null);
      setEditStops([]);
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo guardar el tren");
    }
  };

  const handleDeleteTrain = async (trainId: number) => {
    if (!confirm("⚠️ ¿Eliminar este tren?")) return;
    try {
      await api.deleteTrain(trainId);
      await refresh();
      showNotification("success", "✓ Tren eliminado", "El tren ha sido removido del panel");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo eliminar el tren");
    }
  };

  const testSpeak = (text: string, language: Language = voicePreviewLanguage) => {
    const voiceURI = getVoiceURIForLanguage(config ? { ...config, tts_voice_map: JSON.stringify(ttsVoiceMap) } : null, language);
    speak(
      text,
      {
        ...voiceSettings,
        voiceURI: voiceURI || voiceSettings.voiceURI,
      },
      language,
    );
  };

  const buildAnnouncementText = (language: Language, scenario: AnnouncementScenarioKey) =>
    ANNOUNCEMENT_SCENARIOS.find((item) => item.key === scenario)?.build(language) || "";

  const openAnnouncementModal = () => {
    const language = voicePreviewLanguage;
    const scenario: AnnouncementScenarioKey = "service_normal";
    setAnnouncementModalLanguage(language);
    setAnnouncementModalScenario(scenario);
    setAnnouncementModalText(buildAnnouncementText(language, scenario));
    setAnnouncementModalOpen(true);
  };

  const selectAnnouncementLanguage = (language: Language) => {
    setAnnouncementModalLanguage(language);
    setAnnouncementModalText(buildAnnouncementText(language, announcementModalScenario));
  };

  const selectAnnouncementScenario = (scenario: AnnouncementScenarioKey) => {
    setAnnouncementModalScenario(scenario);
    setAnnouncementModalText(buildAnnouncementText(announcementModalLanguage, scenario));
  };

  const speakAnnouncementModal = () => {
    testSpeak(
      announcementModalText || buildAnnouncementText(announcementModalLanguage, announcementModalScenario),
      announcementModalLanguage,
    );
  };

  const saveVoiceConfiguration = async () => {
    if (!config) return;
    const selectedTemplates = templateMap[voicePreviewLanguage] || buildTemplateDefaults(voicePreviewLanguage);
    try {
      await api.setConfig({
        tts_voice: config.tts_voice,
        tts_rate: config.tts_rate,
        tts_pitch: config.tts_pitch,
        tts_volume: config.tts_volume,
        tts_voice_map: JSON.stringify(ttsVoiceMap),
        announce_templates_map: JSON.stringify(templateMap),
        announce_departure: selectedTemplates.departures,
        announce_arrival: selectedTemplates.arrivals,
      });
      showNotification("success", "✓ Guardado", "Voces y plantillas actualizadas");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message);
    }
  };

  const handleReloadRailRoutes = async () => {
    const confirmed = confirm("¿Quieres recargar el dataset ferroviario? Esto actualizará rutas, estaciones y redes disponibles.");
    if (!confirmed) return;
    try {
      setRouteReloading(true);
      const stats = await reloadRailwayRoutes();
      setRouteDatasetStats(stats);
      await refresh();
      showNotification(
        "success",
        "✓ Dataset recargado",
        `Rutas: ${stats.routes} · Estaciones: ${stats.stations} · Redes: ${stats.networks}`,
      );
    } catch (error: any) {
      showNotification("error", "✗ Error", error?.message || "No se pudo recargar el dataset ferroviario");
    } finally {
      setRouteReloading(false);
    }
  };

  const handleExportRailRoutes = async () => {
    try {
      await api.exportRailwayRoutes();
      showNotification("success", "✓ Exportado", "El dataset ferroviario se ha descargado");
    } catch (error: any) {
      showNotification("error", "✗ Error", error?.message || "No se pudo exportar el dataset");
    }
  };

  const handleExportTrains = async () => {
    try {
      await api.exportTrains(selectedTrainStationId ?? undefined);
      showNotification("success", "✓ Exportado", selectedTrainStationId ? "Trenes del display descargados" : "Trenes descargados");
    } catch (error: any) {
      showNotification("error", "✗ Error", error?.message || "No se pudieron exportar los trenes");
    }
  };

  const handleImportJsonFile = async (file: File | null) => {
    if (!file) return;
    setImportLoading(true);
    setImportSourceName(file.name);
    try {
      const text = await file.text();
      setImportPreview(text.slice(0, 6000));
      const parsed = JSON.parse(text);
      const summary = summarizeImportedRoutes(parsed);
      setImportSummary(summary);
      setActiveTab("validation");
      if (summary.valid) {
        showNotification("info", "Validación lista", `JSON cargado desde ${file.name}`);
      } else {
        showNotification("error", "JSON inválido", "Hay errores en el archivo importado");
      }
    } catch (error: any) {
      setImportSummary({
        valid: false,
        routes: 0,
        stations: 0,
        networks: 0,
        operators: 0,
        issues: [{ level: "error", title: "Importación JSON", detail: error?.message || "No se pudo leer el archivo" }],
      });
      setActiveTab("validation");
      showNotification("error", "Importación fallida", error?.message || "No se pudo cargar el JSON");
    } finally {
      setImportLoading(false);
    }
  };

  const lang = (config?.language as string) || "es";
  const editingTrainStationId = Number(editFormData.station_id ?? editingTrain?.station_id ?? selectedTrainStationId ?? null) || null;
  const editingTrainDisplayConfig = displays.find((item) => item.station.id === editingTrainStationId)?.config || config;
  const editingPlatformOptions = buildPlatformOptions(editingTrainDisplayConfig, []);
  const editingSectorOptions = buildSectorOptions(editingTrainDisplayConfig, []);

  const normalizeRouteText = (value: string) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const getRouteRegion = (route: Route) => {
    const haystack = normalizeRouteText(`${route.network} ${route.name}`);
    if (haystack.includes("valencia") || haystack.includes("valencia")) return "Comunitat Valenciana";
    if (haystack.includes("catalunya") || haystack.includes("cataluna")) return "Catalunya";
    if (haystack.includes("madrid")) return "Comunidad de Madrid";
    if (haystack.includes("murcia") || haystack.includes("alicante")) return "Región de Murcia / Alicante";
    if (haystack.includes("sevilla")) return "Andalucía (Sevilla)";
    if (haystack.includes("san sebastian")) return "País Vasco (San Sebastián)";
    if (haystack.includes("zaragoza")) return "Aragón";
    if (haystack.includes("cantabria")) return "Cantabria";
    if (haystack.includes("asturias")) return "Asturias";
    if (haystack.includes("bilbao")) return "País Vasco (Bilbao)";
    if (haystack.includes("galicia") || haystack.includes("ferrol")) return "Galicia";
    return route.network;
  };

  const getRouteService = (route: Route) => {
    const haystack = normalizeRouteText(`${route.network} ${route.name}`);
    if (haystack.includes("custom")) return "Custom";
    if (haystack.includes("larga distancia")) return "Larga Distancia";
    if (haystack.includes("media distancia")) return "Media Distancia";
    if (haystack.includes("cercanias") || haystack.includes("rodalies")) return "Cercanías / Rodalies";
    return "Otros";
  };

  const routeRegions = Array.from(new Set(routes.map(getRouteRegion))).sort((a, b) => a.localeCompare(b, "es"));
  const routeNetworks = Array.from(new Set(routes.map((route) => route.network))).sort((a, b) => a.localeCompare(b, "es"));
  const routeServices = Array.from(new Set(routes.map(getRouteService))).sort((a, b) => a.localeCompare(b, "es"));
  const routeOperators = Array.from(new Set(routes.map((route) => route.operator))).sort((a, b) => a.localeCompare(b, "es"));
  const filteredRoutes = routes.filter((route) => {
    const regionOk = routeRegionFilter === "all" || getRouteRegion(route) === routeRegionFilter;
    const serviceOk = routeServiceFilter === "all" || getRouteService(route) === routeServiceFilter;
    const operatorOk = routeOperatorFilter === "all" || route.operator === routeOperatorFilter;
    return regionOk && serviceOk && operatorOk;
  });
  const validationSummary = useMemo(() => computeRouteValidation(routes, stations, displays), [routes, stations, displays]);
  const filteredTrainTypes = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    return trainTypes.filter((tt) => {
      if (typeCercaniasFilter === "yes" && !tt.is_cercanias) return false;
      if (typeCercaniasFilter === "no" && tt.is_cercanias) return false;
      if (typeCategoryFilter !== "all" && (tt.category || "").toLowerCase() !== typeCategoryFilter.toLowerCase()) return false;
      const attr = typeAttributeFilter.trim().toLowerCase();
      if (attr && !(tt.attribute || "").toLowerCase().includes(attr)) return false;
      if (q && ![tt.code, tt.name, tt.category, tt.attribute].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))) return false;
      return true;
    });
  }, [trainTypes, typeSearch, typeCercaniasFilter, typeCategoryFilter, typeAttributeFilter]);
  const dashboardKpis = [
    { label: "Rutas", value: routes.length, icon: RouteIcon },
    { label: "Estaciones", value: stations.length, icon: MapPin },
    { label: "Redes", value: new Set(routes.map((route) => route.network)).size, icon: GitBranch },
    { label: "Operadores", value: operators.length, icon: Building2 },
    { label: "Displays", value: displays.length, icon: Monitor },
    { label: "Trenes", value: trains.length, icon: TrainIcon },
  ];

  if (!config) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando panel...</p>
        </div>
      </div>
    );
  }

    return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeId={activeTab}
        variant="grid"
        onNavigate={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
      />

      {/* Main area */}
      <div className="flex min-w-0 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" title="Toggle sidebar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{findNavTitle(activeTab)}</h2>
                <p className="text-sm text-slate-500">
                  {config.station_name || "No configurada"} · {routes.length} rutas · {stations.length} estaciones
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refresh}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Recargar datos
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
              >
                ← Display
              </a>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
          {/* KPI Dashboard */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardKpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-start gap-4">
                  <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600 shrink-0">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
                    <p className="mt-0.5 text-2xl font-bold text-slate-900">{kpi.value}</p>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Content Area */}
          <div className="space-y-6">
            {activeTab === "dashboard" && (
              <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resumen operativo</p>
                        <h3 className="mt-1 text-xl font-bold text-slate-900">Estado del backend ferroviario</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          Revisa rutas, estaciones, redes y validación antes de entrar en ediciones.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleReloadRailRoutes}
                          disabled={routeReloading}
                          className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {routeReloading ? "Recargando..." : "Recargar dataset"}
                        </button>
                        <button
                          onClick={() => setActiveTab("validation")}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          Ver validación
                        </button>
                        <button
                          onClick={handleExportRailRoutes}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          Exportar dataset
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Rutas, redes y estaciones</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Dataset completo: {filteredRoutes.length} de {routes.length} rutas visibles.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                          Redes: {routeNetworks.length}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                          Operadores: {routeOperators.length}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                          Estaciones: {stations.length}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <div className="grid grid-cols-4 gap-px bg-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <div className="bg-white px-4 py-3">Ruta</div>
                          <div className="bg-white px-4 py-3">Red</div>
                          <div className="bg-white px-4 py-3">Operador</div>
                          <div className="bg-white px-4 py-3 text-right">Estaciones</div>
                        </div>
                        <div className="max-h-[32rem] overflow-auto">
                          {filteredRoutes.map((route) => (
                            <div key={route.code} className="grid grid-cols-4 gap-px border-t border-slate-100 bg-slate-100 text-sm">
                              <div className="bg-white px-4 py-3 font-medium text-slate-900">{route.code}</div>
                              <div className="bg-white px-4 py-3 text-slate-700">{route.network}</div>
                              <div className="bg-white px-4 py-3 text-slate-700">{route.operator}</div>
                              <div className="bg-white px-4 py-3 text-right font-semibold text-slate-900">{route.stations.length}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <h4 className="text-sm font-semibold text-slate-900">Redes ferroviarias</h4>
                          <div className="mt-3 flex flex-wrap gap-2 max-h-44 overflow-auto">
                            {routeNetworks.map((network) => (
                              <span key={network} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                {network}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <h4 className="text-sm font-semibold text-slate-900">Estaciones del dataset</h4>
                          <div className="mt-3 max-h-64 overflow-auto space-y-2">
                            {stations.map((station) => (
                              <div key={station.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                                <div className="font-medium text-slate-900">{station.name}</div>
                                <div className="text-xs text-slate-500">
                                  {station.short || "—"} · ID {station.id}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-slate-900">Carga de dataset</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Importa un JSON para validarlo localmente antes de recargar el dataset ferroviario.
                    </p>
                    <div className="mt-4 space-y-3">
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => handleImportJsonFile(e.target.files?.[0] || null)}
                        className="block w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                      />
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Fuente</span>
                          <span className="font-mono font-medium text-slate-900">{importSourceName}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-700">
                            Rutas: <span className="font-semibold text-slate-900">{importSummary?.routes ?? routes.length}</span>
                          </div>
                          <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-700">
                            Estaciones: <span className="font-semibold text-slate-900">{importSummary?.stations ?? stations.length}</span>
                          </div>
                          <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-700">
                            Redes:{" "}
                            <span className="font-semibold text-slate-900">
                              {importSummary?.networks ?? new Set(routes.map((route) => route.network)).size}
                            </span>
                          </div>
                          <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-700">
                            Operadores: <span className="font-semibold text-slate-900">{importSummary?.operators ?? operators.length}</span>
                          </div>
                        </div>
                      </div>
                      {importLoading && <p className="text-xs text-amber-600">Validando archivo...</p>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-slate-900">Validación rápida</h3>
                    <div className="mt-4 space-y-3">
                      {validationSummary.length === 0 ? (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                          <p className="text-sm font-medium text-green-800">No se han detectado problemas</p>
                          <p className="mt-1 text-xs text-green-700">El dataset cargado está listo para usar.</p>
                        </div>
                      ) : (
                        validationSummary.slice(0, 6).map((issue, index) => (
                          <div
                            key={`${issue.title}-${index}`}
                            className={`rounded-lg border p-3 text-sm ${issue.level === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
                          >
                            <div className="font-medium">{issue.title}</div>
                            <div className="mt-0.5 text-xs opacity-80">{issue.detail}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Station Tab */}
            {activeTab === "station" && (
              <div className="space-y-6">
                {/* Logo & Name */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span>🏷️</span> Información
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nombre de Estación</label>
                      <input
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                        value={config.station_name}
                        onChange={(e) => setConfig({ ...config, station_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Modo</label>
                      <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                        value={config.mode}
                        onChange={(e) => setConfig({ ...config, mode: e.target.value as Config["mode"] })}
                      >
                        <option value="departures">Salidas</option>
                        <option value="arrivals">Llegadas</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Displays</label>
                      <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                        value={config.displayMode || "multiple"}
                        onChange={(e) => setConfig({ ...config, displayMode: e.target.value as Config["displayMode"] })}
                      >
                        <option value="single">Solo un display</option>
                        <option value="multiple">Múltiples displays</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Language & Clock */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span>⚙️</span> Configuración
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Idioma</label>
                      <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                        value={(config.language as Language) ?? "es"}
                        onChange={(e) => setConfig({ ...config, language: e.target.value as Language })}
                      >
                        {Object.entries(LANGUAGES).map(([code, name]) => (
                          <option key={code} value={code}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tipo de Reloj</label>
                      <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                        value={config.clockMode || "real"}
                        onChange={(e) => setConfig({ ...config, clockMode: e.target.value as Config["clockMode"] })}
                      >
                        <option value="real">Sistema</option>
                        <option value="fake">Ficticio</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hora (si ficticio)</label>
                      <input
                        type="time"
                        step="1"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                        value={config.clockFakeTime || "12:00:00"}
                        onChange={(e) => setConfig({ ...config, clockFakeTime: e.target.value })}
                        disabled={(config.clockMode || "real") !== "fake"}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pie de Pantalla</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      placeholder="Texto que aparece en el pie de pantalla"
                      value={config.footerText || ""}
                      onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-2">
                        <span>🎤</span> Idiomas y TTS
                      </h3>
                      <p className="text-sm text-slate-600">Edita voces por idioma, plantillas de anuncios y la voz global de respaldo.</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("voice")}
                      className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Abrir editor TTS
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Idioma base</div>
                      <div className="text-slate-900 font-semibold mt-1">{LANGUAGES[(config.language as Language) || "es"]}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Voz global</div>
                      <div className="text-slate-900 font-semibold mt-1">{config.tts_voice ? "Configurada" : "Por defecto"}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Idiomas editables</div>
                      <div className="text-slate-900 font-semibold mt-1">{LANGUAGE_KEYS.length}</div>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveConfig}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                  >
                    💾 Guardar Estación
                  </button>
                </div>

                {/* Station quick links */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span>🧭</span> Estaciones y Accesos
                  </h3>
                  {stations.length === 0 ? (
                    <p className="text-slate-500 text-sm">No hay estaciones configuradas.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {stations
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "es"))
                        .map((st) => (
                          <div key={st.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-slate-900 font-semibold">{st.short || st.name}</div>
                            <div className="text-xs text-slate-500 mb-2">
                              {st.name} · ID {st.id}
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={`/display/${st.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-800"
                              >
                                Abrir Display
                              </a>
                              <a
                                href={`/control/${st.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                              >
                                Abrir Control
                              </a>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Generation Panel */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <GenerationPanel
                    onRefresh={refresh}
                    autoGen={autoGen}
                    setAutoGen={setAutoGen}
                    autoInterval={autoInterval}
                    setAutoInterval={setAutoInterval}
                  />
                </div>
              </div>
            )}

            {/* Services Tab */}
            {activeTab === "services" && <ServicesPanel />}

            {/* Displays Tab */}
            {activeTab === "displays" && (
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <span>🖥️</span> Displays ({displays.length})
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">Configuración independiente y trenes asociados para cada estación.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={handleAddDisplay}
                        className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                      >
                        + Añadir display
                      </button>
                      <button
                        onClick={handleGenerateOnePerDisplay}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        1 Tren por Display
                      </button>
                      <button
                        onClick={handleExportRailRoutes}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        Exportar dataset
                      </button>
                    </div>
                  </div>

                  {displays.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-slate-500">No hay displays para mostrar.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {displays
                        .slice()
                        .sort((a, b) => a.station.sort_order - b.station.sort_order || a.station.name.localeCompare(b.station.name, "es"))
                        .map((display) => {
                          const s = display.station;
                          const cfg = display.config;
                          const trainsForDisplay = display.trains || [];
                          return (
                            <div key={s.id} className="border border-slate-200 rounded-xl bg-white shadow-sm">
                              <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="rounded-lg bg-slate-100 p-2 text-slate-600 shrink-0">
                                    <Monitor size={18} />
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="text-base font-semibold text-slate-900">{s.short || s.name}</h3>
                                    <p className="text-xs text-slate-500">
                                      {s.name} · ID {s.id}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={
                                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " +
                                      (cfg.mode === "arrivals" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800")
                                    }
                                  >
                                    {cfg.mode === "arrivals" ? "Llegadas" : "Salidas"}
                                  </span>
                                  <span className="text-xs text-slate-400 tabular-nums">{trainsForDisplay.length} trenes</span>
                                </div>
                              </div>

                              <div className="p-5 space-y-4">
                                <div className="flex flex-wrap gap-2">
                                  <a
                                    href={`/admin/displays/${s.id}`}
                                    className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-800"
                                  >
                                    Abrir página
                                  </a>
                                  <a
                                    href={`/display/${s.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                                  >
                                    Abrir Display
                                  </a>
                                  <a
                                    href={`/control/${s.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                                  >
                                    Abrir Control
                                  </a>
                                  <button
                                    onClick={() => handleDeleteDisplay(s)}
                                    disabled={stations.length <= 1}
                                    className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    Eliminar
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                      Nombre de la estación
                                    </label>
                                    <input
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                                      value={cfg.station_name || ""}
                                      onChange={(e) => updateDisplayConfig(s.id, { station_name: e.target.value })}
                                    />
                                    <p className="mt-1 text-[11px] text-slate-400">
                                      Se usará en el display público y en el cabecero del panel.
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Modo</label>
                                    <select
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                                      value={cfg.mode || "departures"}
                                      onChange={(e) => updateDisplayConfig(s.id, { mode: e.target.value as Config["mode"] })}
                                    >
                                      <option value="departures">Salidas</option>
                                      <option value="arrivals">Llegadas</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                      Región / ciudad
                                    </label>
                                    <select
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                                      value={cfg.routeRegion || ""}
                                      onChange={(e) => updateDisplayConfig(s.id, { routeRegion: e.target.value })}
                                    >
                                      <option value="">Todas las regiones</option>
                                      {routeRegions.map((region) => (
                                        <option key={region} value={region}>
                                          {region}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                      Idiomas
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                      {normalizeDisplayLanguages(cfg).map((language) => (
                                        <span
                                          key={language}
                                          className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                                        >
                                          {LANGUAGES[language]}
                                        </span>
                                      ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {Object.entries(LANGUAGES).map(([code, name]) => {
                                        const language = code as Language;
                                        const active = normalizeDisplayLanguages(cfg).includes(language);
                                        const nextLanguages = active
                                          ? normalizeDisplayLanguages(cfg).filter((item) => item !== language)
                                          : Array.from(new Set([...normalizeDisplayLanguages(cfg), language]));
                                        return (
                                          <label
                                            key={code}
                                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition ${active ? "border-blue-200 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={active}
                                              onChange={(e) =>
                                                updateDisplayConfig(s.id, {
                                                  languages: e.target.checked
                                                    ? Array.from(new Set([...normalizeDisplayLanguages(cfg), language]))
                                                    : nextLanguages.length
                                                      ? nextLanguages
                                                      : [language],
                                                  language: (e.target.checked
                                                    ? Array.from(new Set([...normalizeDisplayLanguages(cfg), language]))
                                                    : nextLanguages.length
                                                      ? nextLanguages
                                                      : [language])[0],
                                                })
                                              }
                                            />
                                            <span>{name}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    <p className="mt-2 text-[11px] text-slate-400">
                                      El primer idioma es el principal. El display puede anunciar en varios idiomas.
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Reloj</label>
                                    <select
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                                      value={cfg.clockMode || "real"}
                                      onChange={(e) => updateDisplayConfig(s.id, { clockMode: e.target.value as Config["clockMode"] })}
                                    >
                                      <option value="real">Sistema</option>
                                      <option value="fake">Ficticio</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                      Hora ficticia
                                    </label>
                                    <input
                                      type="time"
                                      step="1"
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                                      value={cfg.clockFakeTime || "12:00:00"}
                                      onChange={(e) => updateDisplayConfig(s.id, { clockFakeTime: e.target.value })}
                                      disabled={(cfg.clockMode || "real") !== "fake"}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                      Logo / URL
                                    </label>
                                    <input
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                                      value={cfg.logo_url || ""}
                                      onChange={(e) => updateDisplayConfig(s.id, { logo_url: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                      Vía mínima
                                    </label>
                                    <input
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                                      value={cfg.platformMin || "1"}
                                      onChange={(e) => updateDisplayConfig(s.id, { platformMin: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                      Vía máxima
                                    </label>
                                    <input
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                                      value={cfg.platformMax || "8"}
                                      onChange={(e) => updateDisplayConfig(s.id, { platformMax: e.target.value })}
                                    />
                                  </div>
                                  <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={cfg.platformAllowEmpty !== false}
                                      onChange={(e) => updateDisplayConfig(s.id, { platformAllowEmpty: e.target.checked })}
                                    />
                                    Permitir sin vía
                                  </label>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                      Sector mínimo
                                    </label>
                                    <input
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                                      value={cfg.sectorMin || "A"}
                                      onChange={(e) => updateDisplayConfig(s.id, { sectorMin: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                      Sector máximo
                                    </label>
                                    <input
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                                      value={cfg.sectorMax || "D"}
                                      onChange={(e) => updateDisplayConfig(s.id, { sectorMax: e.target.value })}
                                    />
                                  </div>
                                  <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={cfg.sectorAllowEmpty !== false}
                                      onChange={(e) => updateDisplayConfig(s.id, { sectorAllowEmpty: e.target.checked })}
                                    />
                                    Permitir sin sector
                                  </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Fondo</label>
                                    <input
                                      type="color"
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 h-10 cursor-pointer"
                                      value={cfg.bgColor || "#050a14"}
                                      onChange={(e) => updateDisplayConfig(s.id, { bgColor: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                      Cabecera
                                    </label>
                                    <input
                                      type="color"
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 h-10 cursor-pointer"
                                      value={cfg.headerBgColor || "#BFEFD5"}
                                      onChange={(e) => updateDisplayConfig(s.id, { headerBgColor: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                      Texto cabecera
                                    </label>
                                    <input
                                      type="color"
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 h-10 cursor-pointer"
                                      value={cfg.headerTextColor || "#102341"}
                                      onChange={(e) => updateDisplayConfig(s.id, { headerTextColor: e.target.value })}
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                    Pie de pantalla
                                  </label>
                                  <input
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                                    value={cfg.footerText || ""}
                                    onChange={(e) => updateDisplayConfig(s.id, { footerText: e.target.value })}
                                  />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => saveDisplayConfig(s.id)}
                                    disabled={!!displaysSaving[s.id]}
                                    className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
                                  >
                                    {displaysSaving[s.id] ? "Guardando..." : "Guardar display"}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      await api.generateRandomTrain(s.id);
                                      await refresh();
                                    }}
                                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                                  >
                                    Generar tren
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`¿Vaciar trenes de ${s.short || s.name}?`)) return;
                                      await api.clearTrains(s.id);
                                      await refresh();
                                    }}
                                    className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100"
                                  >
                                    Vaciar trenes
                                  </button>
                                </div>

                                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                                  <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-700">
                                    Trenes del display
                                  </div>
                                  {trainsForDisplay.length === 0 ? (
                                    <div className="px-4 py-6 text-slate-500 text-sm">No hay trenes asignados.</div>
                                  ) : (
                                    <div className="divide-y divide-slate-200">
                                      {trainsForDisplay.slice(0, 5).map((train) => (
                                        <div key={train.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="text-slate-900 font-semibold truncate">
                                              {train.number} · {train.destination}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                              {train.scheduled_time} · {train.platform && train.platform !== "-" ? train.platform : "—"} ·{" "}
                                              {train.status}
                                            </div>
                                          </div>
                                          <button
                                            onClick={async () => {
                                              if (!confirm(`¿Eliminar tren ${train.number}?`)) return;
                                              await api.deleteTrain(train.id);
                                              await refresh();
                                            }}
                                            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                                          >
                                            Eliminar
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Trains Tab */}
            {activeTab === "trains" && (
              <div className="animate-fadeIn space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <span>🚂</span> Gestión de Trenes
                  </h2>

                  <div className="space-y-4">
                    <div className="border border-slate-200 rounded-lg p-4 bg-white">
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">⚡ Acciones Rápidas</h3>
                      <div className="mb-4">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
                          Estación / Display
                        </label>
                        <select
                          value={selectedTrainStationId ?? ""}
                          onChange={(e) => setSelectedTrainStationId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        >
                          {stations.map((station) => (
                            <option key={station.id} value={station.id}>
                              {station.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={handleNewTrain}
                          className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 gap-2"
                        >
                          <span>🆕</span> Añadir tren manual
                        </button>
                        <button
                          onClick={handleGenerateRandomTrain}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 gap-2"
                        >
                          <span>➕</span> Generar 1 Tren
                        </button>
                        <button
                          onClick={handleGenerateBoard}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 gap-2"
                        >
                          <span>📋</span> Panel Completo (8)
                        </button>
                        <button
                          onClick={handleGenerateOnePerDisplay}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 gap-2 sm:col-span-2"
                        >
                          <span>🛰️</span> 1 Tren por Display
                        </button>
                        <button
                          onClick={handleClearTrains}
                          className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 gap-2 sm:col-span-2"
                        >
                          <span>🗑️</span> Limpiar Todo
                        </button>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-lg p-4 bg-white">
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">🔄 Generación Automática</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={autoGen}
                              onChange={(e) => setAutoGen(e.target.checked)}
                              className="w-4 h-4 rounded accent-blue-900"
                            />
                            <span className="text-slate-900 font-medium">Activar generación automática</span>
                          </label>
                        </div>
                        {autoGen && (
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Intervalo (segundos)</label>
                              <span className="text-blue-900 font-semibold">{autoInterval}s</span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="30"
                              step="1"
                              className="w-full accent-blue-900"
                              value={autoInterval}
                              onChange={(e) => setAutoInterval(parseInt(e.target.value))}
                            />
                            <p className="text-xs text-slate-500 mt-2">
                              Se generará un nuevo tren cada {autoInterval} segundo{autoInterval !== 1 ? "s" : ""}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-lg p-4 bg-white">
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">📊 Información</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="text-slate-500 text-xs uppercase tracking-wide">Estado</div>
                          <div className="text-slate-900 font-bold mt-1">
                            {autoGen ? (
                              <span className="text-green-700">🟢 Automático ON</span>
                            ) : (
                              <span className="text-slate-500">⚪ Manual</span>
                            )}
                          </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="text-slate-500 text-xs uppercase tracking-wide">Ver Panel</div>
                          <a
                            href={selectedTrainStationId ? `/display/${selectedTrainStationId}` : "/"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-900 font-bold hover:text-blue-700 transition mt-1 block"
                          >
                            📺 Ir a Display →
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Trains List */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-white">
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">📋 Trenes en Pantalla ({trains.length})</h3>
                      {trains.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-slate-500">No hay trenes. Genera uno para empezar.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-slate-200">
                              <tr className="text-slate-500 text-xs uppercase tracking-wide">
                                <th className="text-left py-2 px-3">Número</th>
                                <th className="text-left py-2 px-3">Tipo</th>
                                <th className="text-left py-2 px-3">Operador</th>
                                <th className="text-left py-2 px-3">Destino</th>
                                <th className="text-left py-2 px-3">Hora</th>
                                <th className="text-left py-2 px-3">Andén</th>
                                <th className="text-left py-2 px-3">Estado</th>
                                <th className="text-left py-2 px-3">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {trains.map((train, idx) => (
                                <tr key={train.id || idx} className="hover:bg-slate-50 transition">
                                  <td className="py-2 px-3 font-mono text-blue-900 font-semibold">{train.number}</td>
                                  <td className="py-2 px-3">
                                    <div className="flex items-center gap-2">
                                      {train.type_color && (
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: train.type_color }}></div>
                                      )}
                                      <span className="text-slate-900">{train.type_code || "—"}</span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-slate-600">{train.operator_name || "—"}</td>
                                  <td className="py-2 px-3 text-slate-900 truncate max-w-xs">{train.destination}</td>
                                  <td className="py-2 px-3 font-mono text-slate-600">{train.scheduled_time}</td>
                                  <td className="py-2 px-3">
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                                      {train.platform && train.platform !== "-" ? train.platform : "—"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3">
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-semibold ${
                                        train.status === "Departed"
                                          ? "bg-green-100 text-green-800"
                                          : train.status === "Boarding"
                                            ? "bg-amber-100 text-amber-800"
                                            : train.status === "Delayed"
                                              ? "bg-red-100 text-red-800"
                                              : train.status === "Cancelled"
                                                ? "bg-slate-100 text-slate-700"
                                                : "bg-slate-100 text-slate-700"
                                      }`}
                                    >
                                      {train.status}
                                    </span>
                                  </td>{" "}
                                  <td className="py-2 px-3 flex gap-2">
                                    <button
                                      onClick={() => handleEditTrain(train)}
                                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                                    >
                                      ✏️ Editar
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTrain(train.id)}
                                      className="inline-flex items-center justify-center rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
                                    >
                                      🗑️ Del
                                    </button>
                                  </td>{" "}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Routes Tab */}
            {activeTab === "routes" && (
              <div className="animate-fadeIn">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span>🛤️</span> Generar Trenes desde Rutas
                  </h2>
                  <p className="text-sm text-slate-500 mb-6">
                    Selecciona una ruta para generar un tren con sus líneas, operador y estaciones.
                  </p>
                  <RoutesPanel />
                  <div className="mt-6">
                    <WSLogPanel />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "validation" && (
              <div className="animate-fadeIn space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Validación</p>
                      <h2 className="mt-2 text-xl font-bold text-slate-900">Comprobación de dataset</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        Revisa errores estructurales, rutas duplicadas y estados vacíos antes de recargar el fichero ferroviario.
                      </p>
                    </div>
                    <button
                      onClick={handleReloadRailRoutes}
                      disabled={routeReloading}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {routeReloading ? "Recargando..." : "Recargar dataset"}
                    </button>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Rutas</div>
                      <div className="mt-2 text-3xl font-semibold text-slate-900 tabular-nums">{routes.length}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Estaciones</div>
                      <div className="mt-2 text-3xl font-semibold text-slate-900 tabular-nums">{stations.length}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Redes</div>
                      <div className="mt-2 text-3xl font-semibold text-slate-900 tabular-nums">
                        {new Set(routes.map((route) => route.network)).size}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Errores</div>
                      <div className="mt-2 text-3xl font-semibold text-slate-900 tabular-nums">
                        {validationSummary.filter((issue) => issue.level === "error").length}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">Problemas detectados</h3>
                  <div className="mt-4 space-y-3">
                    {validationSummary.length === 0 ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                        Sin incidencias en el dataset cargado.
                      </div>
                    ) : (
                      validationSummary.map((issue, index) => (
                        <div
                          key={`${issue.title}-${index}`}
                          className={`rounded-lg border p-4 text-sm ${
                            issue.level === "error"
                              ? "border-red-200 bg-red-50 text-red-800"
                              : "border-amber-200 bg-amber-50 text-amber-800"
                          }`}
                        >
                          <div className="font-semibold">{issue.title}</div>
                          <div className="mt-1 opacity-90">{issue.detail}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "import" && (
              <div className="animate-fadeIn space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Importación JSON</p>
                  <h2 className="mt-2 text-xl font-bold text-slate-900">Carga y validación del dataset</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    El flujo admite un archivo JSON para revisar el contenido antes de recargar el dataset ferroviario. La recarga final
                    sigue dependiendo del backend.
                  </p>
                  <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-3">
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => handleImportJsonFile(e.target.files?.[0] || null)}
                        className="block w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:bg-white"
                      />
                      <textarea
                        rows={14}
                        readOnly
                        value={importPreview}
                        placeholder="La vista previa del JSON importado aparecerá aquí."
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 font-mono text-xs leading-6 text-slate-700"
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Fuente</div>
                        <div className="mt-2 break-all font-mono text-sm text-slate-900">{importSourceName}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Resumen</div>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <div className="flex items-center justify-between gap-3">
                            <span>Rutas</span>
                            <strong className="text-slate-900">{importSummary?.routes ?? 0}</strong>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Estaciones</span>
                            <strong className="text-slate-900">{importSummary?.stations ?? 0}</strong>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Redes</span>
                            <strong className="text-slate-900">{importSummary?.networks ?? 0}</strong>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Operadores</span>
                            <strong className="text-slate-900">{importSummary?.operators ?? 0}</strong>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleReloadRailRoutes}
                        disabled={routeReloading}
                        className="w-full inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {routeReloading ? "Recargando..." : "Recargar dataset"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Operators Tab */}
            {activeTab === "operators" && (
              <div className="animate-fadeIn space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <span>🏢</span> Gestión de Operadores ({operators.length})
                  </h2>

                  {operators.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-500">No hay operadores definidos.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mb-6">
                      {operators.map((op) => (
                        <div key={op.id} className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-white">
                          <div className="flex items-center gap-3">
                            {op.logo_url && (
                              <img
                                src={fileUrl(op.logo_url)!}
                                alt={op.name}
                                className="w-8 h-8 object-contain"
                                onError={(e) => handleImgError(e, op.name)}
                              />
                            )}
                            <span className="text-slate-900 font-semibold">{op.name}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingOperator(op)}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`¿Eliminar operador "${op.name}"?`)) {
                                  await api.deleteOperator(op.id);
                                  await refresh();
                                  showNotification("success", "✓ Operador eliminado", "");
                                }
                              }}
                              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                            >
                              🗑️ Del
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-lg p-4 bg-white">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">➕ Crear Operador</h3>
                    <input
                      type="text"
                      id="newOpName"
                      placeholder="Nombre del operador"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 mb-3 focus:border-blue-900 focus:outline-none"
                    />
                    <input
                      type="file"
                      id="newOpLogo"
                      accept="image/*"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 mb-3 focus:outline-none"
                    />
                    <button
                      onClick={async () => {
                        const name = (document.getElementById("newOpName") as HTMLInputElement)?.value;
                        const logoFile = (document.getElementById("newOpLogo") as HTMLInputElement)?.files?.[0];
                        if (name) {
                          await api.createOperator(name, logoFile || null);
                          (document.getElementById("newOpName") as HTMLInputElement).value = "";
                          (document.getElementById("newOpLogo") as HTMLInputElement).value = "";
                          await refresh();
                          showNotification("success", "✓ Operador creado", "");
                        }
                      }}
                      className="w-full inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                    >
                      ➕ Añadir Operador
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Train Types Tab */}
            {activeTab === "types" && (
              <div className="animate-fadeIn space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <span>🏷️</span> Tipos de Tren ({trainTypes.length})
                  </h2>

                  <div className="mb-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={typeSearch}
                      onChange={(e) => setTypeSearch(e.target.value)}
                      placeholder="🔍 Buscar por código, nombre, categoría o atributo..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    />
                    <select
                      value={typeCercaniasFilter}
                      onChange={(e) => setTypeCercaniasFilter(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    >
                      <option value="all">Cercanías: Todas</option>
                      <option value="yes">✔ Solo cercanías</option>
                      <option value="no">✖ Excluir cercanías</option>
                    </select>
                    <select
                      value={typeCategoryFilter}
                      onChange={(e) => setTypeCategoryFilter(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    >
                      <option value="all">Categoría: Todas</option>
                      {[...new Set(trainTypes.map((tt) => tt.category).filter((c): c is string => Boolean(c)))].sort().map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={typeAttributeFilter}
                      onChange={(e) => setTypeAttributeFilter(e.target.value)}
                      placeholder="Filtrar por atributo..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    />
                  </div>

                  {trainTypes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-500">No hay tipos de tren definidos.</p>
                    </div>
                  ) : filteredTrainTypes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-500">Ningún tipo coincide con los filtros.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mb-6">
                      {filteredTrainTypes.map((tt) => (
                        <div key={tt.id} className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-white">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: tt.color }}></div>
                            <div>
                              <span className="text-slate-900 font-bold font-mono">{tt.code}</span>
                              <span className="text-slate-500 text-sm ml-2">{tt.name}</span>
                              {tt.is_cercanias && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                  Cercanías
                                </span>
                              )}
                            </div>
                            {tt.logo_url && (
                              <img
                                src={fileUrl(tt.logo_url)!}
                                alt={tt.name}
                                className="w-6 h-6 object-contain"
                                onError={(e) => handleImgError(e, tt.name)}
                              />
                            )}
                            {(tt.category || tt.attribute) && (
                              <span className="text-xs text-slate-400 ml-2">
                                {tt.category && <span className="font-semibold text-slate-500">{tt.category}</span>}
                                {tt.category && tt.attribute && " · "}
                                {tt.attribute && <span>{tt.attribute}</span>}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingType(tt)}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`¿Eliminar tipo "${tt.code}"?`)) {
                                  await api.deleteTrainType(tt.id);
                                  await refresh();
                                  showNotification("success", "✓ Tipo eliminado", "");
                                }
                              }}
                              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                            >
                              🗑️ Del
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-lg p-4 bg-white">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">➕ Crear Tipo de Tren</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input
                        type="text"
                        id="newTypeCode"
                        placeholder="Código (ej: C-1)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                      />
                      <input
                        type="text"
                        id="newTypeName"
                        placeholder="Nombre (ej: Rodalia C-1)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input
                        type="color"
                        id="newTypeColor"
                        defaultValue="#3E8DCA"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 h-10 cursor-pointer"
                      />
                      <input
                        type="file"
                        id="newTypeLogo"
                        accept="image/*"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Categoría</label>
                        <select
                          id="newTypeCategory"
                          defaultValue=""
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                        >
                          <option value="">— Sin categoría —</option>
                          {["Alta Velocidad", "Media Distancia", "Regional", "Cercanías", "Internacional", "Larga Distancia"].map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Atributo</label>
                        <input
                          type="text"
                          id="newTypeAttribute"
                          placeholder="Atributo libre (ej: Rodalies de Catalunya)"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 mb-3 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        id="newTypeIsCercanias"
                        className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                      />
                      Es cercanías
                    </label>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Icono para Destino</label>
                      <input
                        type="file"
                        id="newTypeDestinationIcon"
                        accept="image/*"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        const code = (document.getElementById("newTypeCode") as HTMLInputElement)?.value;
                        const name = (document.getElementById("newTypeName") as HTMLInputElement)?.value;
                        const color = (document.getElementById("newTypeColor") as HTMLInputElement)?.value;
                        const logoFile = (document.getElementById("newTypeLogo") as HTMLInputElement)?.files?.[0];
                        const iconFile = (document.getElementById("newTypeDestinationIcon") as HTMLInputElement)?.files?.[0];
                        const category = (document.getElementById("newTypeCategory") as HTMLSelectElement)?.value || null;
                        const attribute = (document.getElementById("newTypeAttribute") as HTMLInputElement)?.value || null;
                        const isCercanias = (document.getElementById("newTypeIsCercanias") as HTMLInputElement)?.checked;
                        if (code && name) {
                          await api.createTrainType(code, name, color, logoFile || null, iconFile || null, isCercanias, category, attribute);
                          (document.getElementById("newTypeCode") as HTMLInputElement).value = "";
                          (document.getElementById("newTypeName") as HTMLInputElement).value = "";
                          (document.getElementById("newTypeColor") as HTMLInputElement).value = "#3E8DCA";
                          (document.getElementById("newTypeLogo") as HTMLInputElement).value = "";
                          (document.getElementById("newTypeDestinationIcon") as HTMLInputElement).value = "";
                          (document.getElementById("newTypeCategory") as HTMLSelectElement).value = "";
                          (document.getElementById("newTypeAttribute") as HTMLInputElement).value = "";
                          (document.getElementById("newTypeIsCercanias") as HTMLInputElement).checked = false;
                          await refresh();
                          showNotification("success", "✓ Tipo creado", "");
                        }
                      }}
                      className="w-full inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                    >
                      ➕ Añadir Tipo
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Styles Tab */}
            {activeTab === "styles" && (
              <div className="animate-fadeIn rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <span>🎨</span> Personalización Visual
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { key: "bgColor", label: "Fondo Principal", default: "#050a14" },
                    { key: "headerBgColor", label: "Fondo Encabezado", default: "#BFEFD5" },
                    { key: "headerTextColor", label: "Texto Encabezado", default: "#f5f3ec" },
                    { key: "rowBgColor", label: "Fila Par", default: "#1A3254" },
                    { key: "altBgColor", label: "Fila Impar", default: "#102341" },
                  ].map(({ key, label, default: def }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          className="w-12 h-10 rounded-lg cursor-pointer border border-slate-200"
                          value={(config as any)[key] || def}
                          onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                        />
                        <div className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm font-mono bg-white">
                          {(config as any)[key] || def}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tamaño Destino (px)</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    min="20"
                    max="100"
                    value={parseInt(config.destinationFontSize || "48")}
                    onChange={(e) => setConfig({ ...config, destinationFontSize: e.target.value })}
                  />
                </div>
                <button
                  onClick={handleSaveStyles}
                  className="w-full inline-flex items-center justify-center rounded-lg bg-blue-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                >
                  💾 Guardar Estilos
                </button>
              </div>
            )}

            {/* Places Tab */}
            {activeTab === "places" && (
              <div className="animate-fadeIn rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span>📍</span> Destinos ({places.length})
                </h2>
                <div className="flex flex-wrap gap-2 mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg min-h-12">
                  {places.length === 0 ? (
                    <span className="text-slate-500 text-sm">Sin destinos. Añade uno nuevo.</span>
                  ) : (
                    places.map((p) => (
                      <div key={p.id} className="inline-flex items-center gap-2 bg-slate-200 rounded-full px-3 py-1 text-sm text-slate-800">
                        {p.name}
                        <button onClick={() => handleDeletePlace(p.id)} className="text-red-600 hover:text-red-800 transition leading-none">
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    placeholder="Nombre del nuevo destino..."
                    value={newPlace}
                    onChange={(e) => setNewPlace(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleAddPlace()}
                  />
                  <button
                    onClick={handleAddPlace}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                  >
                    + Agregar
                  </button>
                </div>
              </div>
            )}

            {/* Locutions Tab */}
            {activeTab === "locutions" && (
              <div className="animate-fadeIn space-y-6">
                {/* Templates */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span>📝</span> Plantillas
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Plantilla Salidas</label>
                      <textarea
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 font-mono focus:border-blue-900 focus:outline-none resize-y"
                        value={departureTmpl}
                        onChange={(e) => setDepartureTmpl(e.target.value)}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Variables: {"{number}"} {"{type_name}"} {"{destination}"} {"{platform}"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Plantilla Llegadas</label>
                      <textarea
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 font-mono focus:border-blue-900 focus:outline-none resize-y"
                        value={arrivalTmpl}
                        onChange={(e) => setArrivalTmpl(e.target.value)}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Variables: {"{number}"} {"{type_name}"} {"{origin}"} {"{platform}"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await api.setConfig({
                          announce_departure: departureTmpl,
                          announce_arrival: arrivalTmpl,
                          announce_presets: JSON.stringify(presets),
                        });
                        showNotification("success", "✓ Guardado", "Plantillas actualizadas");
                      } catch (err: any) {
                        showNotification("error", "✗ Error", err.message);
                      }
                    }}
                    className="w-full inline-flex items-center justify-center rounded-lg bg-blue-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                  >
                    💾 Guardar Plantillas
                  </button>
                </div>

                {/* Presets */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span>📌</span> Locuciones Predefinidas ({presets.length})
                  </h3>
                  <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                    {presets.length === 0 ? (
                      <p className="text-slate-500 text-sm">Sin locuciones. Crea una nueva.</p>
                    ) : (
                      presets.map((p) => (
                        <div key={p.id} className="flex items-start gap-3 bg-white border border-slate-200 rounded-lg p-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-slate-900">{p.label}</div>
                            <div className="text-slate-500 text-sm truncate">{p.text}</div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => testSpeak(p.text)} className="text-blue-900 hover:text-blue-700 text-sm transition">
                              🔊
                            </button>
                            <button
                              onClick={() => setPresets(presets.filter((x) => x.id !== p.id))}
                              className="text-red-600 hover:text-red-800 text-sm transition"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                      placeholder="Etiqueta"
                      value={newPreset.label}
                      onChange={(e) => setNewPreset({ ...newPreset, label: e.target.value })}
                    />
                    <input
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                      placeholder="Texto"
                      value={newPreset.text}
                      onChange={(e) => setNewPreset({ ...newPreset, text: e.target.value })}
                    />
                    <button
                      onClick={() => {
                        if (!newPreset.label.trim() || !newPreset.text.trim()) return;
                        const id = newPreset.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                        setPresets([...presets, { id, label: newPreset.label, text: newPreset.text }]);
                        setNewPreset({ label: "", text: "" });
                      }}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Voice Tab */}
            {activeTab === "voice" && (
              <div className="animate-fadeIn rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                      <span>🎤</span> Configuración de Voz
                    </h2>
                    <p className="text-sm text-slate-500">
                      Define una voz y una plantilla por idioma. Si un idioma no tiene override, se usa el texto global como fallback.
                    </p>
                  </div>
                  <div className="flex gap-3 items-end">
                    <div className="relative" ref={voiceLangDropdownRef}>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Idiomas visibles</label>
                      <button type="button" onClick={() => setVoiceLangDropdownOpen((p) => !p)}
                        className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-slate-300 transition min-w-[180px]">
                        <span className={voiceVisibleLangs.length === 0 ? "text-slate-400" : "text-slate-800"}>
                          {voiceVisibleLangs.length === 0
                            ? "Seleccionar"
                            : voiceVisibleLangs.length === LANGUAGE_KEYS.length
                              ? "Todos"
                              : `${voiceVisibleLangs.length} seleccionados`}
                        </span>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${voiceLangDropdownOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                      {voiceLangDropdownOpen && (
                        <div className="absolute right-0 z-20 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
                          <label className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-100">
                            <input type="checkbox"
                              checked={voiceVisibleLangs.length === LANGUAGE_KEYS.length}
                              onChange={() => setVoiceVisibleLangs(voiceVisibleLangs.length === LANGUAGE_KEYS.length ? [] : [...LANGUAGE_KEYS])}
                              className="rounded border-slate-300 accent-blue-900" />
                            <span className="font-medium text-slate-700">Todos</span>
                          </label>
                          {LANGUAGE_KEYS.map((lang) => (
                            <label key={lang} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                              <input type="checkbox"
                                checked={voiceVisibleLangs.includes(lang)}
                                onChange={() => setVoiceVisibleLangs((prev) =>
                                  prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
                                )}
                                className="rounded border-slate-300 accent-blue-900" />
                              <span className="font-medium text-slate-700">{lang.toUpperCase()}</span>
                              <span className="text-slate-400">{LANGUAGES[lang]}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="min-w-[180px]">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Idioma de prueba</label>
                      <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                        value={voicePreviewLanguage}
                        onChange={(e) => setVoicePreviewLanguage(e.target.value as Language)}
                      >
                        {LANGUAGE_KEYS.map((language) => (
                          <option key={language} value={language}>
                            {LANGUAGES[language]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="border border-slate-200 rounded-xl p-4 lg:col-span-1 bg-white">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Voz global de respaldo
                    </label>
                    <VoiceSelect
                      voices={voices}
                      value={config.tts_voice || ""}
                      onChange={(uri) => setConfig({ ...config, tts_voice: uri })}
                      placeholder="Voz por defecto"
                    />
                    <div className="space-y-4 mt-5">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Velocidad</label>
                          <span className="text-blue-900 font-semibold text-sm">{config.tts_rate || "0.95"}</span>
                        </div>
                        <input
                          type="range"
                          min="0.3"
                          max="2"
                          step="0.05"
                          className="w-full accent-blue-900"
                          value={config.tts_rate || "0.95"}
                          onChange={(e) => setConfig({ ...config, tts_rate: e.target.value })}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tono</label>
                          <span className="text-blue-900 font-semibold text-sm">{config.tts_pitch || "1"}</span>
                        </div>
                        <input
                          type="range"
                          min="0.3"
                          max="2"
                          step="0.1"
                          className="w-full accent-blue-900"
                          value={config.tts_pitch || "1"}
                          onChange={(e) => setConfig({ ...config, tts_pitch: e.target.value })}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Volumen</label>
                          <span className="text-blue-900 font-semibold text-sm">{config.tts_volume || "1"}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          className="w-full accent-blue-900"
                          value={config.tts_volume || "1"}
                          onChange={(e) => setConfig({ ...config, tts_volume: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-4">
                    {voiceVisibleLangs.map((language) => {
                      const label = LANGUAGES[language];
                      const currentTemplates = templateMap[language] || buildTemplateDefaults(language);
                      const currentVoice = ttsVoiceMap[language] ?? "";
                      const previewText = getAnnouncementTemplate(
                        {
                          ...config,
                          tts_voice_map: JSON.stringify(ttsVoiceMap),
                          announce_templates_map: JSON.stringify(templateMap),
                        },
                        "departures",
                        language,
                      );
                      return (
                        <div
                          key={language}
                          className={`rounded-xl border p-4 ${
                            voicePreviewLanguage === language ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                              <h3 className="text-base font-bold text-slate-900">{label}</h3>
                              <p className="text-xs text-slate-500">{language.toUpperCase()}</p>
                            </div>
                            <button
                              onClick={() => testSpeak(TEST_TEXTS[language] || TEST_TEXTS.es, language)}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              🔊 Probar
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Voz</label>
                              <VoiceSelect
                                voices={voices}
                                value={currentVoice}
                                onChange={(uri) => setTtsVoiceMap((prev) => ({ ...prev, [language]: uri }))}
                                placeholder="Usar voz global"
                              />
                            </div>
                            <div className="text-xs text-slate-500 md:self-end">
                              La voz seleccionada se aplicará automáticamente a los anuncios en este idioma.
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Plantilla salidas
                              </label>
                              <textarea
                                rows={4}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 font-mono focus:border-blue-900 focus:outline-none resize-y"
                                value={currentTemplates.departures}
                                onChange={(e) =>
                                  setTemplateMap((prev) => ({
                                    ...prev,
                                    [language]: { ...(prev[language] || buildTemplateDefaults(language)), departures: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Plantilla llegadas
                              </label>
                              <textarea
                                rows={4}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 font-mono focus:border-blue-900 focus:outline-none resize-y"
                                value={currentTemplates.arrivals}
                                onChange={(e) =>
                                  setTemplateMap((prev) => ({
                                    ...prev,
                                    [language]: { ...(prev[language] || buildTemplateDefaults(language)), arrivals: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="md:col-span-2 text-xs text-slate-600 border border-slate-200 rounded-lg p-3 bg-slate-50">
                              <span className="font-semibold text-slate-700">Plantilla activa: </span>
                              <span className="font-mono break-words">{previewText}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={saveVoiceConfiguration}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                  >
                    💾 Guardar voces y plantillas
                  </button>
                  <button
                    onClick={openAnnouncementModal}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    🎤 Megafonía
                  </button>
                </div>
              </div>
            )}

            {/* Megaphony Tab */}
            {activeTab === "displayScreens" && (
              <div className="animate-fadeIn">
                <DisplayScreensPanel stations={stations} />
              </div>
            )}
            {activeTab === "devices" && (
              <div className="animate-fadeIn">
                <DevicesPanel />
              </div>
            )}
            {activeTab === "automation" && (
              <div className="animate-fadeIn">
                <AutomationPanel />
              </div>
            )}
            {activeTab === "audioNodes" && (
              <div className="animate-fadeIn">
                <AudioNodesPanel />
              </div>
            )}
            {activeTab === "hardware" && (
              <div className="animate-fadeIn">
                <HardwarePanel />
              </div>
            )}
            {activeTab === "simulation" && (
              <div className="animate-fadeIn">
                <SimulationPanel />
              </div>
            )}
            {activeTab === "megaphony" && (
              <div className="animate-fadeIn">
                <MegaphonyPanel
                  operators={operators}
                  trainTypes={trainTypes}
                  trains={trains}
                  stations={stations}
                  ttsConfig={config}
                />
              </div>
            )}
          </div>
        </main>

        {/* Announcement Modal */}
        {announcementModalOpen && (
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl flex flex-col">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Megafonía</h3>
                  <p className="text-xs text-slate-500">Selecciona idioma y aviso. Puedes editar el texto antes de reproducirlo.</p>
                </div>
                <button
                  onClick={() => setAnnouncementModalOpen(false)}
                  className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Idioma</label>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGE_KEYS.map((language) => (
                      <button
                        key={language}
                        onClick={() => selectAnnouncementLanguage(language)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition border ${
                          announcementModalLanguage === language
                            ? "border-blue-200 bg-blue-50 text-blue-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {LANGUAGES[language]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tipo de aviso</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {ANNOUNCEMENT_SCENARIOS.map((scenario) => (
                      <button
                        key={scenario.key}
                        onClick={() => selectAnnouncementScenario(scenario.key)}
                        className={`rounded-xl border px-4 py-3 text-left transition ${
                          announcementModalScenario === scenario.key
                            ? "border-blue-200 bg-blue-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-sm font-semibold text-slate-900">{scenario.label[announcementModalLanguage]}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500 max-h-10 overflow-hidden">
                          {scenario.build(announcementModalLanguage)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Texto editable</label>
                  <textarea
                    rows={8}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-900 focus:border-blue-900 focus:outline-none resize-y"
                    value={announcementModalText}
                    onChange={(e) => setAnnouncementModalText(e.target.value)}
                    placeholder="El texto del anuncio aparecerá aquí..."
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Puedes editar el texto antes de reproducirlo. La voz se selecciona según el idioma activo.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-slate-200">
                <div className="text-xs text-slate-500">
                  Voz activa: <span className="text-slate-900 font-semibold">{LANGUAGES[announcementModalLanguage]}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setAnnouncementModalText(buildAnnouncementText(announcementModalLanguage, announcementModalScenario))}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Restablecer texto
                  </button>
                  <button
                    onClick={speakAnnouncementModal}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                  >
                    🔊 Reproducir
                  </button>
                  <button
                    onClick={() => setAnnouncementModalOpen(false)}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notification Toast */}
        {modal && (
          <div className="fixed bottom-6 right-6 animate-slideUp z-50">
            <div
              className={`px-5 py-3 rounded-lg shadow-lg border flex items-start gap-3 max-w-sm text-sm ${
                modal.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : modal.type === "error"
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              <div className="text-base leading-none shrink-0 mt-0.5">
                {modal.type === "success" ? "✓" : modal.type === "error" ? "✕" : "ℹ"}
              </div>
              <div>
                <div className="font-semibold">{modal.title}</div>
                <div className="mt-0.5 opacity-80">{modal.message}</div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Train Modal */}
        {editingTrain && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-2xl w-full">
              <div className="bg-blue-900 px-5 py-4 text-white font-bold text-lg rounded-t-xl">
                {editingTrain.id && editingTrain.id > 0 ? "✏️ Editar Tren" : "🆕 Nuevo Tren"}
              </div>
              <div className="p-6 space-y-4 max-h-[70dvh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">N.º de Tren 1</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                      value={editFormData.number || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, number: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">N.º de Tren 2</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                      value={(editFormData as any).number2 || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, number2: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Destino 1</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                      value={editFormData.destination || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, destination: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Destino 2</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                      value={(editFormData as any).destination2 || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, destination2: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tipo de Tren</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                      value={editFormData.train_type_id ?? ""}
                      onChange={(e) => setEditFormData({ ...editFormData, train_type_id: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">— Sin tipo —</option>
                      {trainTypes.map((tt) => (
                        <option key={tt.id} value={tt.id}>
                          {tt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Operador</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                      value={editFormData.operator_id ?? ""}
                      onChange={(e) => setEditFormData({ ...editFormData, operator_id: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">— Sin operador —</option>
                      {operators.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hora Programada</label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    value={editFormData.scheduled_time || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, scheduled_time: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Andén</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    value={editFormData.platform && editFormData.platform !== "-" ? editFormData.platform : ""}
                    onChange={(e) => setEditFormData({ ...editFormData, platform: e.target.value })}
                  >
                    {editingPlatformOptions.map((platform) => (
                      <option key={platform || "empty"} value={platform}>
                        {platform ? `Vía ${platform}` : "— Sin vía —"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sector</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    value={editFormData.sector && editFormData.sector !== "-" ? editFormData.sector : ""}
                    onChange={(e) => setEditFormData({ ...editFormData, sector: e.target.value })}
                  >
                    {editingSectorOptions.map((sector) => (
                      <option key={sector || "empty"} value={sector}>
                        {sector ? `Sector ${sector}` : "— Sin sector —"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Estado</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    value={editFormData.status || "Scheduled"}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as Train["status"] })}
                  >
                    <option value="Scheduled">Programado</option>
                    <option value="Boarding">Embarque</option>
                    <option value="Departed">Salido</option>
                    <option value="Delayed">Retrasado</option>
                    <option value="Cancelled">Cancelado</option>
                    <option value="Arrived">Llegado</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Observaciones</label>
                  <textarea
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none resize-y"
                    placeholder="Ej: circula con retraso por obras en la vía"
                    value={editFormData.observations || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, observations: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Paradas intermedias</label>
                  <StopsEditor stops={editStops} onChange={setEditStops} variant="light" />
                </div>

                {/* Stopping pattern */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Patró de parades</label>
                  <select value={editFormData.stopping_pattern || ""} onChange={(e) => setEditFormData({ ...editFormData, stopping_pattern: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none">
                    <option value="">Normal (llista de parades)</option>
                    <option value="ALL_STATIONS">Para a totes les estacions</option>
                    <option value="DIRECT">Tren directe (no para)</option>
                    <option value="SEMI_FAST">Semidirecte (para a les principals)</option>
                    <option value="ALL_EXCEPT">Para a totes excepte...</option>
                    <option value="ONLY_STOPS_AT">Només para a...</option>
                  </select>
                </div>

                {editFormData.stopping_pattern === "ALL_EXCEPT" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Excepte estacions (una per línia)</label>
                    <textarea rows={2} placeholder="Granollers&#10;Caldes"
                      value={(editFormData.except_stations || []).join("\n")}
                      onChange={(e) => setEditFormData({ ...editFormData, except_stations: e.target.value.split("\n").map(s=>s.trim()).filter(Boolean) })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none resize-y" />
                  </div>
                )}

                {/* Fare restrictions */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Restriccions de bitllets</label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      ["commuterTicketsNotAccepted", "Bitllets Rodalies"],
                      ["commuterPassesNotAccepted", "Abonaments Rodalies"],
                      ["regionalTicketsNotAccepted", "Bitllets Regionals"],
                      ["regionalPassesNotAccepted", "Abonaments Regionals"],
                      ["reservationRequired", "Reserva obligatòria"],
                      ["supplementRequired", "Suplement obligatori"],
                      ["specificTicketRequired", "Bitllet específic"],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={!!(editFormData.fare_restrictions as any)?.[key]}
                          onChange={(e) => setEditFormData({
                            ...editFormData,
                            fare_restrictions: { ...(editFormData.fare_restrictions as any || {}), [key]: e.target.checked },
                          })}
                          className="rounded border-slate-300" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={handleSaveEditedTrain}
                    className="flex-1 inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                  >
                    ✓ Guardar
                  </button>
                  <button
                    onClick={() => setEditingTrain(null)}
                    className="flex-1 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    ✗ Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Operator Modal */}
        {editingOperator && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-md w-full">
              <div className="bg-blue-900 px-5 py-4 text-white font-bold text-lg rounded-t-xl">✏️ Editar Operador</div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nombre</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    value={editingOperator.name || ""}
                    onChange={(e) => setEditingOperator({ ...editingOperator, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Logo</label>
                  {editingOperator.logo_url && (
                    <div className="mb-2">
                      <img
                        src={fileUrl(editingOperator.logo_url)!}
                        alt="Logo"
                        className="w-16 h-16 object-contain"
                        onError={(e) => handleImgError(e, editingOperator.name)}
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none"
                    onChange={(e) => setOperatorLogo(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={async () => {
                      await api.updateOperator(editingOperator.id, editingOperator.name, operatorLogo || undefined);
                      setEditingOperator(null);
                      setOperatorLogo(null);
                      await refresh();
                      showNotification("success", "✓ Operador actualizado", "");
                    }}
                    className="flex-1 inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                  >
                    ✓ Guardar
                  </button>
                  <button
                    onClick={() => {
                      setEditingOperator(null);
                      setOperatorLogo(null);
                    }}
                    className="flex-1 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    ✗ Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Train Type Modal */}
        {editingType && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-md w-full">
              <div className="bg-blue-900 px-5 py-4 text-white font-bold text-lg rounded-t-xl">✏️ Editar Tipo</div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Código</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    value={editingType.code || ""}
                    onChange={(e) => setEditingType({ ...editingType, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nombre</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    value={editingType.name || ""}
                    onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Color</label>
                  <input
                    type="color"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 h-10 cursor-pointer"
                    value={editingType.color || "#3E8DCA"}
                    onChange={(e) => setEditingType({ ...editingType, color: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Logo</label>
                  {editingType.logo_url && (
                    <div className="mb-2">
                      <img
                        src={fileUrl(editingType.logo_url)!}
                        alt="Logo"
                        className="w-12 h-12 object-contain"
                        onError={(e) => handleImgError(e, editingType.name)}
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none"
                    onChange={(e) => setTypeLogo(e.target.files?.[0] || null)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Icono para Destino</label>
                  {editingType.destination_icon_url && (
                    <div className="mb-2">
                      <img
                        src={fileUrl(editingType.destination_icon_url)!}
                        alt="Destination Icon"
                        className="w-12 h-12 object-contain"
                        onError={(e) => handleImgError(e, editingType.name)}
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none"
                    onChange={(e) => setTypeDestinationIcon(e.target.files?.[0] || null)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                    checked={!!editingType.is_cercanias}
                    onChange={(e) => setEditingType({ ...editingType, is_cercanias: e.target.checked ? 1 : 0 })}
                  />
                  Es cercanías
                </label>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Categoría</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    value={editingType.category || ""}
                    onChange={(e) => setEditingType({ ...editingType, category: e.target.value })}
                  >
                    <option value="">— Sin categoría —</option>
                    {["Alta Velocidad", "Media Distancia", "Regional", "Cercanías", "Internacional", "Larga Distancia"].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Atributo</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
                    placeholder="Atributo libre (ej: Rodalies de Catalunya)"
                    value={editingType.attribute || ""}
                    onChange={(e) => setEditingType({ ...editingType, attribute: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={async () => {
                      await api.updateTrainType(
                        editingType.id,
                        editingType.code,
                        editingType.name,
                        editingType.color,
                        typeLogo || undefined,
                        typeDestinationIcon || undefined,
                        editingType.announce_template || null,
                        !!editingType.is_cercanias,
                        editingType.category || null,
                        editingType.attribute || null,
                      );
                      setEditingType(null);
                      setTypeLogo(null);
                      setTypeDestinationIcon(null);
                      await refresh();
                      showNotification("success", "✓ Tipo actualizado", "");
                    }}
                    className="flex-1 inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                  >
                    ✓ Guardar
                  </button>
                  <button
                    onClick={() => {
                      setEditingType(null);
                      setTypeLogo(null);
                      setTypeDestinationIcon(null);
                    }}
                    className="flex-1 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    ✗ Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
      </div>
    </div>
  );
}
