import { useAppState } from "../App";
import StatusBadge from "../components/StatusBadge";
import { createLogEntries, getBlockConflicts } from "../utils/scheduler";
import { addDays, formatTime, dayNames, getDayOfWeek, normalizeWeekStart } from "../utils/time";
import { useState } from "react";

export default function SchedulePage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { state, setState } = useAppState();
  const weekOptions = [...new Set([...state.scheduledBlocks.map((block) => normalizeWeekStart(block.date)), ...state.scheduleLog.map((entry) => normalizeWeekStart(entry.date))])].sort();
  const [viewWeek, setViewWeek] = useState(state.settings.weekStartDate);

  function saveWeek() {
    const reviewedBlocks = state.scheduledBlocks.map((block) => ({ ...block, conflicts: getBlockConflicts(block, state) }));
    if (reviewedBlocks.some((block) => block.conflicts.length)) {
      setState((current) => ({ ...current, scheduledBlocks: reviewedBlocks }));
      window.alert("This schedule has unavailable actors or one-off conflicts. Resolve the highlighted calls before saving the week.");
      return;
    }
    const entries = createLogEntries(reviewedBlocks);
    setState((current) => {
      const existing = new Set(current.scheduleLog.map((entry) => `${entry.scheduledBlockId}|${entry.beatId}|${entry.date}|${entry.startTime}|${entry.endTime}|${entry.laneId}`));
      const newEntries = entries.filter((entry) => !existing.has(`${entry.scheduledBlockId}|${entry.beatId}|${entry.date}|${entry.startTime}|${entry.endTime}|${entry.laneId}`));
      return { ...current, scheduledBlocks: reviewedBlocks, scheduleLog: [...current.scheduleLog, ...newEntries] };
    });
  }

  function saveWeekAndDesign() {
    saveWeek();
    onNavigate?.("designer");
  }

  function closeWeekAndStartNext() {
    saveWeek();
    const nextWeek = addDays(state.settings.weekStartDate, 7);
    setState((current) => ({
      ...current,
      plannerSelections: [],
      scheduledBlocks: [],
      settings: { ...current.settings, weekStartDate: nextWeek },
    }));
    setViewWeek(nextWeek);
  }

  function namesFor(ids: string[], type: "actors" | "characters") {
    return ids
      .map((id) => type === "actors" ? state.actors.find((actor) => actor.id === id)?.name : state.characterMap.find((item) => item.actorId === id)?.characterName)
      .filter(Boolean)
      .join(", ");
  }

  function blockActorNames(block: { actorIds: string[]; blockType?: string }) {
    if (["break", "lunch", "custom"].includes(String(block.blockType))) {
      const activeIds = state.actors.filter((actor) => actor.active).map((actor) => actor.id);
      if (activeIds.length && activeIds.every((actorId) => block.actorIds.includes(actorId))) return "Company";
    }
    return namesFor(block.actorIds, "actors") || "None listed";
  }

  function exportText() {
    const sorted = [...state.scheduledBlocks].sort((a, b) => `${a.date}|${a.startTime}|${a.laneId}`.localeCompare(`${b.date}|${b.startTime}|${b.laneId}`));
    const lines = [`${state.settings.playTitle} rehearsal schedule`, `Week of ${state.settings.weekStartDate}`, ""];
    sorted.forEach((block) => {
      const beats = block.customTitle || block.beatIds.map((id) => state.beats.find((beat) => beat.id === id)?.title).filter(Boolean).join(" + ");
      const day = dayNames[getDayOfWeek(block.date)];
      if (state.settings.scheduleExportFormat === "compact") {
        lines.push(`${day} ${block.date} | ${formatTime(block.startTime)}-${formatTime(block.endTime)} | ${block.laneId} | ${beats}`);
      } else {
        lines.push(`${day}, ${block.date}`);
        lines.push(`${formatTime(block.startTime)}-${formatTime(block.endTime)} | ${block.laneId}`);
        lines.push(`Beats: ${beats}`);
      }
      if (state.settings.scheduleExportIncludeCharacters && block.beatIds.length) lines.push(`Characters: ${namesFor(block.actorIds, "characters") || "None listed"}`);
      if (state.settings.scheduleExportIncludeActors && state.settings.scheduleExportFormat !== "cast") lines.push(`Actors: ${blockActorNames(block)}`);
      if (state.settings.scheduleExportFormat === "cast") lines.push(`Call: ${blockActorNames(block)}`);
      if (state.settings.scheduleExportIncludeConflicts && block.conflicts.length) lines.push(`Conflicts: ${block.conflicts.join("; ")}`);
      lines.push("");
    });
    return lines.join("\n");
  }

  const readableSchedule = exportText();

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-semibold">Saved Schedule</h2><p className="text-stone-600">Edit this week's generated blocks, save them to progress, or review prior saved weeks.</p></div>
        <div className="flex flex-wrap gap-2">
          <select value={viewWeek} onChange={(event) => setViewWeek(event.target.value)} className="rounded border border-line bg-white px-3 py-2 text-sm">
            {[...new Set([state.settings.weekStartDate, ...weekOptions])].sort().map((week) => <option key={week} value={week}>Week of {week}</option>)}
          </select>
          <button onClick={() => onNavigate?.("designer")} className="rounded border border-line bg-white px-3 py-2 text-sm font-medium">Design printable schedule</button>
          <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(readableSchedule)}`} download={`${state.settings.playTitle || "rehearsal"}-week-schedule.txt`} className="rounded border border-line bg-white px-3 py-2 text-sm font-medium">Export readable schedule</a>
          <button onClick={() => navigator.clipboard?.writeText(readableSchedule)} className="rounded border border-line bg-white px-3 py-2 text-sm font-medium">Copy export</button>
          <button onClick={saveWeek} disabled={!state.scheduledBlocks.length} className="rounded bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Save week</button>
          <button onClick={saveWeekAndDesign} disabled={!state.scheduledBlocks.length} className="rounded bg-moss px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Save + design</button>
          <button onClick={closeWeekAndStartNext} disabled={!state.scheduledBlocks.length} className="rounded bg-sky px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Close week + start next</button>
        </div>
      </div>
      <details className="mb-5 rounded-lg border border-line bg-panel p-4">
        <summary className="cursor-pointer font-medium">Preview readable weekly export</summary>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded border border-line bg-white p-4 text-sm leading-6">{readableSchedule}</pre>
      </details>
      <div className="overflow-auto rounded-lg border border-line bg-white">
        <table className="min-w-[1050px] w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-stone-600"><tr><th className="p-3">Date</th><th>Start</th><th>End</th><th>Lane</th><th>Beats</th><th>Characters</th><th>Actors</th><th>Conflicts</th><th></th></tr></thead>
          <tbody>
            {state.scheduledBlocks.map((block) => {
              const beatTitles = block.customTitle || block.beatIds.map((id) => state.beats.find((beat) => beat.id === id)?.title).join(", ");
              const actorNames = blockActorNames(block);
              const characters = block.beatIds.length ? block.actorIds.map((id) => state.characterMap.find((item) => item.actorId === id)?.characterName || "Missing character").join(", ") : "";
              return (
                <tr key={block.id} className="border-t border-line align-top">
                  <td className="p-3"><input type="date" value={block.date} onChange={(event) => setState((current) => ({ ...current, scheduledBlocks: current.scheduledBlocks.map((item) => item.id === block.id ? { ...item, date: event.target.value } : item) }))} className="rounded border border-line px-2 py-1" /></td>
                  <td><input type="time" value={block.startTime} onChange={(event) => setState((current) => ({ ...current, scheduledBlocks: current.scheduledBlocks.map((item) => item.id === block.id ? { ...item, startTime: event.target.value } : item) }))} className="rounded border border-line px-2 py-1" /></td>
                  <td><input type="time" value={block.endTime} onChange={(event) => setState((current) => ({ ...current, scheduledBlocks: current.scheduledBlocks.map((item) => item.id === block.id ? { ...item, endTime: event.target.value } : item) }))} className="rounded border border-line px-2 py-1" /></td>
                  <td>{block.location || block.laneId}</td>
                  <td>{beatTitles}</td>
                  <td>{characters}</td>
                  <td>{actorNames}</td>
                  <td>{block.conflicts.length ? <StatusBadge tone="red">{block.conflicts.join("; ")}</StatusBadge> : <StatusBadge tone="green">clear</StatusBadge>}</td>
                  <td><button onClick={() => setState((current) => ({ ...current, scheduledBlocks: current.scheduledBlocks.filter((item) => item.id !== block.id) }))} className="text-coral">Delete</button></td>
                </tr>
              );
            })}
            {!state.scheduledBlocks.length && <tr><td className="p-5 text-stone-600" colSpan={9}>No generated blocks yet. Build a calendar from the planner.</td></tr>}
          </tbody>
        </table>
      </div>
      <h3 className="mt-8 text-lg font-semibold">Saved log for week of {viewWeek}</h3>
      <div className="mt-3 overflow-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-stone-600"><tr><th className="p-3">Date</th><th>Time</th><th>Lane</th><th>Beat</th><th>Actors</th><th>Conflicts</th></tr></thead>
          <tbody>{state.scheduleLog.filter((entry) => normalizeWeekStart(entry.date) === viewWeek).map((entry) => <tr key={entry.id} className="border-t border-line"><td className="p-3">{entry.date}</td><td>{formatTime(entry.startTime)}-{formatTime(entry.endTime)}</td><td>{entry.laneId}</td><td>{state.beats.find((beat) => beat.id === entry.beatId)?.title}</td><td>{entry.actorIds.length}</td><td>{entry.conflicts.join("; ")}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
