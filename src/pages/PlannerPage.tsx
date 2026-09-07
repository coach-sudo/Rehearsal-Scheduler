import { useMemo, useRef, useState } from "react";
import { useAppState } from "../App";
import TimeGrid from "../components/TimeGrid";
import ConflictModal from "../components/ConflictModal";
import { checkBeatConflicts, getBeatProgress, mergePlannerSelections } from "../utils/scheduler";
import { addMinutes, getTimeSlots, getWeekDates, id, normalizeWeekStart, timeToMinutes } from "../utils/time";
import { getBeatAvailability, isSlotBlocked } from "../utils/availability";
import type { PlannerBlockout, PlannerSelection, ScheduledBlock } from "../types";

export default function PlannerPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { state, setState } = useAppState();
  const [openCell, setOpenCell] = useState<string | null>(null);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [onlyNeedsRehearsal, setOnlyNeedsRehearsal] = useState(false);
  const [onlyNotScheduled, setOnlyNotScheduled] = useState(false);
  const [pendingBlocks, setPendingBlocks] = useState<ScheduledBlock[] | null>(null);
  const [range, setRange] = useState<{ date: string; laneId: string; startTime: string; endTime: string } | null>(null);
  const [rangeBeatIds, setRangeBeatIds] = useState<string[]>([]);
  const [rangeCall, setRangeCall] = useState({ type: "break" as PlannerBlockout["type"], title: "Break", location: "", actorIds: [] as string[] });
  const [finderBeatId, setFinderBeatId] = useState("");
  const [smartCreateMessage, setSmartCreateMessage] = useState("");
  const smartCreateRun = useRef(0);
  const [blockoutDraft, setBlockoutDraft] = useState<Omit<PlannerBlockout, "id">>({
    date: state.settings.weekStartDate,
    startTime: "16:30",
    endTime: "16:50",
    laneId: "",
    type: "lateStart",
    title: "Late start",
    notes: "",
  });
  const selectionCount = state.plannerSelections.length;
  const scheduledCallCount = state.plannerBlockouts.filter((blockout) =>
    blockout.includeInSchedule &&
    ["break", "lunch", "custom"].includes(blockout.type) &&
    getWeekDates(state.settings.weekStartDate).includes(blockout.date)
  ).length;
  const slotTimes = useMemo(() => getTimeSlots(state.settings.rehearsalStartTime, state.settings.rehearsalEndTime, state.settings.plannerSlotMinutes), [state.settings.rehearsalEndTime, state.settings.rehearsalStartTime, state.settings.plannerSlotMinutes]);

  function toggleSelection(selection: PlannerSelection) {
    setState((current) => {
      const exists = current.plannerSelections.some((item) => item.date === selection.date && item.startTime === selection.startTime && item.laneId === selection.laneId && item.beatId === selection.beatId);
      const selectedBeat = current.beats.find((beat) => beat.id === selection.beatId);
      if (!exists && !selectedBeat) return current;
      const sameTime = current.plannerSelections.filter((item) => item.date === selection.date && item.startTime === selection.startTime);
      const lanesInUse = new Set(sameTime.map((item) => item.laneId));
      if (!exists && !lanesInUse.has(selection.laneId) && lanesInUse.size >= current.settings.maxParallelBlocks) return current;
      if (!exists && selectedBeat && !checkBeatConflicts(selectedBeat, selection.date, selection.startTime, addMinutes(selection.startTime, current.settings.plannerSlotMinutes), selection.laneId, current).canSchedule) return current;
      return { ...current, plannerSelections: exists ? current.plannerSelections.filter((item) => !(item.date === selection.date && item.startTime === selection.startTime && item.laneId === selection.laneId && item.beatId === selection.beatId)) : [...current.plannerSelections, selection] };
    });
  }

  function rangeSlots(target = range) {
    if (!target) return [];
    return slotTimes.filter((time) => timeToMinutes(time) >= timeToMinutes(target.startTime) && timeToMinutes(time) < timeToMinutes(target.endTime));
  }

  function rangeAvailability() {
    if (!range) return [];
    const slots = rangeSlots();
    return state.beats
      .map((beat) => {
        const blocked = slots.some((time) => isSlotBlocked(range.date, time, addMinutes(time, state.settings.plannerSlotMinutes), range.laneId, state));
        const checks = slots.map((time) => checkBeatConflicts(beat, range.date, time, addMinutes(time, state.settings.plannerSlotMinutes), range.laneId, state));
        const firstFail = checks.find((check) => !check.canSchedule);
        return {
          beat,
          canRehearse: !blocked && !firstFail,
          reason: blocked ? "Range includes break or blackout" : firstFail?.conflicts.map((conflict) => `${conflict.actorName ?? "Schedule"}: ${conflict.reason}`).join(", ") ?? "Available for whole range",
        };
      });
  }

  function applyRange() {
    if (!range || !rangeBeatIds.length) return;
    const slots = rangeSlots();
    setState((current) => {
      const additions = slots.flatMap((startTime) => rangeBeatIds
        .filter((beatId) => {
          const beat = current.beats.find((candidate) => candidate.id === beatId);
          return Boolean(beat && checkBeatConflicts(beat, range.date, startTime, addMinutes(startTime, current.settings.plannerSlotMinutes), range.laneId, current).canSchedule);
        })
        .map((beatId) => ({ date: range.date, startTime, laneId: range.laneId, beatId })));
      const keys = new Set(additions.map((selection) => `${selection.date}|${selection.startTime}|${selection.laneId}|${selection.beatId}`));
      const filtered = current.plannerSelections.filter((selection) => !keys.has(`${selection.date}|${selection.startTime}|${selection.laneId}|${selection.beatId}`));
      return { ...current, plannerSelections: [...filtered, ...additions] };
    });
    setRange(null);
    setRangeBeatIds([]);
  }

  function addBlockout() {
    if (!blockoutDraft.date || blockoutDraft.startTime >= blockoutDraft.endTime) return;
    setState((current) => ({
      ...current,
      plannerBlockouts: [
        ...current.plannerBlockouts,
        {
          ...blockoutDraft,
          laneId: blockoutDraft.laneId || undefined,
          id: id("blockout"),
          includeInSchedule: ["break", "lunch", "custom"].includes(blockoutDraft.type),
        },
      ],
    }));
  }

  function addRangeCall() {
    if (!range || !rangeCall.title.trim()) return;
    const allActors = !rangeCall.actorIds.length;
    setState((current) => ({
      ...current,
      plannerBlockouts: [
        ...current.plannerBlockouts,
        {
          id: id("call"),
          date: range.date,
          startTime: range.startTime,
          endTime: range.endTime,
          laneId: range.laneId,
          type: rangeCall.type,
          title: rangeCall.title.trim(),
          location: rangeCall.location.trim() || range.laneId,
          actorIds: allActors ? current.actors.filter((actor) => actor.active).map((actor) => actor.id) : rangeCall.actorIds,
          includeInSchedule: true,
        },
      ],
    }));
    setRange(null);
    setRangeBeatIds([]);
    setRangeCall({ type: "break", title: "Break", location: "", actorIds: [] });
  }

  function finderSlots() {
    if (!finderBeatId) return [];
    const dates = getWeekDates(state.settings.weekStartDate);
    const lanes = state.settings.lanes.slice(0, Math.max(1, state.settings.maxParallelBlocks));
    return dates.flatMap((date) =>
      slotTimes.flatMap((startTime) =>
        lanes.map((laneId) => ({
          date,
          startTime,
          laneId,
          available: !isSlotBlocked(date, startTime, addMinutes(startTime, state.settings.plannerSlotMinutes), laneId, state) && getBeatAvailability(finderBeatId, date, startTime, state).canRehearse,
        }))
      )
    ).filter((slot) => slot.available);
  }

  function smartCreate() {
    const dates = getWeekDates(state.settings.weekStartDate);
    const lanes = state.settings.lanes.slice(0, Math.max(1, state.settings.maxParallelBlocks));
    const blockLength = 3;
    const runOffset = smartCreateRun.current % Math.max(1, dates.length);
    smartCreateRun.current += 1;
    const existingPlannerBlocks = mergePlannerSelections(state.plannerSelections, state, state.settings.weekStartDate);
    const sortedBeats = [...state.beats]
      .filter((beat) => beat.id !== "beat_all")
      .map((beat) => ({ beat, progress: getBeatProgress(beat.id, state) }))
      .map((item) => ({
        ...item,
        plannedCount: existingPlannerBlocks.filter((block) => block.beatIds.includes(item.beat.id)).length,
        scheduledCount: state.scheduledBlocks.filter((block) => block.weekId === state.settings.weekStartDate && block.beatIds.includes(item.beat.id)).length,
      }))
      .filter(({ progress, plannedCount, scheduledCount }) => progress.remainingCount - plannedCount - scheduledCount > 0)
      .sort((a, b) =>
        (b.progress.remainingCount - b.plannedCount - b.scheduledCount) - (a.progress.remainingCount - a.plannedCount - a.scheduledCount) ||
        String(a.progress.lastRehearsedDate ?? "0000-00-00").localeCompare(String(b.progress.lastRehearsedDate ?? "0000-00-00")) ||
        b.beat.rosterActorIds.length - a.beat.rosterActorIds.length
      );
    const selections: PlannerSelection[] = [];
    const occupiedActors = new Map<string, Set<string>>();
    const occupiedLanes = new Map<string, Set<string>>();
    const dayLoad = new Map(dates.map((date) => [date, state.plannerSelections.filter((selection) => selection.date === date).length]));
    const beatDays = new Map<string, Set<string>>();

    state.plannerSelections.forEach((selection) => {
      const slotKey = `${selection.date}|${selection.startTime}`;
      const laneSet = occupiedLanes.get(slotKey) ?? new Set<string>();
      laneSet.add(selection.laneId);
      occupiedLanes.set(slotKey, laneSet);

      const actorSet = occupiedActors.get(slotKey) ?? new Set<string>();
      const beat = state.beats.find((item) => item.id === selection.beatId);
      beat?.rosterActorIds.forEach((actorId) => actorSet.add(actorId));
      occupiedActors.set(slotKey, actorSet);

      const days = beatDays.get(selection.beatId) ?? new Set<string>();
      days.add(selection.date);
      beatDays.set(selection.beatId, days);
    });

    const candidates = dates.flatMap((date, dateIndex) =>
      lanes.flatMap((laneId) =>
        Array.from({ length: Math.max(0, slotTimes.length - blockLength + 1) }, (_, index) => ({
          date,
          dateIndex,
          laneId,
          index,
          chunk: slotTimes.slice(index, index + blockLength),
        }))
      )
    );

    function canPlaceBeat(beatId: string, rosterActorIds: string[], date: string, laneId: string, chunk: string[]) {
      return chunk.every((startTime) => {
        const slotKey = `${date}|${startTime}`;
        const lanesAtTime = occupiedLanes.get(slotKey) ?? new Set<string>();
        const actorsAtTime = occupiedActors.get(slotKey) ?? new Set<string>();
        return !lanesAtTime.has(laneId) &&
          lanesAtTime.size < state.settings.maxParallelBlocks &&
          !isSlotBlocked(date, startTime, addMinutes(startTime, state.settings.plannerSlotMinutes), laneId, state) &&
          getBeatAvailability(beatId, date, startTime, { ...state, plannerSelections: [...state.plannerSelections, ...selections] }).canRehearse &&
          rosterActorIds.every((actorId) => !actorsAtTime.has(actorId));
      });
    }

    function placeBeat(beatId: string, rosterActorIds: string[], date: string, laneId: string, chunk: string[]) {
      chunk.forEach((startTime) => {
        selections.push({ date, startTime, laneId, beatId });
        const slotKey = `${date}|${startTime}`;
        const actorsAtTime = occupiedActors.get(slotKey) ?? new Set<string>();
        rosterActorIds.forEach((actorId) => actorsAtTime.add(actorId));
        occupiedActors.set(slotKey, actorsAtTime);

        const lanesAtTime = occupiedLanes.get(slotKey) ?? new Set<string>();
        lanesAtTime.add(laneId);
        occupiedLanes.set(slotKey, lanesAtTime);
      });
      dayLoad.set(date, (dayLoad.get(date) ?? 0) + chunk.length);
      const days = beatDays.get(beatId) ?? new Set<string>();
      days.add(date);
      beatDays.set(beatId, days);
    }

    let beatsPlaced = 0;
    for (const { beat, progress, plannedCount, scheduledCount } of sortedBeats) {
      const targetAdds = Math.max(0, progress.remainingCount - plannedCount - scheduledCount);
      for (let add = 0; add < targetAdds; add += 1) {
        const orderedCandidates = [...candidates].sort((a, b) => {
          const aSameBeatDay = beatDays.get(beat.id)?.has(a.date) ? 1 : 0;
          const bSameBeatDay = beatDays.get(beat.id)?.has(b.date) ? 1 : 0;
          return aSameBeatDay - bSameBeatDay ||
            (dayLoad.get(a.date) ?? 0) - (dayLoad.get(b.date) ?? 0) ||
            ((a.dateIndex - runOffset + dates.length) % dates.length) - ((b.dateIndex - runOffset + dates.length) % dates.length) ||
            timeToMinutes(a.chunk[0]) - timeToMinutes(b.chunk[0]) ||
            a.laneId.localeCompare(b.laneId);
        });

        const winner = orderedCandidates.find(({ date, laneId, chunk }) => canPlaceBeat(beat.id, beat.rosterActorIds, date, laneId, chunk));

        if (!winner) continue;
        placeBeat(beat.id, beat.rosterActorIds, winner.date, winner.laneId, winner.chunk);
        beatsPlaced += 1;
      }
    }
    if (!selections.length) {
      setSmartCreateMessage(sortedBeats.length ? "No open 30-minute chunks match the current goals, availability, blockouts, and lane rules." : "All beats are already at their rehearsal goals for this week.");
      return;
    }
    setSmartCreateMessage(`Smart Create added ${beatsPlaced} rehearsal block${beatsPlaced === 1 ? "" : "s"} across ${new Set(selections.map((selection) => selection.date)).size} day${new Set(selections.map((selection) => selection.date)).size === 1 ? "" : "s"}.`);
    setState((current) => ({ ...current, plannerSelections: [...current.plannerSelections, ...selections] }));
  }

  function buildCalendar() {
    const blocks = mergePlannerSelections(state.plannerSelections, state);
    if (!blocks.length) return;
    if (blocks.some((block) => block.conflicts.length)) setPendingBlocks(blocks);
    else {
      setState((current) => ({ ...current, scheduledBlocks: blocks }));
      onNavigate("schedule");
    }
  }

  function commitBlocks(blocks: ScheduledBlock[]) {
    setState((current) => ({ ...current, scheduledBlocks: blocks }));
    setPendingBlocks(null);
    onNavigate("schedule");
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-semibold">Weekly Planner</h2><p className="text-stone-600">10-minute slots mapped to 30-minute availability blocks. Availability Matrix "Available" cells are the source of truth.</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={smartCreate} className="rounded bg-sky px-3 py-2 text-sm font-medium text-white">Smart create</button>
          <button onClick={() => setState((current) => ({ ...current, plannerSelections: [] }))} className="rounded border border-line bg-white px-3 py-2 text-sm">Clear planner</button>
          <button onClick={buildCalendar} disabled={!selectionCount && !scheduledCallCount} className="rounded bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Build calendar</button>
        </div>
      </div>
      {smartCreateMessage && <div className="mb-4 rounded-lg border border-sky/30 bg-sky/10 px-3 py-2 text-sm text-stone-700">{smartCreateMessage}</div>}
      <div className="mb-4 grid gap-3 rounded-lg border border-line bg-white p-3 text-sm shadow-sm xl:grid-cols-[1.1fr_1.2fr]">
        <div>
          <div className="mb-2 font-semibold">Schedule constraints, breaks, and lunch</div>
          <div className="grid gap-2 sm:grid-cols-6">
            <input type="date" value={blockoutDraft.date} onChange={(event) => setBlockoutDraft({ ...blockoutDraft, date: event.target.value })} className="rounded border border-line px-2 py-1" />
            <input type="time" value={blockoutDraft.startTime} onChange={(event) => setBlockoutDraft({ ...blockoutDraft, startTime: event.target.value })} className="rounded border border-line px-2 py-1" />
            <input type="time" value={blockoutDraft.endTime} onChange={(event) => setBlockoutDraft({ ...blockoutDraft, endTime: event.target.value })} className="rounded border border-line px-2 py-1" />
            <select value={blockoutDraft.type} onChange={(event) => {
              const type = event.target.value as PlannerBlockout["type"];
              const title = type === "lateStart" ? "Late start" : type === "halfDay" ? "Half day" : type === "break" ? "Break" : type === "lunch" ? "Lunch" : type === "custom" ? "Workshop" : "Blocked";
              setBlockoutDraft({ ...blockoutDraft, type, title });
            }} className="rounded border border-line px-2 py-1"><option value="blackout">Blackout</option><option value="lateStart">Late start</option><option value="halfDay">Half day</option><option value="break">Break</option><option value="lunch">Lunch</option><option value="custom">Custom call</option></select>
            <select value={blockoutDraft.laneId ?? ""} onChange={(event) => setBlockoutDraft({ ...blockoutDraft, laneId: event.target.value })} className="rounded border border-line px-2 py-1"><option value="">All lanes</option>{state.settings.lanes.map((lane) => <option key={lane} value={lane}>{lane}</option>)}</select>
            <button onClick={addBlockout} className="rounded bg-ink px-2 py-1 text-white">Add</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {state.plannerBlockouts.map((blockout) => <span key={blockout.id} className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">{blockout.title} {blockout.date} {blockout.startTime}-{blockout.endTime} <button onClick={() => setState((current) => ({ ...current, plannerBlockouts: current.plannerBlockouts.filter((item) => item.id !== blockout.id) }))} className="ml-1 text-coral">x</button></span>)}
          </div>
        </div>
        <div>
          <div className="mb-2 font-semibold">Beat availability finder</div>
          <select value={finderBeatId} onChange={(event) => setFinderBeatId(event.target.value)} className="w-full rounded border border-line px-2 py-1">
            <option value="">Select a beat to see when it can rehearse</option>
            {state.beats.map((beat) => <option key={beat.id} value={beat.id}>{beat.title}</option>)}
          </select>
          {finderBeatId && <div className="mt-2 flex max-h-20 flex-wrap gap-1 overflow-auto">{finderSlots().slice(0, 24).map((slot) => <button key={`${slot.date}-${slot.startTime}-${slot.laneId}`} onClick={() => toggleSelection({ date: slot.date, startTime: slot.startTime, laneId: slot.laneId, beatId: finderBeatId })} className="rounded bg-green-100 px-2 py-1 text-xs text-green-900">{slot.date.slice(5)} {slot.startTime} {slot.laneId}</button>)}</div>}
        </div>
      </div>
      {range && (
        <div className="mb-4 rounded-lg border border-moss bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
          <div><strong>Range selected:</strong> {range.date} | {range.laneId} | {range.startTime}-{range.endTime}</div>
            <button onClick={() => setRange(null)} className="text-sm text-coral">Cancel</button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-4">
            {rangeAvailability().map(({ beat, canRehearse, reason }) => (
              <label key={beat.id} className={`rounded border p-2 text-sm ${canRehearse ? "border-line" : "border-red-100 bg-red-50 text-stone-500"}`}>
                <input type="checkbox" disabled={!canRehearse} checked={rangeBeatIds.includes(beat.id)} onChange={() => setRangeBeatIds((current) => current.includes(beat.id) ? current.filter((id) => id !== beat.id) : [...current, beat.id])} className="mr-2" />
                <span className="font-medium">{beat.title}</span>
                <div className="mt-1 text-xs">{reason}</div>
              </label>
            ))}
          </div>
          <button onClick={applyRange} disabled={!rangeBeatIds.length} className="mt-3 rounded bg-moss px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Apply selected beats to range</button>
          <div className="mt-4 rounded-lg border border-line bg-panel p-3">
            <div className="font-semibold">Or add a scheduled non-scene call</div>
            <div className="mt-2 grid gap-2 md:grid-cols-4">
              <select value={rangeCall.type} onChange={(event) => {
                const type = event.target.value as PlannerBlockout["type"];
                setRangeCall({ ...rangeCall, type, title: type === "lunch" ? "Lunch" : type === "break" ? "Break" : rangeCall.title === "Break" ? "Workshop" : rangeCall.title });
              }} className="rounded border border-line px-2 py-1"><option value="break">Break</option><option value="lunch">Lunch</option><option value="custom">Custom</option></select>
              <input value={rangeCall.title} onChange={(event) => setRangeCall({ ...rangeCall, title: event.target.value })} className="rounded border border-line px-2 py-1" placeholder="Workshop, lunch, travel" />
              <input value={rangeCall.location} onChange={(event) => setRangeCall({ ...rangeCall, location: event.target.value })} className="rounded border border-line px-2 py-1" placeholder="Location / venue" />
              <button onClick={addRangeCall} className="rounded bg-ink px-3 py-1 text-white">Add to schedule</button>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium">Actors affected: {rangeCall.actorIds.length ? `${rangeCall.actorIds.length} selected` : "All active actors"}</summary>
              <div className="mt-2 grid gap-1 sm:grid-cols-3">
                <label className="rounded border border-line bg-white px-2 py-1 text-sm"><input type="checkbox" checked={!rangeCall.actorIds.length} onChange={() => setRangeCall({ ...rangeCall, actorIds: [] })} className="mr-2" />All active actors</label>
                {state.actors.filter((actor) => actor.active).map((actor) => (
                  <label key={actor.id} className="rounded border border-line bg-white px-2 py-1 text-sm">
                    <input type="checkbox" checked={rangeCall.actorIds.includes(actor.id)} onChange={() => setRangeCall((current) => ({ ...current, actorIds: current.actorIds.includes(actor.id) ? current.actorIds.filter((id) => id !== actor.id) : [...current.actorIds, actor.id] }))} className="mr-2" />
                    {actor.name}
                  </label>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3 text-sm shadow-sm">
        <span className="rounded bg-panel px-2 py-1 font-medium">{selectionCount} selected slot{selectionCount === 1 ? "" : "s"}{scheduledCallCount ? ` + ${scheduledCallCount} scheduled call${scheduledCallCount === 1 ? "" : "s"}` : ""}</span>
        <label>Week <input type="date" value={state.settings.weekStartDate} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, weekStartDate: normalizeWeekStart(event.target.value) } }))} className="ml-2 rounded border border-line px-2 py-1" /></label>
        <label>Max absences <input type="number" min={0} value={state.settings.maxAbsencesAllowed} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, maxAbsencesAllowed: Number(event.target.value) } }))} className="ml-2 w-16 rounded border border-line px-2 py-1" /></label>
        <label>Visible lanes <input type="number" min={1} max={Math.max(1, state.settings.lanes.length)} value={state.settings.maxParallelBlocks} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, maxParallelBlocks: Number(event.target.value) } }))} className="ml-2 w-16 rounded border border-line px-2 py-1" /></label>
        <label><input type="checkbox" checked={showUnavailable} onChange={(event) => setShowUnavailable(event.target.checked)} className="mr-1" />Show unavailable with reasons</label>
        <label><input type="checkbox" checked={onlyNeedsRehearsal} onChange={(event) => setOnlyNeedsRehearsal(event.target.checked)} className="mr-1" />Needs rehearsal</label>
        <label><input type="checkbox" checked={onlyNotScheduled} onChange={(event) => setOnlyNotScheduled(event.target.checked)} className="mr-1" />Not scheduled this week</label>
      </div>
      <TimeGrid state={state} showUnavailable={showUnavailable} onlyNeedsRehearsal={onlyNeedsRehearsal} onlyNotScheduled={onlyNotScheduled} openCell={openCell} setOpenCell={setOpenCell} toggleSelection={toggleSelection} onRangeSelect={(nextRange) => { setRange(nextRange); setRangeBeatIds([]); }} />
      {pendingBlocks && <ConflictModal blocks={pendingBlocks} onCancel={() => setPendingBlocks(null)} onProceed={() => commitBlocks(pendingBlocks)} />}
    </section>
  );
}
