import type { AppState, BeatAvailability, PlannerSelection } from "../types";
import StatusBadge from "./StatusBadge";
import { getAvailabilityBlockForTime } from "../utils/time";

interface Props {
  state: AppState;
  date: string;
  startTime: string;
  laneId: string;
  options: BeatAvailability[];
  showUnavailable: boolean;
  selections: PlannerSelection[];
  onToggle: (beatId: string) => void;
  onClose: () => void;
}

export default function BeatPickerPopover({ state, date, startTime, laneId, options, showUnavailable, selections, onToggle, onClose }: Props) {
  const selectedIds = selections.filter((selection) => selection.date === date && selection.startTime === startTime && selection.laneId === laneId).map((selection) => selection.beatId);
  const visible = showUnavailable ? options : options.filter((option) => option.canRehearse);
  const block = getAvailabilityBlockForTime(startTime, state.settings.availabilityBlockMinutes);
  return (
    <div className="absolute left-1 top-8 z-40 w-80 rounded-lg border border-line bg-white p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{date} | {startTime} | {laneId}</div>
          <div className="text-xs text-stone-500">Choose one beat or several beats to rehearse together. Reads availability block {block.startTime}-{block.endTime}.</div>
        </div>
        <button onClick={onClose} className="rounded px-2 text-sm hover:bg-stone-100">×</button>
      </div>
      <div className="mb-2 flex gap-2">
        <button
          onClick={() => visible.filter((option) => option.canRehearse && !selectedIds.includes(option.beatId)).forEach((option) => onToggle(option.beatId))}
          className="rounded border border-line bg-panel px-2 py-1 text-xs font-medium"
        >
          Select all available
        </button>
        <button
          onClick={() => selectedIds.forEach(onToggle)}
          disabled={!selectedIds.length}
          className="rounded border border-line bg-white px-2 py-1 text-xs font-medium disabled:opacity-40"
        >
          Clear slot
        </button>
      </div>
      <div className="max-h-72 space-y-2 overflow-auto">
        {visible.map((option) => {
          const beat = state.beats.find((candidate) => candidate.id === option.beatId);
          return (
            <label key={option.beatId} className={`block rounded-md border p-2 text-sm ${option.canRehearse ? "border-line hover:bg-panel" : "border-red-100 bg-red-50"}`}>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={selectedIds.includes(option.beatId)} disabled={!option.canRehearse} onChange={() => onToggle(option.beatId)} />
                <span className="font-medium">{beat?.title}</span>
                <StatusBadge tone={option.canRehearse ? "green" : "red"}>{option.canRehearse ? "available" : "blocked"}</StatusBadge>
              </div>
              <div className="mt-1 text-xs text-stone-600">
                roster {option.rosterSize} | missing {option.missingCount}
                {option.missingActors.length ? ` | ${option.missingActors.map((actor) => actor.name).join(", ")}` : ""}
                {option.overrideConflicts.length ? ` | overrides: ${option.overrideConflicts.map((actor) => actor.name).join(", ")}` : ""}
              </div>
              {!option.canRehearse && <div className="mt-1 text-xs font-medium text-coral">{option.reason}</div>}
            </label>
          );
        })}
        {!visible.length && <div className="rounded border border-line p-3 text-sm text-stone-600">No available beats for this slot.</div>}
      </div>
    </div>
  );
}
