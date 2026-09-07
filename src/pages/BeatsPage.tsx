import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckSquare, Plus, Search, Trash2 } from "lucide-react";
import { useAppState } from "../App";
import { id } from "../utils/time";

export default function BeatsPage() {
  const { state, setState } = useAppState();
  const [title, setTitle] = useState("");
  const [bulk, setBulk] = useState("");
  const [query, setQuery] = useState("");
  const [selectedBeatId, setSelectedBeatId] = useState(state.beats[0]?.id ?? "beat_all");
  const selectedBeat = state.beats.find((beat) => beat.id === selectedBeatId) ?? state.beats[0];
  const actorOptions = useMemo(
    () => state.actors.filter((actor) => actor.active && actor.name.toLowerCase().includes(query.toLowerCase())),
    [query, state.actors]
  );

  function addBeat(beatTitle = title) {
    if (!beatTitle.trim()) return;
    const beat = { id: id("beat"), title: beatTitle.trim(), rosterActorIds: [], targetRehearsalCount: 3 };
    setState((current) => ({ ...current, beats: [...current.beats, beat] }));
    setSelectedBeatId(beat.id);
    setTitle("");
  }

  function updateBeat(patch: Partial<NonNullable<typeof selectedBeat>>) {
    if (!selectedBeat) return;
    setState((current) => ({ ...current, beats: current.beats.map((beat) => beat.id === selectedBeat.id ? { ...beat, ...patch } : beat) }));
  }

  function moveBeat(beatId: string, direction: -1 | 1) {
    setState((current) => {
      const index = current.beats.findIndex((beat) => beat.id === beatId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.beats.length) return current;
      const beats = [...current.beats];
      const [beat] = beats.splice(index, 1);
      beats.splice(nextIndex, 0, beat);
      return { ...current, beats };
    });
  }

  function deleteBeat(beatId: string) {
    if (beatId === "beat_all") return;
    setState((current) => ({
      ...current,
      beats: current.beats.filter((beat) => beat.id !== beatId),
      plannerSelections: current.plannerSelections.filter((selection) => selection.beatId !== beatId),
      scheduledBlocks: current.scheduledBlocks
        .map((block) => ({ ...block, beatIds: block.beatIds.filter((id) => id !== beatId) }))
        .filter((block) => block.beatIds.length || block.customTitle),
      scheduleLog: current.scheduleLog.filter((entry) => entry.beatId !== beatId),
    }));
    setSelectedBeatId((current) => current === beatId ? "beat_all" : current);
  }

  function toggleActor(actorId: string) {
    if (!selectedBeat) return;
    updateBeat({
      rosterActorIds: selectedBeat.rosterActorIds.includes(actorId)
        ? selectedBeat.rosterActorIds.filter((id) => id !== actorId)
        : [...selectedBeat.rosterActorIds, actorId],
    });
  }

  function applyGroup(actorIds: string[]) {
    if (!selectedBeat) return;
    updateBeat({ rosterActorIds: [...new Set([...selectedBeat.rosterActorIds, ...actorIds])] });
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Beats & Scenes</h2>
          <p className="text-stone-600">Break the play into rehearsal units, then assign the actors needed for the selected beat.</p>
        </div>
        <div className="rounded bg-panel px-3 py-1 text-sm text-stone-600">{state.beats.length} beats</div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <label className="text-sm font-medium">Add one beat</label>
            <div className="mt-2 flex gap-2">
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-0 flex-1 rounded border border-line px-3 py-2" placeholder="Act 1 Scene 3, Fight Call" />
              <button onClick={() => addBeat()} className="rounded bg-ink px-3 text-white" title="Add beat"><Plus size={18} /></button>
            </div>
            <label className="mt-4 block text-sm font-medium">Paste scene list</label>
            <textarea value={bulk} onChange={(event) => setBulk(event.target.value)} className="mt-2 h-24 w-full rounded border border-line px-3 py-2 text-sm" placeholder="One beat or scene per line" />
            <button onClick={() => { bulk.split(/\n/).filter(Boolean).forEach(addBeat); setBulk(""); }} className="mt-2 rounded border border-line px-3 py-2 text-sm font-medium">Create beats from lines</button>
          </div>

          <div className="rounded-xl border border-line bg-white shadow-sm">
            <div className="border-b border-line p-3">
              <div className="text-sm font-semibold">Ordered beat list</div>
              <div className="text-xs text-stone-600">Click a beat to edit its roster.</div>
            </div>
            <div className="max-h-[62vh] overflow-auto p-2">
              {state.beats.map((beat, index) => (
                <button key={beat.id} onClick={() => setSelectedBeatId(beat.id)} className={`mb-1 flex w-full items-center gap-2 rounded p-2 text-left text-sm ${selectedBeat?.id === beat.id ? "bg-ink text-white" : "hover:bg-panel"}`}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-white/20 text-xs">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{beat.title}</span>
                    <span className={`block text-xs ${selectedBeat?.id === beat.id ? "text-white/70" : "text-stone-500"}`}>{beat.rosterActorIds.length} called | goal {beat.targetRehearsalCount}x</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {selectedBeat && (
          <main className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
              <div className="min-w-0 flex-1">
                <input value={selectedBeat.title} onChange={(event) => updateBeat({ title: event.target.value })} className="w-full rounded border border-transparent text-2xl font-semibold hover:border-line" />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-600">
                  <span>{selectedBeat.rosterActorIds.length} actors called</span>
                  <span>Goal: rehearse this beat</span>
                  <input type="number" min={1} value={selectedBeat.targetRehearsalCount} onChange={(event) => updateBeat({ targetRehearsalCount: Number(event.target.value) || 1 })} className="w-16 rounded border border-line px-2 py-1" />
                  <span>time{selectedBeat.targetRehearsalCount === 1 ? "" : "s"}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => moveBeat(selectedBeat.id, -1)} className="rounded border border-line p-2" title="Move up"><ArrowUp size={15} /></button>
                <button onClick={() => moveBeat(selectedBeat.id, 1)} className="rounded border border-line p-2" title="Move down"><ArrowDown size={15} /></button>
                <button onClick={() => deleteBeat(selectedBeat.id)} disabled={selectedBeat.id === "beat_all"} className="rounded border border-line p-2 text-coral disabled:opacity-30" title="Delete beat"><Trash2 size={15} /></button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
              <section>
                <div className="mb-3 flex items-center gap-2 rounded border border-line px-3 py-2">
                  <Search size={16} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full outline-none" placeholder="Search actors to call" />
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {actorOptions.map((actor) => {
                    const checked = selectedBeat.rosterActorIds.includes(actor.id);
                    const character = state.characterMap.find((item) => item.actorId === actor.id)?.characterName;
                    return (
                      <button key={actor.id} onClick={() => toggleActor(actor.id)} className={`flex items-center gap-2 rounded border p-2 text-left text-sm ${checked ? "border-moss bg-green-50" : "border-line bg-white hover:bg-panel"}`}>
                        <CheckSquare size={16} className={checked ? "text-moss" : "text-stone-300"} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{actor.name}</span>
                          <span className="block truncate text-xs text-stone-500">{character || "No character"}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <aside className="space-y-4">
                <div className="rounded-lg border border-line p-3">
                  <div className="font-semibold">Quick add group</div>
                  <div className="mt-2 grid gap-2">
                    {state.actorGroups.map((group) => (
                      <button key={group.id} onClick={() => applyGroup(group.actorIds)} className="rounded border border-line px-3 py-2 text-left text-sm hover:bg-panel">
                        <span className="font-medium">{group.name}</span>
                        <span className="ml-2 text-xs text-stone-500">{group.actorIds.length} actors</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <div className="font-semibold">Character view</div>
                  <div className="mt-2 text-sm leading-6 text-stone-700">
                    {selectedBeat.rosterActorIds.map((actorId) => state.characterMap.find((item) => item.actorId === actorId)?.characterName || "Missing character").join(", ") || "No actors called yet."}
                  </div>
                </div>
                <label className="block text-sm font-medium">Notes<textarea value={selectedBeat.notes ?? ""} onChange={(event) => updateBeat({ notes: event.target.value })} className="mt-2 h-28 w-full rounded border border-line px-3 py-2 text-sm" placeholder="Blocking notes, goal, off-book status" /></label>
              </aside>
            </div>
          </main>
        )}
      </div>
    </section>
  );
}
