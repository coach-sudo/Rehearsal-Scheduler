import { BarChart3, CalendarDays, CheckSquare, Clock3, Download, Grid3X3, Home, Palette, Settings, SlidersHorizontal, UserRoundCheck, Users } from "lucide-react";

const items = [
  { id: "dashboard", label: "Dashboard", group: "Home", Icon: Home },
  { id: "actors", label: "Actors & Photos", group: "Setup", Icon: Users },
  { id: "availability", label: "Availability", group: "Setup", Icon: Grid3X3 },
  { id: "overrides", label: "Conflicts", group: "Setup", Icon: SlidersHorizontal },
  { id: "casting", label: "Casting & Groups", group: "Casting", Icon: UserRoundCheck },
  { id: "beats", label: "Beats & Scenes", group: "Casting", Icon: CheckSquare },
  { id: "planner", label: "Weekly Planner", group: "Plan", Icon: CalendarDays },
  { id: "schedule", label: "Saved Schedule", group: "Plan", Icon: Clock3 },
  { id: "designer", label: "Schedule Designer", group: "Share", Icon: Palette },
  { id: "progress", label: "Progress", group: "Share", Icon: BarChart3 },
  { id: "settings", label: "Settings", group: "Project", Icon: Settings },
  { id: "import", label: "Import / Export", group: "Project", Icon: Download },
] as const;

export const navItems = items.map(({ id, label }) => ({ id, label }));

interface Props {
  active: string;
  onChange: (page: string) => void;
}

export default function Nav({ active, onChange }: Props) {
  let previousGroup = "";
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ id, label, group, Icon }) => {
        const showGroup = group !== previousGroup;
        previousGroup = group;
        return (
          <div key={id}>
            {showGroup && <div className="mt-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500 first:mt-0">{group}</div>}
            <button
              onClick={() => onChange(id)}
              className={`focus-ring mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                active === id ? "bg-ink text-white shadow-sm" : "text-ink hover:bg-white/80"
              }`}
              title={label}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
