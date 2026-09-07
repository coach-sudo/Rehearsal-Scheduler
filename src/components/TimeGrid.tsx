import type { AppState, PlannerSelection } from "../types";
import { useRef } from "react";
import BeatPickerPopover from "./BeatPickerPopover";
import { getBeatAvailability, getSlotBlockouts, isSlotBlocked } from "../utils/availability";
import { checkBeatConflicts } from "../utils/scheduler";
import { addMinutes, formatTime, getDayOfWeek, getTimeSlots, getWeekDates, shortDayNames, timeToMinutes } from "../utils/time";

interface Props {
  state: AppState;
  showUnavailable: boolean;
  onlyNeedsRehearsal: boolean;
  onlyNotScheduled: boolean;
  openCell: string | null;
  setOpenCell: (key: string | null) => void;
  toggleSelection: (selection: PlannerSelection) => void;
  onRangeSelect?: (range: { date: string; laneId: string; startTime: string; endTime: string }) => void;
}

export default function TimeGrid({ state, showUnavailable, onlyNeedsRehearsal, onlyNotScheduled, openCell, setOpenCell, toggleSelection, onRangeSelect }: Props) {
  const dates = getWeekDates(state.settings.weekStartDate);
  const times = getTimeSlots(state.settings.rehearsalStartTime, state.settings.rehearsalEndTime, state.settings.plannerSlotMinutes);
  const visibleLanes = state.settings.lanes.slice(0, Math.max(1, state.settings.maxParallelBlocks));
  const selectedThisWeek = new Set(state.plannerSelections.filter((selection) => dates.includes(selection.date)).map((selection) => selection.beatId));
  const dragStart = useRef<{ date: string; laneId: string; startTime: string } | null>(null);

  function optionsFor(date: string, startTime: string, laneId: string) {
    return state.beats
      .filter((beat) => !onlyNeedsRehearsal || state.scheduleLog.filter((entry) => entry.beatId === beat.id).length < beat.targetRehearsalCount)
      .filter((beat) => !onlyNotScheduled || !selectedThisWeek.has(beat.id))
      .map((beat) => {
        const availability = getBeatAvailability(beat.id, date, startTime, state);
        const check = checkBeatConflicts(beat, date, startTime, addMinutes(startTime, state.settings.plannerSlotMinutes), laneId, state);
        const laneConflicts = check.conflicts.filter((conflict) => conflict.reason === "Called in another lane" && conflict.actorId)
          .map((conflict) => state.actors.find((actor) => actor.id === conflict.actorId))
          .filter((actor): actor is NonNullable<typeof actor> => Boolean(actor));
        if (check.canSchedule || !laneConflicts.length) return { ...availability, canRehearse: check.canSchedule };
        const missingActors = [...availability.missingActors, ...laneConflicts.filter((actor) => !availability.missingActors.some((missing) => missing.id === actor.id))];
        return {
          ...availability,
          canRehearse: false,
          missingActors,
          missingCount: Math.max(availability.missingCount, missingActors.length),
          reason: `Already booked in another lane: ${laneConflicts.map((actor) => actor.name).join(", ")}`,
        };
      });
  }

  function selectedCountAt(date: string, startTime: string) {
    return new Set(state.plannerSelections.filter((selection) => selection.date === date && selection.startTime === startTime).map((selection) => selection.laneId)).size;
  }

  return (
    <div className="grid-scroll max-h-[70vh] overflow-auto rounded-lg border border-line bg-white">
      <div className="sticky top-0 z-20 grid min-w-[1100px] border-b border-line bg-panel" style={{ gridTemplateColumns: `84px repeat(${dates.length * visibleLanes.length}, minmax(132px, 1fr))` }}>
        <div className="sticky left-0 z-30 bg-panel p-2 text-xs font-semibold uppercase text-stone-600">Time</div>
        {dates.map((date) => visibleLanes.map((lane) => (
          <div key={`${date}-${lane}`} className="border-l border-line p-2 text-sm">
            <div className="font-semibold">{shortDayNames[getDayOfWeek(date)]} {date.slice(5)}</div>
            <div className="text-xs text-stone-600">{lane}</div>
          </div>
        )))}
      </div>
      {times.map((time) => (
        <div key={time} className="grid min-w-[1100px] border-b border-line last:border-b-0" style={{ gridTemplateColumns: `84px repeat(${dates.length * visibleLanes.length}, minmax(132px, 1fr))` }}>
          <div className="sticky left-0 z-10 border-r border-line bg-white p-2 text-xs font-medium text-stone-600">{formatTime(time)}</div>
          {dates.map((date) => visibleLanes.map((lane) => {
            const key = `${date}|${time}|${lane}`;
            const endTime = addMinutes(time, state.settings.plannerSlotMinutes);
            const blocked = isSlotBlocked(date, time, endTime, lane, state);
            const blockouts = getSlotBlockouts(date, time, endTime, lane, state);
            const scheduledCalls = state.plannerBlockouts.filter((blockout) =>
              blockout.includeInSchedule &&
              blockout.date === date &&
              (!blockout.laneId || blockout.laneId === lane) &&
              blockout.startTime < endTime &&
              blockout.endTime > time
            );
            const selections = state.plannerSelections.filter((selection) => selection.date === date && selection.startTime === time && selection.laneId === lane);
            const options = blocked ? [] : optionsFor(date, time, lane);
            const hasOptions = options.some((option) => option.canRehearse);
            const hasOverrideBlock = options.some((option) => option.overrideConflicts.length);
            const overParallel = selectedCountAt(date, time) > state.settings.maxParallelBlocks;
            const bg = blocked ? "bg-amber-100" : overParallel ? "bg-red-100" : selections.length ? "bg-green-100" : hasOptions ? "bg-white" : "bg-stone-100";
            return (
              <div key={key} className={`relative min-h-20 border-l border-line p-1 ${bg}`}>
                <button
                  onPointerDown={() => { dragStart.current = { date, laneId: lane, startTime: time }; }}
                  onPointerUp={() => {
                    if (dragStart.current && dragStart.current.date === date && dragStart.current.laneId === lane && dragStart.current.startTime !== time) {
                      const start = Math.min(timeToMinutes(dragStart.current.startTime), timeToMinutes(time));
                      const end = Math.max(timeToMinutes(dragStart.current.startTime), timeToMinutes(time)) + state.settings.plannerSlotMinutes;
                      onRangeSelect?.({ date, laneId: lane, startTime: addMinutes("00:00", start), endTime: addMinutes("00:00", end) });
                    } else if (!blocked) {
                      setOpenCell(openCell === key ? null : key);
                    }
                    dragStart.current = null;
                  }}
                  className="focus-ring h-full min-h-16 w-full rounded border border-transparent p-1 text-left hover:border-moss"
                >
                  <div className="flex flex-wrap gap-1">
                    {selections.map((selection) => (
                      <span key={`${selection.beatId}-${selection.laneId}`} className="rounded bg-moss px-1.5 py-0.5 text-xs font-medium text-white">
                        {state.beats.find((beat) => beat.id === selection.beatId)?.title}
                      </span>
                    ))}
                    {scheduledCalls.map((call) => (
                      <span key={call.id} className="rounded bg-amber-700 px-1.5 py-0.5 text-xs font-medium text-white">
                        {call.title}
                      </span>
                    ))}
                  </div>
                  {!selections.length && !scheduledCalls.length && <span className="text-xs text-stone-500">{blocked ? blockouts.map((item) => item.title).join(", ") : hasOptions ? "Pick beats" : "No beats"}</span>}
                  {hasOverrideBlock && <span className="absolute right-1 top-1 text-amber-700" title="Override-blocked options">!</span>}
                </button>
                {openCell === key && (
                  <BeatPickerPopover
                    state={state}
                    date={date}
                    startTime={time}
                    laneId={lane}
                    options={options}
                    showUnavailable={showUnavailable}
                    selections={state.plannerSelections}
                    onToggle={(beatId) => toggleSelection({ date, startTime: time, laneId: lane, beatId })}
                    onClose={() => setOpenCell(null)}
                  />
                )}
              </div>
            );
          }))}
        </div>
      ))}
    </div>
  );
}
