import { useAppState } from "../App";
import { createBlankState } from "../utils/storage";

export default function SettingsPage() {
  const { state, setState } = useAppState();
  const settings = state.settings;
  return (
    <section>
      <h2 className="text-2xl font-semibold">Settings</h2>
      <div className="mt-5 max-w-3xl rounded-lg border border-line bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium md:col-span-2">Play title<input value={settings.playTitle} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, playTitle: event.target.value } }))} className="mt-1 block w-full rounded border border-line px-3 py-2" placeholder="Production title" /></label>
          <label className="text-sm font-medium">Rehearsal start<input type="time" value={settings.rehearsalStartTime} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, rehearsalStartTime: event.target.value } }))} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
          <label className="text-sm font-medium">Rehearsal end<input type="time" value={settings.rehearsalEndTime} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, rehearsalEndTime: event.target.value } }))} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
          <label className="text-sm font-medium">Planner slot minutes<input type="number" value={settings.plannerSlotMinutes} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, plannerSlotMinutes: Number(event.target.value) } }))} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
          <label className="text-sm font-medium">Availability block minutes<input type="number" value={settings.availabilityBlockMinutes} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, availabilityBlockMinutes: Number(event.target.value) } }))} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
          <label className="text-sm font-medium">Max absences allowed<input type="number" min={0} value={settings.maxAbsencesAllowed} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, maxAbsencesAllowed: Number(event.target.value) } }))} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
          <label className="text-sm font-medium">Max parallel blocks<input type="number" min={1} max={3} value={settings.maxParallelBlocks} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, maxParallelBlocks: Number(event.target.value) } }))} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
        </div>
        <label className="mt-4 block text-sm font-medium">Lanes, comma separated<input value={settings.lanes.join(", ")} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, lanes: event.target.value.split(",").map((lane) => lane.trim()).filter(Boolean) } }))} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
        <div className="mt-6 border-t border-line pt-4">
          <h3 className="font-semibold">Weekly schedule export</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium">Default format<select value={settings.scheduleExportFormat} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, scheduleExportFormat: event.target.value as "director" | "compact" | "cast" } }))} className="mt-1 block w-full rounded border border-line px-3 py-2"><option value="director">Director rundown</option><option value="compact">Compact one-line</option><option value="cast">Cast-friendly calls</option></select></label>
            <div className="space-y-2 rounded border border-line p-3 text-sm">
              <label className="block"><input type="checkbox" checked={settings.scheduleExportIncludeActors} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, scheduleExportIncludeActors: event.target.checked } }))} className="mr-2" />Include actor names</label>
              <label className="block"><input type="checkbox" checked={settings.scheduleExportIncludeCharacters} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, scheduleExportIncludeCharacters: event.target.checked } }))} className="mr-2" />Include character names</label>
              <label className="block"><input type="checkbox" checked={settings.scheduleExportIncludeConflicts} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, scheduleExportIncludeConflicts: event.target.checked } }))} className="mr-2" />Include conflict warnings</label>
            </div>
          </div>
        </div>
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="font-semibold text-red-900">Start a new play</h3>
          <p className="mt-1 text-sm text-red-800">Clears actors, availability, beats, planner selections, schedules, logs, and overrides. Settings are reset to a blank production.</p>
          <button onClick={() => window.confirm("Clear the entire project for a new play?") && setState(createBlankState())} className="mt-3 rounded bg-coral px-3 py-2 text-sm font-medium text-white">Clear entire project</button>
        </div>
      </div>
    </section>
  );
}
