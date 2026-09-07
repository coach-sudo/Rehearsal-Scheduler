import { useState } from "react";
import { useAppState } from "../App";
import { id } from "../utils/time";

export default function OverridesPage() {
  const { state, setState } = useAppState();
  const [draft, setDraft] = useState<{ actorId: string; date: string; startTime: string; endTime: string; type: "unavailable" | "available"; notes: string }>({ actorId: state.actors[0]?.id ?? "", date: state.settings.weekStartDate, startTime: "16:00", endTime: "16:30", type: "unavailable", notes: "" });

  function addOverride() {
    if (!draft.actorId || !draft.date || draft.startTime >= draft.endTime) return;
    setState((current) => ({ ...current, overrides: [...current.overrides, { ...draft, id: id("override") }] }));
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Conflicts</h2>
      <p className="mt-1 text-stone-600">Add date-specific unavailable or available overrides. These are checked by the planner and saved schedule.</p>
      <div className="mt-5 rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <select value={draft.actorId} onChange={(event) => setDraft({ ...draft, actorId: event.target.value })} className="rounded border border-line px-3 py-2">{state.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select>
          <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="rounded border border-line px-3 py-2" />
          <input type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} className="rounded border border-line px-3 py-2" />
          <input type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} className="rounded border border-line px-3 py-2" />
          <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as "unavailable" | "available" })} className="rounded border border-line px-3 py-2"><option value="unavailable">Unavailable</option><option value="available">Available</option></select>
          <button onClick={addOverride} className="rounded bg-ink px-3 py-2 text-white">Add override</button>
        </div>
        <input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="mt-3 w-full rounded border border-line px-3 py-2" placeholder="Notes" />
      </div>
      <div className="mt-5 overflow-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-stone-600"><tr><th className="p-3">Date</th><th>Start</th><th>End</th><th>Actor</th><th>Type</th><th>Notes</th><th></th></tr></thead>
          <tbody>{state.overrides.map((override) => <tr key={override.id} className="border-t border-line"><td className="p-3">{override.date}</td><td>{override.startTime}</td><td>{override.endTime}</td><td>{state.actors.find((actor) => actor.id === override.actorId)?.name}</td><td>{override.type}</td><td>{override.notes}</td><td><button onClick={() => setState((current) => ({ ...current, overrides: current.overrides.filter((item) => item.id !== override.id) }))} className="text-coral">Delete</button></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
