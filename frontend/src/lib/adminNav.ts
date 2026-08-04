import {
  LayoutDashboard,
  ShieldCheck,
  FileJson,
  Route as RouteIcon,
  Building2,
  Train as TrainIcon,
  Tags,
  MapPin,
  ClipboardList,
  Monitor,
  Building,
  Palette,
  Mic,
  Volume2,
  Megaphone,
  Radio,
  Cpu,
  GitBranch,
  Brain,
  type LucideIcon,
  Monitor as DisplayIcon,
  Play,
} from "lucide-react";

// Single source of truth for the RailBoard admin navigation, shared between the
// Admin shell and the per-display configurator (DisplayConfig).

export interface AdminNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "General",
    items: [
      { id: "dashboard", label: "Panel", icon: LayoutDashboard, to: "/admin" },
      { id: "validation", label: "Validación", icon: ShieldCheck, to: "/admin/validation" },
      { id: "import", label: "Importación de datos", icon: FileJson, to: "/admin/import" },
    ],
  },
  {
    label: "Infraestructura ferroviaria",
    items: [
      { id: "routes", label: "Rutas", icon: RouteIcon, to: "/admin/routes" },
      { id: "operators", label: "Operadores", icon: Building2, to: "/admin/operators" },
      { id: "trains", label: "Trenes", icon: TrainIcon, to: "/admin/trains" },
      { id: "types", label: "Tipos de tren", icon: Tags, to: "/admin/types" },
      { id: "places", label: "Destinos", icon: MapPin, to: "/admin/places" },
      { id: "services", label: "Servicios", icon: ClipboardList, to: "/admin/services" },
    ],
  },
  {
    label: "Displays y señalética",
    items: [
      { id: "displays", label: "Displays", icon: Monitor, to: "/admin/displays" },
      { id: "station", label: "Estación actual", icon: Building, to: "/admin/station" },
      { id: "styles", label: "Estilos", icon: Palette, to: "/admin/styles" },
    ],
  },
  {
    label: "Audio y locuciones",
    items: [
      { id: "voice", label: "Voz e idiomas", icon: Mic, to: "/admin/voice" },
      { id: "locutions", label: "Locuciones", icon: Volume2, to: "/admin/locutions" },
    ],
  },
  {
    label: "Información al viajero",
    items: [
      { id: "displayScreens", label: "Pantallas", icon: DisplayIcon, to: "/admin/displayScreens" },
      { id: "megaphony", label: "Megafonía", icon: Megaphone, to: "/admin/megaphony" },
      { id: "audioNodes", label: "Nodos audio", icon: Radio, to: "/admin/audioNodes" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { id: "devices", label: "Dispositivos", icon: Radio, to: "/admin/devices" },
      { id: "hardware", label: "Hardware", icon: Cpu, to: "/admin/hardware" },
      { id: "simulation", label: "Simulación", icon: GitBranch, to: "/admin/simulation" },
      { id: "automation", label: "Automatización", icon: Brain, to: "/admin/automation" },
    ],
  },
  { label: "Operación", items: [{ id: "play", label: "Reproducción", icon: Play, to: "/admin/play" }] },
];

export function findNavTitle(id: string): string {
  for (const group of ADMIN_NAV_GROUPS) {
    const item = group.items.find((i) => i.id === id);
    if (item) return item.label;
  }
  return "Panel";
}

export { findNavTitle as getTabLabel };