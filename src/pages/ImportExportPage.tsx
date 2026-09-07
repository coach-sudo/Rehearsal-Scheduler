import { useState } from "react";
import { useAppState } from "../App";
import { demoState } from "../data/demoData";
import type { AvailabilityColumnGuess } from "../utils/formsImport";
import { applyFormsImport, guessFormsImport } from "../utils/formsImport";
import { createBlankState, exportState, importState } from "../utils/storage";

export default function ImportExportPage() {
  const { state, setState } = useAppState();
  const [payload, setPayload] = useState("");
  const [formsCsv, setFormsCsv] = useState("");
  const [error, setError] = useState("");
  const exported = exportState(state);
  const formsGuess = formsCsv ? guessFormsImport(formsCsv, state) : null;
  const [manualMapping, setManualMapping] = useState<{ nameColumn: string; emailColumn: string; roleColumn: string; availabilityColumns: AvailabilityColumnGuess[] } | null>(null);
  const activeMapping = manualMapping ?? (formsGuess ? {
    nameColumn: formsGuess.nameColumn,
    emailColumn: formsGuess.emailColumn,
    roleColumn: formsGuess.roleColumn,
    availabilityColumns: formsGuess.availabilityColumns,
  } : null);

  function uploadFormsCsv(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFormsCsv(String(reader.result));
      setManualMapping(null);
    };
    reader.readAsText(file);
  }

  function updateMapping(patch: Partial<NonNullable<typeof activeMapping>>) {
    if (!formsGuess) return;
    setManualMapping({ ...(activeMapping ?? { nameColumn: "", emailColumn: "", roleColumn: "", availabilityColumns: [] }), ...patch });
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Import / Export</h2>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-4">
          <h3 className="font-semibold">Export Project JSON</h3>
          <textarea readOnly value={exported} className="mt-3 h-80 w-full rounded border border-line bg-panel p-3 font-mono text-xs" />
          <a href={`data:application/json;charset=utf-8,${encodeURIComponent(exported)}`} download="rehearsal-scheduler-backup.json" className="mt-3 inline-block rounded bg-ink px-3 py-2 text-sm font-medium text-white">Download JSON</a>
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <h3 className="font-semibold">Import Project JSON</h3>
          <textarea value={payload} onChange={(event) => setPayload(event.target.value)} className="mt-3 h-56 w-full rounded border border-line p-3 font-mono text-xs" placeholder="Paste exported JSON" />
          {error && <div className="mt-2 text-sm text-coral">{error}</div>}
          <div className="mt-3 flex gap-2">
            <button onClick={() => { try { setState(importState(payload)); setError(""); } catch { setError("Could not parse that JSON."); } }} className="rounded bg-moss px-3 py-2 text-sm font-medium text-white">Import JSON</button>
            <button onClick={() => setState(demoState)} className="rounded border border-line px-3 py-2 text-sm">Reset Demo Data</button>
            <button onClick={() => window.confirm("Clear the entire project for a new play?") && setState(createBlankState())} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">Clear for new play</button>
          </div>
          <div className="mt-6 border-t border-line pt-4">
            <h3 className="font-semibold">Google Forms availability import</h3>
            <p className="mt-1 text-sm text-stone-600">Upload a Google Forms CSV, or paste a copied Google Sheets range. The app reads both comma- and tab-separated data, then suggests name, email, role, and availability fields.</p>
            <label className="mt-3 inline-block cursor-pointer rounded border border-line bg-white px-3 py-2 text-sm font-medium">
              Upload Forms CSV
              <input type="file" accept=".csv,text/csv" onChange={(event) => uploadFormsCsv(event.target.files?.[0])} className="hidden" />
            </label>
            <textarea value={formsCsv} onChange={(event) => { setFormsCsv(event.target.value); setManualMapping(null); }} className="mt-3 h-52 w-full rounded border border-line p-3 font-mono text-xs" placeholder={'Paste Google Forms CSV or a copied Google Sheets range here. Example headers: "Name","Email","Role","Monday 3:00-3:30","Tuesday 4 PM"'} />
            {formsGuess && activeMapping && (
              <div className="mt-4 rounded-lg border border-line bg-panel p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">Detected {formsGuess.rows.length} responses</div>
                    <div className="text-sm text-stone-600">{activeMapping.availabilityColumns.length} availability questions recognized</div>
                  </div>
                  <button
                    onClick={() => setState((current) => applyFormsImport(formsCsv, current, activeMapping))}
                    disabled={!activeMapping.nameColumn || !activeMapping.availabilityColumns.length}
                    className="rounded bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                  >
                    Apply import
                  </button>
                </div>
                {!!formsGuess.warnings.length && <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">{formsGuess.warnings.join(" ")}</div>}
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <FieldPicker label="Actor name column" value={activeMapping.nameColumn} headers={formsGuess.headers} onChange={(value) => updateMapping({ nameColumn: value })} />
                  <FieldPicker label="Email column" value={activeMapping.emailColumn} headers={formsGuess.headers} optional onChange={(value) => updateMapping({ emailColumn: value })} />
                  <FieldPicker label="Role column" value={activeMapping.roleColumn} headers={formsGuess.headers} optional onChange={(value) => updateMapping({ roleColumn: value })} />
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium">Review recognized availability questions</summary>
                  <div className="mt-2 max-h-56 overflow-auto rounded border border-line bg-white">
                    {formsGuess.availabilityColumns.map((column) => {
                      const included = activeMapping.availabilityColumns.some((item) => item.header === column.header);
                      const detectedLabel = column.fromCellValues
                        ? column.dayOfWeek === undefined
                          ? "Reads day/time from answers"
                          : `Reads times from answers for day ${column.dayOfWeek}`
                        : `Day ${column.dayOfWeek}, ${column.startTime}-${column.endTime}`;
                      return (
                        <label key={column.header} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-sm last:border-b-0">
                          <span><input type="checkbox" checked={included} onChange={() => updateMapping({ availabilityColumns: included ? activeMapping.availabilityColumns.filter((item) => item.header !== column.header) : [...activeMapping.availabilityColumns, column] })} className="mr-2" />{column.header}</span>
                          <span className="shrink-0 text-xs text-stone-500">{detectedLabel}</span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FieldPicker({ label, value, headers, optional, onChange }: { label: string; value: string; headers: string[]; optional?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-medium">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded border border-line bg-white px-3 py-2">
        {optional && <option value="">Do not import</option>}
        {headers.map((header) => <option key={header} value={header}>{header}</option>)}
      </select>
    </label>
  );
}
