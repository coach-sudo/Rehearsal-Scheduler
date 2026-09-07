import { useMemo, useState } from "react";
import { useAppState } from "../App";
import type { AvailabilitySlot, DayOfWeek } from "../types";
import { addMinutes, dayNames, formatTime, getTimeSlots } from "../utils/time";

type PaintMode = "available" | "unavailable" | "toggle";

export default function AvailabilityPage() {
  const { state, setState } = useAppState();
  const [focused, setFocused] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [undoStack, setUndoStack] = useState<AvailabilitySlot[][]>([]);
  const [paintMode, setPaintMode] = useState<PaintMode>("toggle");
  const [dragPaintMode, setDragPaintMode] = useState<Exclude<PaintMode, "toggle"> | null>(null);
  const [painting, setPainting] = useState(false);
  const [activeCell, setActiveCell] = useState<{ actorName: string; day: DayOfWeek; time: string } | null>(null);
  const times = getTimeSlots(state.settings.rehearsalStartTime, state.settings.rehearsalEndTime, state.settings.availabilityBlockMinutes);
  const days = [1, 2, 3, 4, 5] as DayOfWeek[];
  const actors = useMemo(() => {
    const groupActorIds = selectedGroupId ? state.actorGroups.find((group) => group.id === selectedGroupId)?.actorIds ?? [] : [];
    const focusIds = focused.length ? focused : groupActorIds;
    const base = focusIds.length ? state.actors.filter((actor) => focusIds.includes(actor.id)) : state.actors;
    return base.filter((actor) => (showInactive || actor.active) && actor.name.toLowerCase().includes(query.toLowerCase()));
  }, [focused, query, selectedGroupId, showInactive, state.actorGroups, state.actors]);

  function pushUndo(snapshot = state.availability) {
    setUndoStack((current) => [...current.slice(-7), snapshot]);
  }

  function undoAvailability() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setState((current) => ({ ...current, availability: previous }));
    setUndoStack((current) => current.slice(0, -1));
  }

  function getCell(actorId: string, dayOfWeek: DayOfWeek, startTime: string) {
    return state.availability.find((slot) => slot.actorId === actorId && slot.dayOfWeek === dayOfWeek && slot.startTime === startTime)?.available ?? false;
  }

  function writeCells(actorIds: string[], dayList: DayOfWeek[], timeList: string[], available: boolean) {
    setState((current) => {
      const keys = new Set(actorIds.flatMap((actorId) => dayList.flatMap((dayOfWeek) => timeList.map((startTime) => `${actorId}|${dayOfWeek}|${startTime}`))));
      const without = current.availability.filter((slot) => !keys.has(`${slot.actorId}|${slot.dayOfWeek}|${slot.startTime}`));
      const additions = actorIds.flatMap((actorId) =>
        dayList.flatMap((dayOfWeek) =>
          timeList.map((startTime) => ({
            actorId,
            dayOfWeek,
            startTime,
            endTime: addMinutes(startTime, current.settings.availabilityBlockMinutes),
            available,
          }))
        )
      );
      return { ...current, availability: [...without, ...additions] };
    });
  }

  function bulkSet(actorIds: string[], dayList: DayOfWeek[], timeList: string[], available: boolean) {
    pushUndo();
    writeCells(actorIds, dayList, timeList, available);
  }

  function paintCell(actorId: string, dayOfWeek: DayOfWeek, startTime: string, forceMode: PaintMode = paintMode) {
    const current = getCell(actorId, dayOfWeek, startTime);
    const next = forceMode === "toggle" ? !current : forceMode === "available";
    writeCells([actorId], [dayOfWeek], [startTime], next);
  }

  function startPaint(actorId: string, dayOfWeek: DayOfWeek, startTime: string) {
    pushUndo();
    const effectiveMode: Exclude<PaintMode, "toggle"> = paintMode === "toggle"
      ? getCell(actorId, dayOfWeek, startTime) ? "unavailable" : "available"
      : paintMode;
    setDragPaintMode(effectiveMode);
    setPainting(true);
    paintCell(actorId, dayOfWeek, startTime, effectiveMode);
  }

  function copyMondayToWeekdays() {
    pushUndo();
    setState((current) => {
      const monday = current.availability.filter((slot) => slot.dayOfWeek === 1);
      const visibleActorIds = new Set(actors.map((actor) => actor.id));
      const copiedKeys = new Set(actors.flatMap((actor) => [2, 3, 4, 5].flatMap((day) => times.map((time) => `${actor.id}|${day}|${time}`))));
      const without = current.availability.filter((slot) => !copiedKeys.has(`${slot.actorId}|${slot.dayOfWeek}|${slot.startTime}`));
      const additions = monday
        .filter((slot) => visibleActorIds.has(slot.actorId))
        .flatMap((slot) => ([2, 3, 4, 5] as DayOfWeek[]).map((dayOfWeek) => ({ ...slot, dayOfWeek })));
      return { ...current, availability: [...without, ...additions] };
    });
  }

  return (
    <section onPointerUp={() => { setPainting(false); setDragPaintMode(null); }} onPointerCancel={() => { setPainting(false); setDragPaintMode(null); }}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Availability Matrix</h2>
          <p className="text-stone-600">Available means the actor can rehearse. The planner reads these 30-minute blocks for every 10-minute slot.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={undoAvailability} disabled={!undoStack.length} className="rounded border border-line bg-white px-3 py-2 text-sm disabled:opacity-40">Undo</button>
          <button onClick={copyMondayToWeekdays} className="rounded border border-line bg-white px-3 py-2 text-sm">Copy Monday to week</button>
          <button onClick={() => { pushUndo(); setState((current) => ({ ...current, availability: [] })); }} className="rounded border border-line bg-white px-3 py-2 text-sm">Clear matrix</button>
          <button onClick={() => bulkSet(actors.map((actor) => actor.id), days, times, true)} className="rounded bg-moss px-3 py-2 text-sm text-white">Mark visible available</button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-xl border border-line bg-white p-3 shadow-sm lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Find actors</label>
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded border border-line px-3 py-2" placeholder="Type a name to narrow the matrix" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Saved casting group</label>
          <select value={selectedGroupId} onChange={(event) => { setSelectedGroupId(event.target.value); setFocused([]); }} className="mt-1 w-full rounded border border-line px-3 py-2">
            <option value="">All actors</option>
            {state.actorGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Paint tool</div>
          <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-panel p-1">
            {[
              ["available", "Available"],
              ["unavailable", "Unavailable"],
              ["toggle", "Toggle"],
            ].map(([mode, label]) => (
              <button key={mode} onClick={() => setPaintMode(mode as PaintMode)} className={`rounded px-2 py-1.5 text-xs font-medium ${paintMode === mode ? "bg-ink text-white" : "bg-white"}`}>{label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Current cell</div>
          <div className="mt-1 rounded border border-line bg-panel px-3 py-2 text-sm">
            {activeCell ? `${activeCell.actorName} | ${dayNames[activeCell.day]} | ${formatTime(activeCell.time)}` : "Hover or paint a cell"}
          </div>
        </div>
        <label className="text-sm"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="mr-2" />Show inactive actors</label>
      </div>

      <details className="mb-4 rounded-lg border border-line bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium">Focus on a saved group or choose individual actors</summary>
        {state.actorGroups.length > 0 && <div className="mt-2 flex flex-wrap gap-2">
          {state.actorGroups.map((group) => <button key={group.id} onClick={() => { setSelectedGroupId(group.id); setFocused([]); }} className={`rounded border px-2 py-1 text-sm ${selectedGroupId === group.id ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>{group.name} ({group.actorIds.length})</button>)}
        </div>}
        <div className="mt-2 flex flex-wrap gap-2">
          {state.actors.map((actor) => (
            <label key={actor.id} className="rounded border border-line px-2 py-1 text-sm"><input className="mr-1" type="checkbox" checked={focused.includes(actor.id)} onChange={() => { setSelectedGroupId(""); setFocused((current) => current.includes(actor.id) ? current.filter((id) => id !== actor.id) : [...current, actor.id]); }} />{actor.name}</label>
          ))}
        </div>
      </details>

      <div className="grid-scroll max-h-[72vh] overflow-auto rounded-xl border border-line bg-white shadow-sm">
        <table className="min-w-[1280px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 border-b border-r border-line bg-panel p-2 text-left">Actor</th>
              {days.map((day) => <th key={day} colSpan={times.length} className="sticky top-0 z-20 border-b border-l border-line bg-panel p-2 text-center text-sm font-semibold">{dayNames[day]}</th>)}
            </tr>
            <tr>
              <th className="sticky left-0 top-[37px] z-30 border-b border-r border-line bg-panel p-2 text-left text-xs text-stone-600">{actors.length} actors</th>
              {days.flatMap((day) => times.map((time) => (
                <th key={`${day}-${time}`} className="sticky top-[37px] z-20 border-b border-l border-line bg-panel p-1 text-xs">
                  <div>{formatTime(time).replace(":00 ", " ")}</div>
                  <div className="mt-1 flex justify-center gap-1">
                    <button className="rounded bg-green-100 px-1 text-[10px] text-green-800" onClick={() => bulkSet(actors.map((actor) => actor.id), [day], [time], true)}>on</button>
                    <button className="rounded bg-stone-200 px-1 text-[10px] text-stone-700" onClick={() => bulkSet(actors.map((actor) => actor.id), [day], [time], false)}>off</button>
                  </div>
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {actors.map((actor) => (
              <tr key={actor.id}>
                <td className="sticky left-0 z-10 border-b border-r border-line bg-white p-2 font-medium">
                  {actor.name}
                  <div className="mt-1 flex gap-1"><button className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800" onClick={() => bulkSet([actor.id], days, times, true)}>all on</button><button className="rounded bg-stone-200 px-1.5 py-0.5 text-xs text-stone-700" onClick={() => bulkSet([actor.id], days, times, false)}>all off</button></div>
                </td>
                {days.flatMap((day) => times.map((time) => {
                  const value = getCell(actor.id, day, time);
                  return (
                    <td key={`${actor.id}-${day}-${time}`} className="border-b border-l border-line p-1">
                      <button
                        onPointerDown={(event) => { event.preventDefault(); startPaint(actor.id, day, time); }}
                        onPointerEnter={() => { setActiveCell({ actorName: actor.name, day, time }); if (painting && dragPaintMode) paintCell(actor.id, day, time, dragPaintMode); }}
                        onFocus={() => setActiveCell({ actorName: actor.name, day, time })}
                        title={`${actor.name} | ${dayNames[day]} ${formatTime(time)} | ${value ? "Available" : "Unavailable"}`}
                        className={`h-9 w-full rounded text-[11px] font-semibold transition ${value ? "bg-green-200 text-green-950 hover:bg-green-300" : "bg-stone-200 text-stone-700 hover:bg-stone-300"}`}
                      >
                        {value ? "Available" : "Unavailable"}
                      </button>
                    </td>
                  );
                }))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
