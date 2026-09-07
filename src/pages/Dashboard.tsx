import { ArrowRight, CalendarDays, Camera, CheckCircle2, Clapperboard, Grid3X3, Palette, SlidersHorizontal, UserRoundCheck } from "lucide-react";
import { useAppState } from "../App";
import StatusBadge from "../components/StatusBadge";
import { getBeatProgress } from "../utils/scheduler";

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { state } = useAppState();
  const progress = state.beats.map((beat) => getBeatProgress(beat.id, state));
  const completed = progress.filter((item) => item.status === "Done").length;
  const needing = progress.filter((item) => item.status !== "Done").length;
  const weekBlocks = state.scheduledBlocks.filter((block) => block.weekId === state.settings.weekStartDate).length;
  const workflow = [
    { page: "actors", label: "Add actors & photos", helper: "Names first; photos are optional but useful for casting.", done: state.actors.length > 0, Icon: Camera },
    { page: "availability", label: "Mark availability", helper: "Fast yes/no blocks for rehearsal windows.", done: state.availability.some((slot) => slot.available), Icon: Grid3X3 },
    { page: "overrides", label: "Add conflicts", helper: "One-off absences, late starts, and exceptions.", done: state.overrides.length > 0, Icon: SlidersHorizontal },
    { page: "casting", label: "Cast roles & groups", helper: "Assign roles, compare availability, create groups.", done: state.actorGroups.length > 0 || state.characterMap.some((item) => item.characterName), Icon: UserRoundCheck },
    { page: "beats", label: "Split play into beats", helper: "Scenes, calls, music, fight, and custom groups.", done: state.beats.some((beat) => beat.rosterActorIds.length > 0), Icon: Clapperboard },
    { page: "planner", label: "Plan the week", helper: "Drag ranges, pick available beats, smart create.", done: state.plannerSelections.length > 0 || weekBlocks > 0, Icon: CalendarDays },
    { page: "designer", label: "Share schedule", helper: "Choose a director-ready export format.", done: weekBlocks > 0, Icon: Palette },
  ];
  const nextStep = workflow.find((item) => !item.done) ?? (needing ? { page: "planner", label: "Keep rehearsing beats", helper: "Use progress to choose the next week.", Icon: CalendarDays } : { page: "progress", label: "Review completed progress", helper: "Check counts, last rehearsed dates, and exports.", Icon: CheckCircle2 });
  const activeStepIndex = workflow.findIndex((item) => !item.done);
  const nextIndex = activeStepIndex === -1 ? workflow.length - 1 : activeStepIndex;
  return (
    <section>
      <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Current production</div>
            <h2 className="mt-2 text-4xl font-semibold text-ink">{state.settings.playTitle}</h2>
            <p className="mt-2 text-stone-600">Week of {state.settings.weekStartDate}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded bg-panel px-3 py-1">{state.actors.length} actors</span>
              <span className="rounded bg-panel px-3 py-1">{state.beats.length} beats</span>
              <span className="rounded bg-panel px-3 py-1">{completed}/{state.beats.length} complete</span>
              <span className="rounded bg-panel px-3 py-1">{weekBlocks} blocks this week</span>
            </div>
          </div>
          <div className="min-w-[260px] rounded-lg border border-line bg-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Next</div>
              <StatusBadge tone={needing ? "amber" : "green"}>{needing} needing rehearsal</StatusBadge>
            </div>
            <h3 className="mt-3 text-xl font-semibold">{nextStep.label}</h3>
            <p className="mt-1 text-sm text-stone-600">{nextStep.helper}</p>
            <button onClick={() => onNavigate(nextStep.page)} className="focus-ring mt-4 inline-flex items-center gap-2 rounded bg-ink px-4 py-2 text-sm font-medium text-white">
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Production workflow</div>
            <h3 className="mt-1 text-xl font-semibold">One clean path from cast list to call sheet</h3>
          </div>
          <span className="rounded bg-panel px-3 py-1 text-sm text-stone-600">{workflow.filter((item) => item.done).length}/{workflow.length} ready</span>
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-7 md:grid-cols-4">
          {workflow.map((item, index) => (
            <button key={item.page} onClick={() => onNavigate(item.page)} className={`group rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${item.done ? "border-green-200 bg-green-50" : index === nextIndex ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
              <div className="flex items-center justify-between">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${item.done ? "bg-green-700 text-white" : index === nextIndex ? "bg-white text-ink" : "bg-panel text-stone-600"}`}>{index + 1}</span>
                <item.Icon size={17} className={item.done ? "text-green-800" : index === nextIndex ? "text-white" : "text-moss"} />
              </div>
              <div className="mt-3 font-semibold leading-tight">{item.label}</div>
              <div className={`mt-2 text-xs leading-snug ${item.done ? "text-green-900/70" : index === nextIndex ? "text-white/75" : "text-stone-600"}`}>{item.done ? "Ready" : item.helper}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {[
          ["planner", "Weekly Planner", "Build or revise rehearsal blocks."],
          ["designer", "Schedule Designer", "Choose and polish the shareable schedule."],
          ["progress", "Review Progress", "See which beats still need work."],
        ].map(([target, label, helper]) => (
          <button key={target} onClick={() => onNavigate(target)} className="focus-ring group rounded-lg border border-line bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex items-center justify-between font-semibold">{label}<ArrowRight className="transition group-hover:translate-x-1" size={18} /></span>
            <span className="mt-2 block text-sm text-stone-600">{helper}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
