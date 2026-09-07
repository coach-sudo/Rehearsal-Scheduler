import { useState } from "react";
import { Camera, Plus, X } from "lucide-react";
import { useAppState } from "../App";
import { id } from "../utils/time";
import { similarActors } from "../utils/casting";

export default function CastingPage() {
  const { state, setState } = useAppState();
  const [groupName, setGroupName] = useState("");
  const [selectedActorId, setSelectedActorId] = useState(state.actors[0]?.id ?? "");
  const [lineupActorIds, setLineupActorIds] = useState<string[]>([]);
  const selectedActor = state.actors.find((actor) => actor.id === selectedActorId);

  function addGroup() {
    if (!groupName.trim()) return;
    setState((current) => ({ ...current, actorGroups: [...current.actorGroups, { id: id("group"), name: groupName.trim(), actorIds: [] }] }));
    setGroupName("");
  }

  function addToLineup(actorId: string) {
    setLineupActorIds((current) => current.includes(actorId) ? current : [...current, actorId]);
  }

  function addActorToGroup(groupId: string, actorId: string) {
    setState((current) => ({
      ...current,
      actorGroups: current.actorGroups.map((group) =>
        group.id === groupId ? { ...group, actorIds: group.actorIds.includes(actorId) ? group.actorIds : [...group.actorIds, actorId] } : group
      ),
    }));
  }

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">Casting & Groups</h2>
        <p className="text-stone-600">Assign actors to roles, create manual groups, and find actors with similar availability. Actor photos are managed in Actors & Photos.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <h3 className="font-semibold">Create actor group</h3>
            <div className="mt-3 flex gap-2">
              <input value={groupName} onChange={(event) => setGroupName(event.target.value)} className="min-w-0 flex-1 rounded border border-line px-3 py-2" placeholder="Mechanicals, Court, Fight Team" />
              <button onClick={addGroup} className="rounded bg-ink px-3 text-white" title="Add group"><Plus size={18} /></button>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <h3 className="font-semibold">Similar availability</h3>
            <select value={selectedActorId} onChange={(event) => setSelectedActorId(event.target.value)} className="mt-3 w-full rounded border border-line px-3 py-2">
              {state.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
            </select>
            <div className="mt-3 space-y-2">
              {selectedActor && similarActors(selectedActor.id, state).slice(0, 6).map(({ actor, score }) => (
                <div key={actor.id} className="flex items-center justify-between rounded border border-line px-3 py-2 text-sm">
                  <span>{actor.name}</span>
                  <span className="rounded bg-panel px-2 py-0.5 text-xs font-medium">{score}% match</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-2">
            {state.actorGroups.map((group) => (
              <article
                key={group.id}
                className="rounded-xl border border-line bg-white p-4 shadow-sm"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const actorId = event.dataTransfer.getData("text/plain");
                  if (actorId) addActorToGroup(group.id, actorId);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <input value={group.name} onChange={(event) => setState((current) => ({ ...current, actorGroups: current.actorGroups.map((item) => item.id === group.id ? { ...item, name: event.target.value } : item) }))} className="min-w-0 flex-1 rounded border border-transparent text-lg font-semibold hover:border-line" />
                  <button onClick={() => setState((current) => ({ ...current, actorGroups: current.actorGroups.filter((item) => item.id !== group.id) }))} className="text-sm text-coral">Delete</button>
                </div>
                <textarea value={group.notes ?? ""} onChange={(event) => setState((current) => ({ ...current, actorGroups: current.actorGroups.map((item) => item.id === group.id ? { ...item, notes: event.target.value } : item) }))} className="mt-2 h-16 w-full rounded border border-line px-3 py-2 text-sm" placeholder="Notes for this group" />
                <div className="mt-3 grid gap-1 sm:grid-cols-2">
                  {state.actors.filter((actor) => actor.active).map((actor) => (
                    <label key={actor.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-panel">
                      <input type="checkbox" checked={group.actorIds.includes(actor.id)} onChange={() => setState((current) => ({ ...current, actorGroups: current.actorGroups.map((item) => item.id === group.id ? { ...item, actorIds: item.actorIds.includes(actor.id) ? item.actorIds.filter((id) => id !== actor.id) : [...item.actorIds, actor.id] } : item) }))} />
                      {actor.name}
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <h3 className="font-semibold">Visual casting board</h3>
            <p className="text-sm text-stone-600">Drag actors into the lineup to compare stage pictures, or drop them on a group card to add them there.</p>
            <div
              className="mt-3 min-h-36 rounded-lg border border-dashed border-line bg-panel p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const actorId = event.dataTransfer.getData("text/plain");
                if (actorId) addToLineup(actorId);
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Comparison lineup</span>
                {!!lineupActorIds.length && <button onClick={() => setLineupActorIds([])} className="text-xs text-coral">Clear</button>}
              </div>
              <div className="flex min-h-24 flex-wrap gap-3">
                {lineupActorIds.map((actorId) => {
                  const actor = state.actors.find((item) => item.id === actorId);
                  if (!actor) return null;
                  return (
                    <div key={actor.id} className="relative w-28 rounded-lg border border-line bg-white p-2 text-center shadow-sm">
                      <button onClick={() => setLineupActorIds((current) => current.filter((id) => id !== actor.id))} className="absolute right-1 top-1 rounded bg-white/90 p-0.5 text-coral"><X size={12} /></button>
                      <ActorPhoto actor={actor} size="large" />
                      <div className="mt-2 truncate text-sm font-semibold">{actor.name}</div>
                      <div className="truncate text-xs text-stone-500">{state.characterMap.find((item) => item.actorId === actor.id)?.characterName || "Uncast"}</div>
                    </div>
                  );
                })}
                {!lineupActorIds.length && <div className="grid min-h-24 flex-1 place-items-center text-sm text-stone-500">Drop actors here to compare them visually.</div>}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {state.actors.map((actor) => (
                <article
                  key={actor.id}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", actor.id)}
                  className="cursor-grab rounded-lg border border-line p-3 active:cursor-grabbing"
                >
                  <div className="flex gap-3">
                    <ActorPhoto actor={actor} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{actor.name}</div>
                      <input value={state.characterMap.find((item) => item.actorId === actor.id)?.characterName ?? ""} onChange={(event) => setState((current) => ({ ...current, characterMap: [...current.characterMap.filter((item) => item.actorId !== actor.id), { actorId: actor.id, characterName: event.target.value }] }))} className="mt-2 w-full rounded border border-line px-2 py-1 text-sm" placeholder="Role / character" />
                      <div className="mt-2 text-xs text-stone-500">{actor.photoDataUrl ? "Photo added" : "No photo yet"}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ActorPhoto({ actor, size = "normal" }: { actor: { name: string; photoDataUrl?: string }; size?: "normal" | "large" }) {
  const className = size === "large" ? "mx-auto h-24 w-24" : "h-20 w-20";
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden rounded bg-panel ${className}`}>
      {actor.photoDataUrl ? <img src={actor.photoDataUrl} alt="" className="h-full w-full object-cover" /> : <Camera className="text-stone-400" />}
    </div>
  );
}
