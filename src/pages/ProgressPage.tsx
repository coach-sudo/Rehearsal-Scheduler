import { useMemo, useState } from "react";
import { useAppState } from "../App";
import StatusBadge from "../components/StatusBadge";
import { getBeatProgress } from "../utils/scheduler";

export default function ProgressPage() {
  const { state, setState } = useAppState();
  const [onlyNeeds, setOnlyNeeds] = useState(false);
  const rows = useMemo(() => state.beats.map((beat) => ({ beat, progress: getBeatProgress(beat.id, state) })).filter((row) => !onlyNeeds || row.progress.status !== "Done"), [state, onlyNeeds]);
  const csv = ["Beat,Goal,Rehearsed,Remaining,Upcoming,Remaining After Schedule,Last Rehearsed,Status", ...rows.map(({ beat, progress }) => `${beat.title},${beat.targetRehearsalCount},${progress.rehearsedCount},${progress.remainingCount},${progress.scheduledUpcomingCount},${progress.remainingAfterSchedule},${progress.lastRehearsedDate ?? ""},${progress.status}`)].join("\n");
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-semibold">Progress Tracker</h2><p className="text-stone-600">Each continuous rehearsal block counts once per beat. Saved sessions and upcoming sessions stay separate.</p></div>
        <div className="flex gap-2"><label className="rounded border border-line bg-white px-3 py-2 text-sm"><input type="checkbox" checked={onlyNeeds} onChange={(event) => setOnlyNeeds(event.target.checked)} className="mr-1" />Only needing rehearsal</label><a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download="progress-report.csv" className="rounded bg-ink px-3 py-2 text-sm font-medium text-white">Export progress report</a></div>
      </div>
      <div className="overflow-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-stone-600"><tr><th className="p-3">Beat</th><th>Goal</th><th>Rehearsed</th><th>Remaining</th><th>Upcoming</th><th>After schedule</th><th>Last rehearsed</th><th>Status</th></tr></thead>
          <tbody>{rows.map(({ beat, progress }) => <tr key={beat.id} className="border-t border-line"><td className="p-3 font-medium">{beat.title}</td><td><input type="number" min={1} value={beat.targetRehearsalCount} onChange={(event) => setState((current) => ({ ...current, beats: current.beats.map((item) => item.id === beat.id ? { ...item, targetRehearsalCount: Number(event.target.value) || 1 } : item) }))} className="w-16 rounded border border-line px-2 py-1" /></td><td>{progress.rehearsedCount}/{beat.targetRehearsalCount}</td><td>{progress.remainingCount}</td><td>{progress.scheduledUpcomingCount}</td><td>{progress.remainingAfterSchedule}</td><td>{progress.lastRehearsedDate ?? "Never"}</td><td><StatusBadge tone={progress.status === "Done" ? "green" : progress.status === "In progress" ? "amber" : "gray"}>{progress.status}</StatusBadge></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
