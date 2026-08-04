import { Link } from "react-router-dom";
import { ADMIN_NAV_GROUPS, type AdminNavGroup } from "../../lib/adminNav";

// Shared responsive sidebar for the RailBoard admin screens. Two positioning
// variants are supported:
//   - "grid"  (used by Admin): the sidebar is a static column of a CSS grid.
//   - "fixed" (used by DisplayConfig): the sidebar overlays the content and the
//     main area shifts with a left margin when it is open on desktop.
// Navigation items come from lib/adminNav so all screens share the same structure.

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
  activeId: string;
  groups?: AdminNavGroup[];
  variant?: "grid" | "fixed";
  onNavigate?: (id: string) => void;
}

export default function AdminSidebar({
  open,
  onClose,
  activeId,
  groups = ADMIN_NAV_GROUPS,
  variant = "grid",
  onNavigate,
}: AdminSidebarProps) {
  const asideClasses =
    variant === "grid"
      ? `fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto ${open ? "translate-x-0" : "-translate-x-full"}`
      : `fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:fixed ${open ? "lg:translate-x-0 translate-x-0" : "lg:-translate-x-full -translate-x-full"}`;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={onClose}>
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      <aside className={asideClasses}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200">
          <div className="w-8 h-8 bg-blue-900 rounded-lg flex items-center justify-center font-bold text-white text-sm">RB</div>
          <div>
            <h1 className="text-base font-bold text-slate-900">RailBoard</h1>
            <p className="text-xs text-slate-500">Administración</p>
          </div>
        </div>
        <div className="flex-1 px-3 py-4 overflow-y-auto space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === activeId;
                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      onClick={() => onNavigate?.(item.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-blue-50 text-blue-900 font-semibold"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <Icon size={17} className="shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}