import { useState } from "react";
import { Camera, Plus, Search, Upload, X } from "lucide-react";
import { useAppState } from "../App";
import { id } from "../utils/time";

export default function ActorsPage() {
  const { state, setState } = useAppState();
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");
  const [query, setQuery] = useState("");
  const filtered = state.actors.filter((actor) => actor.name.toLowerCase().includes(query.toLowerCase()));

  function addActor(actorName = name) {
    if (!actorName.trim()) return;
    if (state.actors.some((actor) => actor.name.trim().toLowerCase() === actorName.trim().toLowerCase())) return;
    const actorId = id("actor");
    setState((current) => ({
      ...current,
      actors: [...current.actors, { id: actorId, name: actorName.trim(), active: true }],
      beats: current.beats.map((beat) => beat.id === "beat_all" ? { ...beat, rosterActorIds: [...new Set([...beat.rosterActorIds, actorId])] } : beat),
    }));
    setName("");
  }

  function addPastedActors() {
    const names = bulk.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (!names.length) return;
    setState((current) => {
      const existingNames = new Set(current.actors.map((actor) => actor.name.trim().toLowerCase()));
      const newActors = names
        .filter((actorName, index, list) => list.findIndex((item) => item.toLowerCase() === actorName.toLowerCase()) === index)
        .filter((actorName) => !existingNames.has(actorName.toLowerCase()))
        .map((actorName) => ({ id: id("actor"), name: actorName, active: true }));
      if (!newActors.length) return current;
      return {
        ...current,
        actors: [...current.actors, ...newActors],
        beats: current.beats.map((beat) => beat.id === "beat_all" ? { ...beat, rosterActorIds: [...new Set([...beat.rosterActorIds, ...newActors.map((actor) => actor.id)])] } : beat),
      };
    });
    setBulk("");
  }

  function removeActor(actorId: string) {
    const inUse = state.beats.some((beat) => beat.rosterActorIds.includes(actorId)) || state.scheduleLog.some((entry) => entry.actorIds.includes(actorId));
    setState((current) => ({
      ...current,
      actors: inUse ? current.actors.map((actor) => actor.id === actorId ? { ...actor, active: false } : actor) : current.actors.filter((actor) => actor.id !== actorId),
    }));
  }

  function uploadPhoto(actorId: string, file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setState((current) => ({
        ...current,
        actors: current.actors.map((actor) => actor.id === actorId ? { ...actor, photoDataUrl: String(reader.result) } : actor),
      }));
    };
    reader.readAsDataURL(file);
  }

  return (
    <section>
      <div>
        <h2 className="text-2xl font-semibold">Actors & Photos</h2>
        <p className="mt-1 text-stone-600">Enter cast names, contact details, notes, active status, and actor photos in one place.</p>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-line bg-white p-4">
          <label className="text-sm font-medium">Add actor</label>
          <form onSubmit={(event) => { event.preventDefault(); addActor(); }} className="mt-2 flex gap-2">
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded border border-line px-3 py-2" placeholder="Actor name" />
            <button disabled={!name.trim()} className="inline-flex items-center gap-2 rounded bg-ink px-3 text-sm font-medium text-white disabled:opacity-40" title="Add"><Plus size={18} /> Add</button>
          </form>
          <label className="mt-5 block text-sm font-medium">Bulk paste names</label>
          <textarea value={bulk} onChange={(event) => setBulk(event.target.value)} className="mt-2 h-36 w-full rounded border border-line px-3 py-2" placeholder="One actor per line" />
          <button onClick={addPastedActors} disabled={!bulk.trim()} className="mt-2 rounded bg-moss px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Add pasted actors</button>
        </div>
        <div className="rounded-lg border border-line bg-white">
          <div className="flex items-center gap-2 border-b border-line p-3">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full outline-none" placeholder="Search actors" />
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel text-xs uppercase text-stone-600"><tr><th className="p-3">Photo</th><th>Name</th><th>Email</th><th>Status</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {filtered.map((actor) => (
                  <tr key={actor.id} className="border-t border-line">
                    <td className="p-3 align-top">
                      <div className="flex items-center gap-2">
                        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded bg-panel">
                          {actor.photoDataUrl ? <img src={actor.photoDataUrl} alt="" className="h-full w-full object-cover" /> : <Camera size={18} className="text-stone-400" />}
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-line px-2 py-1 text-xs font-medium">
                            <Upload size={12} /> Upload
                            <input type="file" accept="image/*" onChange={(event) => uploadPhoto(actor.id, event.target.files?.[0])} className="hidden" />
                          </label>
                          {actor.photoDataUrl && <button onClick={() => setState((current) => ({ ...current, actors: current.actors.map((item) => item.id === actor.id ? { ...item, photoDataUrl: undefined } : item) }))} className="inline-flex items-center gap-1 text-xs text-coral"><X size={12} /> Remove</button>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3"><input value={actor.name} onChange={(event) => setState((current) => ({ ...current, actors: current.actors.map((item) => item.id === actor.id ? { ...item, name: event.target.value } : item) }))} className="w-full rounded border border-transparent px-2 py-1 hover:border-line" /></td>
                    <td className="p-3"><input value={actor.email ?? ""} onChange={(event) => setState((current) => ({ ...current, actors: current.actors.map((item) => item.id === actor.id ? { ...item, email: event.target.value } : item) }))} className="w-full rounded border border-transparent px-2 py-1 hover:border-line" /></td>
                    <td className="p-3"><button onClick={() => setState((current) => ({ ...current, actors: current.actors.map((item) => item.id === actor.id ? { ...item, active: !item.active } : item) }))} className="rounded border border-line px-2 py-1">{actor.active ? "Active" : "Inactive"}</button></td>
                    <td className="p-3"><input value={actor.notes ?? ""} onChange={(event) => setState((current) => ({ ...current, actors: current.actors.map((item) => item.id === actor.id ? { ...item, notes: event.target.value } : item) }))} className="w-full rounded border border-transparent px-2 py-1 hover:border-line" /></td>
                    <td className="p-3 text-right"><button onClick={() => removeActor(actor.id)} className="text-coral">{state.beats.some((beat) => beat.rosterActorIds.includes(actor.id)) || state.scheduleLog.some((entry) => entry.actorIds.includes(actor.id)) ? "Deactivate" : "Delete"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
