import { useEffect, useState } from "react";
import { Download, Grid3X3, Printer, Upload } from "lucide-react";
import { useAppState } from "../App";
import type { AppState, BlockStyle, CustomBlockLayout, FontPairing, HeaderStyle, PaperSize, PrintOrientation, PrintSpacing, ScheduledBlock, ScheduleDesignCell, ScheduleDesignPlaceholder, ScheduleDesignSettings, ScheduleTemplate, ScheduleTextAlign } from "../types";
import { actorNames, beatTitles, blockTypeColor, characterNames, dayLabel, durationLabel, fontPairings, formatScheduleTime, iconForBlock, scheduleExportHtml, scheduleTemplates, sortedBlocks } from "../utils/scheduleDesign";
import { getTimeSlots, getWeekDates, id, timeToMinutes } from "../utils/time";

const blockStyles: Array<{ id: BlockStyle; label: string }> = [
  { id: "rounded", label: "Rounded cards" },
  { id: "sharp", label: "Sharp blocks" },
  { id: "sticky", label: "Sticky notes" },
  { id: "outline", label: "Outline only" },
  { id: "filled", label: "Filled color" },
  { id: "minimal", label: "Minimal lines" },
];

const headerStyles: Array<{ id: HeaderStyle; label: string }> = [
  { id: "simple", label: "Simple text" },
  { id: "marquee", label: "Theater marquee" },
  { id: "callsheet", label: "Film call sheet" },
  { id: "banner", label: "Logo banner" },
  { id: "divider", label: "Line divider" },
  { id: "ribbon", label: "Colored ribbon" },
];

const placeholderTools: Array<{ id: ScheduleDesignPlaceholder; label: string; width: number; height: number }> = [
  { id: "playTitle", label: "Play title", width: 34, height: 10 },
  { id: "week", label: "Week", width: 22, height: 8 },
  { id: "scheduleTable", label: "Schedule table", width: 58, height: 42 },
  { id: "castList", label: "Cast list", width: 30, height: 22 },
  { id: "directorNotes", label: "Notes", width: 30, height: 16 },
  { id: "emergencyContact", label: "Emergency", width: 26, height: 10 },
  { id: "footerText", label: "Footer", width: 30, height: 8 },
  { id: "date", label: "Date", width: 20, height: 8 },
  { id: "time", label: "Time", width: 20, height: 8 },
  { id: "beat", label: "Beat", width: 26, height: 10 },
  { id: "room", label: "Room", width: 18, height: 8 },
  { id: "actors", label: "Actors", width: 30, height: 16 },
  { id: "characters", label: "Characters", width: 30, height: 16 },
];

const customStarterCells: Array<Omit<ScheduleDesignCell, "id" | "backgroundColor" | "textColor">> = [
  { placeholder: "playTitle", label: "Play title", x: 4, y: 5, width: 40, height: 9, page: 1, fontSize: 26, bold: true },
  { placeholder: "week", label: "Week", x: 48, y: 6, width: 24, height: 7, page: 1, fontSize: 13, bold: true },
  { placeholder: "emergencyContact", label: "Contact", x: 74, y: 6, width: 22, height: 7, page: 1, fontSize: 11, bold: false },
  { placeholder: "scheduleTable", label: "Weekly schedule", x: 4, y: 18, width: 64, height: 66, page: 1, fontSize: 9, bold: false },
  { placeholder: "castList", label: "Cast called", x: 70, y: 18, width: 26, height: 30, page: 1, fontSize: 11, bold: false },
  { placeholder: "directorNotes", label: "Director notes", x: 70, y: 51, width: 26, height: 22, page: 1, fontSize: 11, bold: false },
  { placeholder: "footerText", label: "Footer", x: 4, y: 88, width: 92, height: 6, page: 1, fontSize: 10, bold: false },
];

const landscapeStarterCells: Array<Omit<ScheduleDesignCell, "id" | "backgroundColor" | "textColor">> = [
  { placeholder: "playTitle", label: "Play title", x: 4, y: 5, width: 36, height: 8, page: 1, fontSize: 24, bold: true },
  { placeholder: "week", label: "Week", x: 42, y: 6, width: 22, height: 6, page: 1, fontSize: 12, bold: true },
  { placeholder: "emergencyContact", label: "Contact", x: 68, y: 6, width: 28, height: 6, page: 1, fontSize: 10, bold: false },
  { placeholder: "scheduleTable", label: "Weekly schedule", x: 4, y: 16, width: 92, height: 68, page: 1, fontSize: 8, bold: false },
  { placeholder: "directorNotes", label: "Notes", x: 4, y: 86, width: 44, height: 7, page: 1, fontSize: 9, bold: false },
  { placeholder: "footerText", label: "Footer", x: 52, y: 86, width: 44, height: 7, page: 1, fontSize: 9, bold: false },
];

function buildStarterCells(design: ScheduleDesignSettings, includeScheduleTable = true) {
  const cells = design.orientation === "landscape" ? landscapeStarterCells : customStarterCells;
  return cells.filter((cell) => includeScheduleTable || cell.placeholder !== "scheduleTable").map((cell) => ({
    id: id("cell"),
    ...cell,
    backgroundColor: cell.placeholder === "scheduleTable" ? "rgba(255,255,255,.96)" : "rgba(255,255,255,.9)",
    textColor: design.primaryColor,
  }));
}

function customStyleForMode(mode: ScheduleDesignSettings["renderMode"]): ScheduleDesignSettings["customScheduleStyle"] {
  if (mode === "beatCardsByDay" || mode === "runOfDayStrip") return "cards";
  if (mode === "horizontalTimeline") return "timeline";
  return "table";
}

export default function ScheduleDesignerPage() {
  const { state, setState } = useAppState();
  const [designerTab, setDesignerTab] = useState<"format" | "content" | "words" | "print">("format");
  const design = state.settings.scheduleDesign;
  const activeTemplate = scheduleTemplates.find((template) => template.id === design.template) ?? scheduleTemplates[0];
  const displayFormatName = activeTemplate.label;
  const displayReadPath = activeTemplate.readPath;
  const printableState = {
    ...state,
    settings: {
      ...state.settings,
      scheduleDesign: { ...design, customLayoutEnabled: false },
    },
  };
  const templateHtml = scheduleExportHtml(printableState);
  const html = scheduleExportHtml(state);
  const downloadUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  const designerTabs = [
    { id: "format", label: "Format" },
    { id: "content", label: "Content" },
    { id: "words", label: "Words" },
    { id: "print", label: "Print" },
  ] as const;

  function updateDesign(patch: Partial<typeof design>) {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        scheduleDesign: { ...current.settings.scheduleDesign, ...patch },
      },
    }));
  }

  function updateSettings(patch: Partial<AppState["settings"]>) {
    setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }

  function applyTemplate(templateId: ScheduleTemplate) {
    const template = scheduleTemplates.find((item) => item.id === templateId);
    if (!template) return;
    const blockCount = state.scheduledBlocks.length;
    const compactDensity = blockCount > 18 ? 34 : blockCount > 12 ? 38 : blockCount > 7 ? Math.max(40, Math.min(template.density, 48)) : template.density;
    updateDesign({
      template: template.id,
      renderMode: template.renderMode,
      primaryColor: template.primary,
      accentColor: template.accent,
      blockStyle: template.block,
      headerStyle: template.header,
      layout: template.layout,
      orientation: template.orientation,
      spacing: blockCount > 10 ? "compact" : template.spacing,
      density: compactDensity,
      fontPairing: template.fontPairing,
      customDesignName: design.customDesignName || "My schedule format",
      showActorNames: template.showActorNames,
      showCharacterNames: template.showCharacterNames,
      showRoom: template.showRoom,
      showLaneNames: template.showRoom,
      showConflicts: template.showConflicts,
      showNotes: template.showNotes,
      showIcons: template.showIcons,
      showDurations: template.showDurations,
      showRehearsalNumbers: template.showRehearsalNumbers,
      paperSize: "letter",
      customPageCount: 1,
      paginationMode: "preferOnePage",
      customLayoutEnabled: false,
      customShowBlockCards: true,
      customCanvasZoom: 100,
      customScheduleStyle: customStyleForMode(template.renderMode),
      customBlockLayouts: {},
      customCells: [],
      timeTextAlign: "left",
      workTextAlign: "left",
      actorTextAlign: "left",
      boldTimes: true,
      boldWork: true,
      boldActorNames: false,
      cardTimePlacement: "top",
    });
  }

  function enableCustomLayout(enabled: boolean) {
    setState((current) => {
      const existingCells = current.settings.scheduleDesign.customCells;
      const nextDesign = {
        ...current.settings.scheduleDesign,
        customLayoutEnabled: enabled,
        customDesignName: current.settings.scheduleDesign.customDesignName || "My schedule format",
        customShowBlockCards: false,
        customScheduleStyle: current.settings.scheduleDesign.customScheduleStyle ?? customStyleForMode(current.settings.scheduleDesign.renderMode),
        customBlockLayouts: enabled
          ? Object.fromEntries(sortedBlocks(current.scheduledBlocks).map((block) => [block.id, templateAwareLayout(block, current, current.settings.scheduleDesign.customPageCount, "dateLane")]))
          : current.settings.scheduleDesign.customBlockLayouts,
        customCells: enabled && existingCells.length === 0 ? buildStarterCells(current.settings.scheduleDesign) : existingCells,
      };
      return { ...current, settings: { ...current.settings, scheduleDesign: nextDesign } };
    });
  }

  function startCustomDesign() {
    setState((current) => {
      const currentDesign = current.settings.scheduleDesign;
      const customBase = { ...currentDesign, orientation: "portrait" as const, renderMode: "denseTable" as const };
      return {
        ...current,
        settings: {
          ...current.settings,
          scheduleDesign: {
            ...currentDesign,
            template: "custom",
            customDesignName: currentDesign.customDesignName || "My schedule format",
            renderMode: "denseTable",
            layout: "table",
            blockStyle: "outline",
            headerStyle: "divider",
            paperSize: "letter",
            orientation: "portrait",
            spacing: "compact",
            density: Math.min(currentDesign.density, 44),
            customPageCount: 1,
            paginationMode: "preferOnePage",
            customLayoutEnabled: true,
            customCanvasZoom: 100,
            customShowBlockCards: false,
            customScheduleStyle: "table",
            customBlockLayouts: Object.fromEntries(sortedBlocks(current.scheduledBlocks).map((block) => [block.id, templateAwareLayout(block, current, 1, "dateLane")])),
            customCells: buildStarterCells(customBase),
          },
        },
      };
    });
  }

  function uploadLogo(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateDesign({ logoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  function printDesignedSchedule() {
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  function autoFitCleanly() {
    const blockCount = state.scheduledBlocks.length;
    const useTwoPages = design.paginationMode === "forceTwoPages";
    const landscapeTemplate = design.renderMode === "beatCardsByDay" || design.renderMode === "weeklyGrid";
    updateDesign({
      customLayoutEnabled: false,
      customBlockLayouts: {},
      paginationMode: useTwoPages ? "forceTwoPages" : "preferOnePage",
      paperSize: "letter",
      orientation: landscapeTemplate ? "landscape" : activeTemplate.orientation,
      spacing: blockCount > 10 ? "compact" : "comfortable",
      minimumTextSize: blockCount > 18 ? 9 : blockCount > 12 ? 10 : 11,
      density: blockCount > 18 ? 42 : blockCount > 10 ? 48 : Math.max(52, activeTemplate.density),
    });
  }

  return (
    <section>
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-line bg-[#eef0ea]/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Schedule Designer</h2>
            <p className="text-sm text-stone-600">{displayFormatName}: {displayReadPath}</p>
            <p className="text-xs text-stone-500">Your design saves automatically and is reused for future weeks.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={printDesignedSchedule} className="inline-flex items-center gap-2 rounded bg-ink px-3 py-2 text-sm font-medium text-white"><Printer size={16} /> Print / Save PDF</button>
            <a href={downloadUrl} download={`${state.settings.playTitle || "rehearsal"}-designed-schedule.html`} className="inline-flex items-center gap-2 rounded border border-line bg-white px-3 py-2 text-sm font-medium"><Download size={16} /> Export HTML</a>
          </div>
        </div>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[430px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="sticky top-[88px] z-10 rounded-xl border border-line bg-white p-2 shadow-sm">
            <div className="grid grid-cols-4 gap-1">
              {designerTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDesignerTab(tab.id)}
                  className={`rounded px-2 py-2 text-xs font-semibold transition ${designerTab === tab.id ? "bg-ink text-white" : "bg-panel text-stone-700 hover:bg-white"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          <section hidden={designerTab !== "format"} className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Choose schedule format</h3>
                <p className="text-sm text-stone-600">Choose how actors will read the week.</p>
              </div>
              <span className="rounded bg-panel px-2 py-1 text-xs text-stone-600">Letter-first</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {scheduleTemplates.map((template) => (
                <button key={template.id} onClick={() => applyTemplate(template.id)} className={`rounded-lg border p-3 text-left transition ${design.template === template.id ? "border-ink bg-ink text-white shadow-sm" : "border-line bg-white hover:bg-panel"}`}>
                  <span className="block font-semibold">{template.label}</span>
                  <span className={`mt-1 block text-xs ${design.template === template.id ? "text-white/75" : "text-stone-600"}`}>{template.purpose}</span>
                  <span className={`mt-2 inline-block rounded px-2 py-0.5 text-[11px] ${design.template === template.id ? "bg-white/15" : "bg-panel"}`}>{template.readPath}</span>
                </button>
              ))}
            </div>
          </section>

          <section hidden={designerTab !== "content"} className="grid gap-3 md:grid-cols-2">
            <Panel title="Fast Tweaks">
              <label className="block text-sm font-medium">Density <span className="text-stone-500">{design.density}</span><input type="range" min={10} max={100} value={design.density} onChange={(event) => updateDesign({ density: Number(event.target.value) })} className="mt-2 w-full" /></label>
              <label className="mt-3 block text-sm font-medium">Font<select value={design.fontPairing} onChange={(event) => updateDesign({ fontPairing: event.target.value as FontPairing })} className="mt-1 block w-full rounded border border-line px-3 py-2">{Object.entries(fontPairings).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}</select></label>
              <label className="mt-3 block text-sm font-medium">Block style<select value={design.blockStyle} onChange={(event) => updateDesign({ blockStyle: event.target.value as BlockStyle })} className="mt-1 block w-full rounded border border-line px-3 py-2">{blockStyles.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
              {design.template === "beatCardsByDay" && <label className="mt-3 block text-sm font-medium">Time placement<select value={design.cardTimePlacement} onChange={(event) => updateDesign({ cardTimePlacement: event.target.value as ScheduleDesignSettings["cardTimePlacement"] })} className="mt-1 block w-full rounded border border-line px-3 py-2"><option value="top">Above the work</option><option value="leftRail">Left side rail</option></select></label>}
            </Panel>

            <Panel title="Colors">
              <ColorInput label="Primary" value={design.primaryColor} onChange={(value) => updateDesign({ primaryColor: value })} />
              <ColorInput label="Accent" value={design.accentColor} onChange={(value) => updateDesign({ accentColor: value })} />
              <label className="mt-3 block text-sm"><input type="checkbox" checked={design.useRehearsalTypeColors} onChange={(event) => updateDesign({ useRehearsalTypeColors: event.target.checked })} className="mr-2" />Type colors</label>
            </Panel>

            <Panel title="Text hierarchy" className="md:col-span-2">
              <p className="mb-3 text-sm text-stone-600">Choose the emphasis and alignment for every card or grid block. Changes appear in the preview immediately.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextStyleControl label="Times" align={design.timeTextAlign} bold={design.boldTimes} onAlignChange={(timeTextAlign) => updateDesign({ timeTextAlign })} onBoldChange={(boldTimes) => updateDesign({ boldTimes })} />
                <TextStyleControl label="Work / beat" align={design.workTextAlign} bold={design.boldWork} onAlignChange={(workTextAlign) => updateDesign({ workTextAlign })} onBoldChange={(boldWork) => updateDesign({ boldWork })} />
                <TextStyleControl label="Actor names" align={design.actorTextAlign} bold={design.boldActorNames} onAlignChange={(actorTextAlign) => updateDesign({ actorTextAlign })} onBoldChange={(boldActorNames) => updateDesign({ boldActorNames })} />
              </div>
            </Panel>
          </section>

          <Panel title="Words on the Schedule" hidden={designerTab !== "words"}>
            <label className="block text-sm font-medium">Production title<input value={state.settings.playTitle} onChange={(event) => updateSettings({ playTitle: event.target.value })} className="mt-1 block w-full rounded border border-line px-3 py-2" placeholder="Production title" /></label>
            <label className="mt-3 block text-sm font-medium">Small header label<input value={design.headerLabel} onChange={(event) => updateDesign({ headerLabel: event.target.value })} className="mt-1 block w-full rounded border border-line px-3 py-2" placeholder="Weekly Rehearsal Schedule" /></label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-medium">Week label<input value={design.weekLabel} onChange={(event) => updateDesign({ weekLabel: event.target.value })} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
              <label className="text-sm font-medium">Called label<input value={design.calledLabel} onChange={(event) => updateDesign({ calledLabel: event.target.value })} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
              <label className="text-sm font-medium">Time label<input value={design.timeLabel} onChange={(event) => updateDesign({ timeLabel: event.target.value })} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
              <label className="text-sm font-medium">Work label<input value={design.workLabel} onChange={(event) => updateDesign({ workLabel: event.target.value })} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
              <label className="text-sm font-medium">Room label<input value={design.roomLabel} onChange={(event) => updateDesign({ roomLabel: event.target.value })} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
              <label className="text-sm font-medium">Actor label<input value={design.actorsLabel} onChange={(event) => updateDesign({ actorsLabel: event.target.value })} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
              <label className="text-sm font-medium">Character label<input value={design.charactersLabel} onChange={(event) => updateDesign({ charactersLabel: event.target.value })} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
              <label className="text-sm font-medium">Conflict label<input value={design.conflictsLabel} onChange={(event) => updateDesign({ conflictsLabel: event.target.value })} className="mt-1 block w-full rounded border border-line px-3 py-2" /></label>
            </div>
            <label className="mt-3 block text-sm font-medium">Rehearsal notes<textarea value={design.rehearsalNotes} onChange={(event) => updateDesign({ rehearsalNotes: event.target.value })} className="mt-1 h-16 w-full rounded border border-line px-3 py-2" /></label>
          </Panel>

          <details open hidden={designerTab !== "content"} className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <summary className="cursor-pointer font-semibold">Details shown on schedule</summary>
            <div className="mt-3 grid gap-x-4 sm:grid-cols-2">
              <Toggle label="Actor names" checked={design.showActorNames} onChange={(checked) => updateDesign({ showActorNames: checked })} />
              <Toggle label="Character names" checked={design.showCharacterNames} onChange={(checked) => updateDesign({ showCharacterNames: checked })} />
              <Toggle label="Room / lane" checked={design.showRoom} onChange={(checked) => updateDesign({ showRoom: checked, showLaneNames: checked })} />
              <Toggle label="Conflicts" checked={design.showConflicts} onChange={(checked) => updateDesign({ showConflicts: checked })} />
              <Toggle label="Notes" checked={design.showNotes} onChange={(checked) => updateDesign({ showNotes: checked })} />
              <Toggle label="Icons" checked={design.showIcons} onChange={(checked) => updateDesign({ showIcons: checked })} />
              <Toggle label="Durations" checked={design.showDurations} onChange={(checked) => updateDesign({ showDurations: checked })} />
              <Toggle label="Rehearsal numbers" checked={design.showRehearsalNumbers} onChange={(checked) => updateDesign({ showRehearsalNumbers: checked })} />
            </div>
          </details>

          <details open hidden={designerTab !== "print"} className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <summary className="cursor-pointer font-semibold">Branding and print controls</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium">Header style<select value={design.headerStyle} onChange={(event) => updateDesign({ headerStyle: event.target.value as HeaderStyle })} className="mt-1 block w-full rounded border border-line px-3 py-2">{headerStyles.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
              <label className="text-sm font-medium">Paper<select value={design.paperSize} onChange={(event) => updateDesign({ paperSize: event.target.value as PaperSize })} className="mt-1 block w-full rounded border border-line px-3 py-2"><option value="letter">Letter</option><option value="legal">Legal</option><option value="a4">A4</option></select></label>
              <label className="text-sm font-medium">Orientation<select value={design.orientation} onChange={(event) => updateDesign({ orientation: event.target.value as PrintOrientation })} className="mt-1 block w-full rounded border border-line px-3 py-2"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
              <label className="text-sm font-medium">Spacing<select value={design.spacing} onChange={(event) => updateDesign({ spacing: event.target.value as PrintSpacing })} className="mt-1 block w-full rounded border border-line px-3 py-2"><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="large">Large print</option></select></label>
              <label className="text-sm font-medium">Page fit<select value={design.paginationMode} onChange={(event) => updateDesign({ paginationMode: event.target.value as ScheduleDesignSettings["paginationMode"], customPageCount: event.target.value === "forceTwoPages" ? 2 : 1, customLayoutEnabled: false, customBlockLayouts: {}, customCells: [] })} className="mt-1 block w-full rounded border border-line px-3 py-2"><option value="preferOnePage">One-page auto-fit</option><option value="readableAuto">Readable one page</option><option value="forceTwoPages">Use two pages</option></select></label>
              <label className="text-sm font-medium">Minimum text size <span className="text-stone-500">{design.minimumTextSize}px</span><input type="range" min={9} max={16} value={design.minimumTextSize} onChange={(event) => updateDesign({ minimumTextSize: Number(event.target.value) })} className="mt-2 block w-full" /></label>
              <button onClick={autoFitCleanly} className="mt-6 rounded border border-line bg-white px-3 py-2 text-sm font-medium">Auto-fit cleanly</button>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 rounded border border-line bg-white px-3 py-2 text-sm font-medium"><Upload size={16} /> Upload production logo<input type="file" accept="image/*" onChange={(event) => uploadLogo(event.target.files?.[0])} className="hidden" /></label>
            {design.logoDataUrl && <button onClick={() => updateDesign({ logoDataUrl: undefined })} className="mt-2 text-sm text-coral">Remove logo</button>}
            <label className="mt-3 block text-sm font-medium">Emergency contact<input value={design.emergencyContact} onChange={(event) => updateDesign({ emergencyContact: event.target.value })} className="mt-1 w-full rounded border border-line px-3 py-2" /></label>
            <label className="mt-3 block text-sm font-medium">Footer text<input value={design.footerText} onChange={(event) => updateDesign({ footerText: event.target.value })} className="mt-1 w-full rounded border border-line px-3 py-2" /></label>
          </details>

        </aside>

        <div className="min-h-[calc(100vh-150px)] rounded-xl border border-line bg-[#dfe4dd] p-3 shadow-inner lg:p-4">
          <iframe key={templateHtml} title="Designed schedule preview" srcDoc={templateHtml} className="h-[calc(100vh-170px)] min-h-[720px] w-full rounded-lg border border-line bg-white shadow-2xl" />
        </div>
      </div>
    </section>
  );
}

function CustomLayoutEditor() {
  const { state, setState } = useAppState();
  const design = state.settings.scheduleDesign;
  const blocks = sortedBlocks(state.scheduledBlocks);
  const [dragging, setDragging] = useState<{ kind: "block" | "cell"; id: string; mode: "move" | "resize"; page: 1 | 2 } | null>(null);
  const [selected, setSelected] = useState<{ kind: "block" | "cell"; id: string } | null>(() => {
    const scheduleCell = design.customCells.find((cell) => cell.placeholder === "scheduleTable");
    return scheduleCell ? { kind: "cell", id: scheduleCell.id } : null;
  });
  const pageCount = design.paginationMode === "forceTwoPages" ? 2 : design.customPageCount;
  const selectedCell = selected?.kind === "cell" ? design.customCells.find((cell) => cell.id === selected.id) : undefined;
  const selectedBlock = selected?.kind === "block" ? blocks.find((block) => block.id === selected.id) : undefined;
  const selectedBlockLayout = selectedBlock ? design.customBlockLayouts[selectedBlock.id] ?? templateAwareLayout(selectedBlock, state, pageCount, "dateLane") : undefined;
  const fonts = fontPairings[design.fontPairing];
  const isDark = design.renderMode === "digitalDisplay" || design.template === "digital";
  const pagePadding = design.spacing === "compact" ? "p-4" : design.spacing === "large" ? "p-8" : "p-6";
  const pageMaxWidth = design.orientation === "landscape" ? "max-w-6xl" : "max-w-3xl";
  const canvasBackground = design.snapToGrid
    ? "linear-gradient(to right, rgba(23,33,31,.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(23,33,31,.07) 1px, transparent 1px)"
    : "none";
  const canvasZoom = design.customCanvasZoom ?? 100;

  useEffect(() => {
    const selectionExists =
      selected?.kind === "cell"
        ? design.customCells.some((cell) => cell.id === selected.id)
        : selected?.kind === "block"
          ? blocks.some((block) => block.id === selected.id)
          : false;
    if (selectionExists) return;
    const scheduleCell = design.customCells.find((cell) => cell.placeholder === "scheduleTable");
    if (scheduleCell) setSelected({ kind: "cell", id: scheduleCell.id });
  }, [blocks, design.customCells, selected]);

  function updateLayout(block: ScheduledBlock, page: 1 | 2, patch: Partial<CustomBlockLayout>) {
    setState((current) => {
      const existing = current.settings.scheduleDesign.customBlockLayouts[block.id] ?? templateAwareLayout(block, current, current.settings.scheduleDesign.customPageCount, "dateLane");
      const next = { ...existing, page, ...patch };
      return {
        ...current,
        settings: {
          ...current.settings,
          scheduleDesign: {
            ...current.settings.scheduleDesign,
            customBlockLayouts: {
              ...current.settings.scheduleDesign.customBlockLayouts,
              [block.id]: clampLayout(next, current.settings.scheduleDesign.snapToGrid),
            },
          },
        },
      };
    });
  }

  function addCell(tool: (typeof placeholderTools)[number], page: 1 | 2 = 1) {
    const nextCell: ScheduleDesignCell = {
      id: id("cell"),
      placeholder: tool.id,
      label: tool.label,
      x: 4,
      y: 4,
      width: tool.width,
      height: tool.height,
      page,
      backgroundColor: tool.id === "scheduleTable" ? "rgba(255,255,255,.94)" : "rgba(255,255,255,.86)",
      textColor: design.primaryColor,
      fontSize: tool.id === "playTitle" ? 22 : tool.id === "scheduleTable" ? 9 : 12,
      bold: ["playTitle", "week", "date", "time", "beat"].includes(tool.id),
    };
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        scheduleDesign: {
          ...current.settings.scheduleDesign,
          customCells: [...current.settings.scheduleDesign.customCells, nextCell],
        },
      },
    }));
    setSelected({ kind: "cell", id: nextCell.id });
  }

  function updateCell(cell: ScheduleDesignCell, page: 1 | 2, patch: Partial<CustomBlockLayout>) {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        scheduleDesign: {
          ...current.settings.scheduleDesign,
          customCells: current.settings.scheduleDesign.customCells.map((item) =>
            item.id === cell.id ? { ...item, ...clampLayout({ ...item, page, ...patch }, current.settings.scheduleDesign.snapToGrid) } : item
          ),
        },
      },
    }));
  }

  function updateDesignPatch(patch: Partial<ScheduleDesignSettings>) {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        scheduleDesign: {
          ...current.settings.scheduleDesign,
          ...patch,
        },
      },
    }));
  }

  function updateCellStyle(cellId: string, patch: Partial<ScheduleDesignCell>) {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        scheduleDesign: {
          ...current.settings.scheduleDesign,
          customCells: current.settings.scheduleDesign.customCells.map((cell) => cell.id === cellId ? { ...cell, ...patch } : cell),
        },
      },
    }));
  }

  function duplicateCell(cell: ScheduleDesignCell) {
    const nextCell = {
      ...cell,
      id: id("cell"),
      x: clamp(cell.x + 3, 0, 100 - cell.width),
      y: clamp(cell.y + 3, 0, 100 - cell.height),
    };
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        scheduleDesign: {
          ...current.settings.scheduleDesign,
          customCells: [...current.settings.scheduleDesign.customCells, nextCell],
        },
      },
    }));
    setSelected({ kind: "cell", id: nextCell.id });
  }

  function deleteCell(cellId: string) {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        scheduleDesign: {
          ...current.settings.scheduleDesign,
          customCells: current.settings.scheduleDesign.customCells.filter((cell) => cell.id !== cellId),
        },
      },
    }));
    if (selected?.kind === "cell" && selected.id === cellId) setSelected(null);
  }

  function moveSelected(patch: Partial<CustomBlockLayout>) {
    if (selectedCell) updateCell(selectedCell, selectedCell.page, patch);
    if (selectedBlock && selectedBlockLayout) updateLayout(selectedBlock, selectedBlockLayout.page, patch);
  }

  function fitSelectedToScheduleArea() {
    if (selectedCell) updateCell(selectedCell, selectedCell.page, { x: 4, y: 15, width: 92, height: 72 });
    if (selectedBlock && selectedBlockLayout) updateLayout(selectedBlock, selectedBlockLayout.page, { x: 5, width: 90 });
  }

  function pointerToPercent(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-line bg-white/95 p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Custom sheet canvas</h3>
            <p className="text-sm text-stone-600">Add schedule fields, select one to style it, then drag or resize it on the page.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded border border-line bg-panel px-2 py-1 text-xs font-medium">
              Schedule as
              <select
                value={design.customScheduleStyle}
                onChange={(event) => updateDesignPatch({ customScheduleStyle: event.target.value as ScheduleDesignSettings["customScheduleStyle"] })}
                className="rounded border border-line bg-white px-1 py-0.5"
              >
                <option value="table">Table</option>
                <option value="list">List</option>
                <option value="cards">Cards</option>
                <option value="timeline">Timeline</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 rounded border border-line bg-panel px-2 py-1 text-xs font-medium">
              <input type="checkbox" checked={design.customShowBlockCards} onChange={(event) => updateDesignPatch({ customShowBlockCards: event.target.checked })} />
              Rehearsal cards
            </label>
            <label className="inline-flex items-center gap-2 rounded border border-line bg-panel px-2 py-1 text-xs font-medium">
              <input type="checkbox" checked={design.snapToGrid} onChange={(event) => updateDesignPatch({ snapToGrid: event.target.checked })} />
              Snap
            </label>
            <label className="inline-flex min-w-[170px] items-center gap-2 rounded border border-line bg-panel px-2 py-1 text-xs font-medium">
              Zoom
              <input type="range" min={70} max={130} value={canvasZoom} onChange={(event) => updateDesignPatch({ customCanvasZoom: Number(event.target.value) })} className="min-w-0 flex-1" />
              <span className="w-9 text-right">{canvasZoom}%</span>
            </label>
          </div>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-[1.25fr_.95fr]">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Insert fields</div>
            <div className="flex flex-wrap gap-1">
              {placeholderTools.map((tool) => (
                <button key={tool.id} onClick={() => addCell(tool)} className="inline-flex items-center gap-1 rounded border border-line bg-panel px-2 py-1 text-xs font-medium hover:bg-white">
                  <Grid3X3 size={12} /> {tool.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-line bg-panel p-2">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Selected item</div>
            {selectedCell ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium">Label<input value={selectedCell.label} onChange={(event) => updateCellStyle(selectedCell.id, { label: event.target.value })} className="mt-1 w-full rounded border border-line px-2 py-1" /></label>
                <label className="text-xs font-medium">Text size <span className="text-stone-500">{selectedCell.fontSize ?? 12}px</span><input type="range" min={7} max={34} value={selectedCell.fontSize ?? 12} onChange={(event) => updateCellStyle(selectedCell.id, { fontSize: Number(event.target.value) })} className="mt-2 w-full" /></label>
                <label className="text-xs font-medium">Width <span className="text-stone-500">{Math.round(selectedCell.width)}%</span><input type="range" min={8} max={96} value={selectedCell.width} onChange={(event) => updateCell(selectedCell, selectedCell.page, { width: Number(event.target.value) })} className="mt-2 w-full" /></label>
                <label className="text-xs font-medium">Height <span className="text-stone-500">{Math.round(selectedCell.height)}%</span><input type="range" min={5} max={92} value={selectedCell.height} onChange={(event) => updateCell(selectedCell, selectedCell.page, { height: Number(event.target.value) })} className="mt-2 w-full" /></label>
                <ColorInput label="Text" value={selectedCell.textColor || design.primaryColor} onChange={(value) => updateCellStyle(selectedCell.id, { textColor: value })} />
                <ColorInput label="Fill" value={rgbaToHex(selectedCell.backgroundColor || "#ffffff")} onChange={(value) => updateCellStyle(selectedCell.id, { backgroundColor: value })} />
                {selectedCell.placeholder === "scheduleTable" && (
                  <label className="text-xs font-medium">
                    Schedule style
                    <select
                      value={design.customScheduleStyle}
                      onChange={(event) => updateDesignPatch({ customScheduleStyle: event.target.value as ScheduleDesignSettings["customScheduleStyle"] })}
                      className="mt-1 w-full rounded border border-line px-2 py-1"
                    >
                      <option value="table">Spreadsheet table</option>
                      <option value="list">Simple list</option>
                      <option value="cards">Shareable cards</option>
                      <option value="timeline">Time-first timeline</option>
                    </select>
                  </label>
                )}
                <label className="inline-flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={Boolean(selectedCell.bold)} onChange={(event) => updateCellStyle(selectedCell.id, { bold: event.target.checked })} />Bold</label>
                <div className="grid grid-cols-3 gap-1 sm:col-span-2">
                  <button onClick={() => moveSelected({ x: 4 })} className="rounded border border-line bg-white px-2 py-1 text-xs font-medium">Left</button>
                  <button onClick={() => moveSelected({ x: (100 - selectedCell.width) / 2 })} className="rounded border border-line bg-white px-2 py-1 text-xs font-medium">Center</button>
                  <button onClick={() => moveSelected({ x: 96 - selectedCell.width })} className="rounded border border-line bg-white px-2 py-1 text-xs font-medium">Right</button>
                  <button onClick={() => moveSelected({ y: 4 })} className="rounded border border-line bg-white px-2 py-1 text-xs font-medium">Top</button>
                  <button onClick={() => moveSelected({ y: (100 - selectedCell.height) / 2 })} className="rounded border border-line bg-white px-2 py-1 text-xs font-medium">Middle</button>
                  <button onClick={fitSelectedToScheduleArea} className="rounded border border-line bg-white px-2 py-1 text-xs font-medium">Fill</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => duplicateCell(selectedCell)} className="flex-1 rounded border border-line bg-white px-2 py-1 text-xs font-medium">Duplicate</button>
                  <button onClick={() => deleteCell(selectedCell.id)} className="flex-1 rounded border border-line bg-white px-2 py-1 text-xs font-medium text-coral">Delete</button>
                </div>
              </div>
            ) : selectedBlock ? (
              <div>
                <div className="mb-2 truncate text-sm font-semibold">{beatTitles(selectedBlock, state) || selectedBlock.customTitle || "Rehearsal card"}</div>
                <label className="text-xs font-medium">Card text size <span className="text-stone-500">{design.density}</span><input type="range" min={10} max={100} value={design.density} onChange={(event) => updateDesignPatch({ density: Number(event.target.value) })} className="mt-2 w-full" /></label>
                {selectedBlockLayout && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs font-medium">Width <span className="text-stone-500">{Math.round(selectedBlockLayout.width)}%</span><input type="range" min={8} max={96} value={selectedBlockLayout.width} onChange={(event) => updateLayout(selectedBlock, selectedBlockLayout.page, { width: Number(event.target.value) })} className="mt-2 w-full" /></label>
                    <label className="text-xs font-medium">Height <span className="text-stone-500">{Math.round(selectedBlockLayout.height)}%</span><input type="range" min={5} max={92} value={selectedBlockLayout.height} onChange={(event) => updateLayout(selectedBlock, selectedBlockLayout.page, { height: Number(event.target.value) })} className="mt-2 w-full" /></label>
                    <button onClick={() => moveSelected({ x: 4 })} className="rounded border border-line bg-white px-2 py-1 text-xs font-medium">Left</button>
                    <button onClick={() => moveSelected({ x: selectedBlockLayout ? (100 - selectedBlockLayout.width) / 2 : 4 })} className="rounded border border-line bg-white px-2 py-1 text-xs font-medium">Center</button>
                    <button onClick={fitSelectedToScheduleArea} className="rounded border border-line bg-white px-2 py-1 text-xs font-medium sm:col-span-2">Fit row width</button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-stone-600">Select a field or rehearsal card to edit text size, colors, or label.</p>
            )}
          </div>
        </div>
      </section>

      {Array.from({ length: pageCount }, (_, index) => {
        const page = (index + 1) as 1 | 2;
        const pageBlocks = design.customShowBlockCards ? blocks.filter((block) => (design.customBlockLayouts[block.id] ?? templateAwareLayout(block, state, pageCount, "dateLane")).page === page) : [];
        const pageCells = design.customCells.filter((cell) => cell.page === page);
        return (
          <div key={page} className={`mx-auto w-full ${pageMaxWidth}`} style={{ width: `${canvasZoom}%` }}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <strong>Page {page}</strong>
              <span className="text-stone-600">{design.paperSize.toUpperCase()} {design.orientation}. Drag any field, resize from the corner, and use the toolbar to choose table/list/cards/timeline.</span>
            </div>
            <div
              className={`relative mx-auto overflow-hidden rounded-lg border border-line shadow-2xl ${pagePadding}`}
              style={{
                aspectRatio: `${pageShape(design.paperSize, design.orientation).width} / ${pageShape(design.paperSize, design.orientation).height}`,
                background: isDark ? "#101827" : "#fffefb",
                color: isDark ? "#f8fafc" : design.primaryColor,
                fontFamily: fonts.body,
              }}
            >
                <div
                  className="relative h-full min-h-0 overflow-hidden rounded border border-dashed"
                  style={{
                    borderColor: isDark ? "#334155" : "#d9dfd3",
                    backgroundColor: isDark ? "rgba(15,23,42,.28)" : "rgba(250,250,247,.72)",
                    backgroundImage: canvasBackground,
                    backgroundSize: "5% 5%",
                  }}
                  onPointerMove={(event) => {
                    if (!dragging || dragging.page !== page) return;
                    const point = pointerToPercent(event);
                    if (dragging.kind === "block") {
                      const block = blocks.find((item) => item.id === dragging.id);
                      if (!block) return;
                      const layout = design.customBlockLayouts[block.id] ?? templateAwareLayout(block, state, pageCount, "dateLane");
                      if (dragging.mode === "move") updateLayout(block, page, { x: point.x - layout.width / 2, y: point.y - layout.height / 2 });
                      else updateLayout(block, page, { width: point.x - layout.x, height: point.y - layout.y });
                    } else {
                      const cell = design.customCells.find((item) => item.id === dragging.id);
                      if (!cell) return;
                      const cellLayout = { x: cell.x, y: cell.y, width: cell.width, height: cell.height, page: cell.page };
                      if (dragging.mode === "move") updateCell(cell, page, { x: point.x - cellLayout.width / 2, y: point.y - cellLayout.height / 2 });
                      else updateCell(cell, page, { width: point.x - cellLayout.x, height: point.y - cellLayout.y });
                    }
                  }}
                  onPointerDown={(event) => {
                    if (event.target === event.currentTarget) setSelected(null);
                  }}
                  onPointerUp={() => setDragging(null)}
                  onPointerCancel={() => setDragging(null)}
                >
                  <TemplateScaffold page={page} />
                  <div className="pointer-events-none absolute left-2 top-2 rounded bg-white/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-500 shadow-sm">
                    Paper canvas
                  </div>
                {pageCells.map((cell) => (
                  <div
                    key={cell.id}
                    className={`absolute z-[2] overflow-hidden rounded border shadow-sm ${selected?.kind === "cell" && selected.id === cell.id ? "ring-2 ring-moss" : ""}`}
                    style={{
                      left: `${cell.x}%`,
                      top: `${cell.y}%`,
                      width: `${cell.width}%`,
                      height: `${cell.height}%`,
                      background: cell.backgroundColor,
                      color: cell.textColor,
                      fontSize: cell.fontSize,
                      fontWeight: cell.bold ? 800 : 500,
                      padding: cell.placeholder === "scheduleTable" ? 6 : 8,
                    }}
                    onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelected({ kind: "cell", id: cell.id }); setDragging({ kind: "cell", id: cell.id, mode: "move", page }); }}
                  >
                    <div className="mb-1 text-[9px] uppercase tracking-wide opacity-60">{cell.label}</div>
                    <PlaceholderCellContent cell={cell} />
                    <button onPointerDown={(event) => event.stopPropagation()} onClick={() => deleteCell(cell.id)} className="absolute right-1 top-1 rounded bg-white/80 px-1 text-[10px] text-coral">x</button>
                    <button
                      className="absolute bottom-0 right-0 h-5 w-5 cursor-se-resize rounded-tl bg-ink text-[10px] text-white"
                      onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setDragging({ kind: "cell", id: cell.id, mode: "resize", page }); }}
                      title="Resize cell"
                    >
                      +
                    </button>
                  </div>
                ))}
                {pageBlocks.map((block) => {
                  const layout = design.customBlockLayouts[block.id] ?? templateAwareLayout(block, state, pageCount, "dateLane");
                  const color = blockTypeColor(block, state, design);
                  return (
                    <div
                      key={block.id}
                      className={`absolute overflow-hidden border shadow-md ${selected?.kind === "block" && selected.id === block.id ? "ring-2 ring-moss" : ""}`}
                      style={{
                        ...customBlockStyle(design.blockStyle, color, isDark, design.density),
                        left: `${layout.x}%`,
                        top: `${layout.y}%`,
                        width: `${layout.width}%`,
                        height: `${layout.height}%`,
                        fontFamily: fonts.body,
                      }}
                      onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelected({ kind: "block", id: block.id }); setDragging({ kind: "block", id: block.id, mode: "move", page }); }}
                    >
                      <CustomBlockContent block={block} blockIndex={blocks.findIndex((item) => item.id === block.id)} color={color} />
                      {pageCount === 2 && <button onPointerDown={(event) => event.stopPropagation()} onClick={() => updateLayout(block, page === 1 ? 2 : 1, { page: page === 1 ? 2 : 1 })} className="absolute right-1 top-1 rounded bg-panel px-1 text-[10px]">P{page === 1 ? 2 : 1}</button>}
                      <button
                        className="absolute bottom-0 right-0 h-5 w-5 cursor-se-resize rounded-tl bg-ink text-[10px] text-white"
                        onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setDragging({ kind: "block", id: block.id, mode: "resize", page }); }}
                        title="Resize"
                      >
                        +
                      </button>
                    </div>
                  );
                })}
                {!pageBlocks.length && !pageCells.length && <div className="grid h-full place-items-center text-sm text-stone-500">Add a schedule table or text field to begin.</div>}
                </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CustomBlockContent({ block, blockIndex, color }: { block: ScheduledBlock; blockIndex: number; color: string }) {
  const { state } = useAppState();
  const design = state.settings.scheduleDesign;
  const titleSize = design.density < 35 ? "text-[13px]" : design.density > 70 ? "text-lg" : "text-base";

  return (
    <>
      <div className="pr-8 text-[10px] font-extrabold uppercase tracking-wide" style={{ color }}>
        {dayLabel(block.date)} | {formatScheduleTime(block.startTime, design)} - {formatScheduleTime(block.endTime, design)}
        {design.showDurations ? ` | ${durationLabel(block)}` : ""}
      </div>
      <div className={`mt-0.5 truncate font-black ${titleSize}`}>
        {design.showIcons ? `${iconForBlock(block, state)} ` : ""}{beatTitles(block, state) || "Untitled rehearsal"}
      </div>
      <div className="mt-1 space-y-0.5 text-[11px] leading-snug opacity-80">
        {design.showRehearsalNumbers && <div><strong>Rehearsal #:</strong> {blockIndex + 1}</div>}
        {design.showCharacterNames && <div><strong>{design.charactersLabel || "Characters"}:</strong> {characterNames(block, state) || "None listed"}</div>}
        {design.showActorNames && <div><strong>{design.actorsLabel || "Actors"}:</strong> {actorNames(block, state) || "None listed"}</div>}
        {(design.showRoom || design.showLaneNames) && <div><strong>{design.roomLabel || "Room"}:</strong> {block.location || block.laneId}</div>}
        {design.showConflicts && block.conflicts.length > 0 && <div className="font-bold text-red-700"><strong>{design.conflictsLabel || "Conflicts"}:</strong> {block.conflicts.join("; ")}</div>}
      </div>
    </>
  );
}

function PlaceholderCellContent({ cell }: { cell: ScheduleDesignCell }) {
  const { state } = useAppState();
  const design = state.settings.scheduleDesign;
  const blocks = sortedBlocks(state.scheduledBlocks);
  const firstBlock = blocks[0];

  if (cell.placeholder === "scheduleTable") {
    const showRoom = design.showRoom || design.showLaneNames;
    const scheduleTextSize = cell.fontSize ?? 9;
    if (design.customScheduleStyle === "list") {
      return (
        <div className="space-y-1.5 leading-tight" style={{ fontSize: scheduleTextSize }}>
          {blocks.map((block) => (
            <div key={block.id} className="border-b border-stone-300/70 pb-1">
              <div className="font-black">{dayLabel(block.date)} | {formatScheduleTime(block.startTime, design)}-{formatScheduleTime(block.endTime, design)}</div>
              <div>{beatTitles(block, state) || block.customTitle || "Call"}{showRoom ? ` | ${block.location || block.laneId}` : ""}</div>
              {design.showActorNames && <div className="opacity-75">{actorNames(block, state)}</div>}
              {design.showConflicts && block.conflicts.length > 0 && <div className="font-bold text-red-700">{block.conflicts.join("; ")}</div>}
            </div>
          ))}
        </div>
      );
    }
    if (design.customScheduleStyle === "cards") {
      return (
        <div className="grid grid-cols-2 gap-1.5 leading-tight" style={{ fontSize: scheduleTextSize }}>
          {blocks.map((block) => (
            <article key={block.id} className="rounded border-l-4 bg-white/90 p-1.5 shadow-sm" style={{ borderLeftColor: blockTypeColor(block, state, design) }}>
              <div className="font-black">{beatTitles(block, state) || block.customTitle || "Call"}</div>
              <div className="opacity-80">{dayLabel(block.date)}</div>
              <div className="font-semibold">{formatScheduleTime(block.startTime, design)}-{formatScheduleTime(block.endTime, design)}</div>
              {showRoom && <div>{block.location || block.laneId}</div>}
              {design.showActorNames && <div className="opacity-75">{actorNames(block, state)}</div>}
            </article>
          ))}
        </div>
      );
    }
    if (design.customScheduleStyle === "timeline") {
      return (
        <div className="space-y-1.5 border-l-2 pl-2 leading-tight" style={{ borderColor: design.accentColor, fontSize: scheduleTextSize }}>
          {blocks.map((block) => (
            <div key={block.id} className="grid grid-cols-[4.7rem_1fr] gap-2">
              <strong>{formatScheduleTime(block.startTime, design)}</strong>
              <span>
                <span className="block font-bold">{dayLabel(block.date)}</span>
                {beatTitles(block, state) || block.customTitle || "Call"}{showRoom ? ` | ${block.location || block.laneId}` : ""}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return (
      <table className="w-full table-fixed border-collapse leading-tight" style={{ fontSize: scheduleTextSize }}>
        <thead>
          <tr>
            <th className="border border-stone-300 p-1 text-left">Date</th>
            <th className="border border-stone-300 p-1 text-left">{design.timeLabel || "Time"}</th>
            <th className="border border-stone-300 p-1 text-left">{design.workLabel || "Work"}</th>
            {showRoom && <th className="border border-stone-300 p-1 text-left">{design.roomLabel || "Room"}</th>}
            {design.showCharacterNames && <th className="border border-stone-300 p-1 text-left">{design.charactersLabel || "Characters"}</th>}
            {design.showActorNames && <th className="border border-stone-300 p-1 text-left">{design.actorsLabel || "Actors"}</th>}
            {design.showConflicts && <th className="border border-stone-300 p-1 text-left">{design.conflictsLabel || "Conflicts"}</th>}
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr key={block.id}>
              <td className="border border-stone-300 p-1">{dayLabel(block.date).replace(", 2026-", " ")}</td>
              <td className="border border-stone-300 p-1">{formatScheduleTime(block.startTime, design)}-{formatScheduleTime(block.endTime, design)}{design.showDurations ? ` ${durationLabel(block)}` : ""}</td>
              <td className="border border-stone-300 p-1">{beatTitles(block, state) || block.customTitle || "Call"}</td>
              {showRoom && <td className="border border-stone-300 p-1">{block.location || block.laneId}</td>}
              {design.showCharacterNames && <td className="border border-stone-300 p-1">{characterNames(block, state)}</td>}
              {design.showActorNames && <td className="border border-stone-300 p-1">{actorNames(block, state)}</td>}
              {design.showConflicts && <td className="border border-stone-300 p-1">{block.conflicts.join("; ")}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const values: Record<ScheduleDesignPlaceholder, string> = {
    playTitle: state.settings.playTitle,
    week: `${design.weekLabel || "Week of"} ${state.settings.weekStartDate}`,
    scheduleTable: "",
    castList: state.actors.filter((actor) => actor.active).map((actor) => actor.name).join(", ") || "Cast TBD",
    directorNotes: design.rehearsalNotes || "Notes",
    emergencyContact: design.emergencyContact || "Emergency contact",
    footerText: design.footerText || "Footer",
    date: firstBlock ? dayLabel(firstBlock.date) : "Date",
    time: firstBlock ? `${formatScheduleTime(firstBlock.startTime, design)}-${formatScheduleTime(firstBlock.endTime, design)}` : design.timeLabel || "Time",
    beat: firstBlock ? beatTitles(firstBlock, state) || design.workLabel || "Work" : design.workLabel || "Work",
    room: firstBlock ? firstBlock.location || firstBlock.laneId : design.roomLabel || "Room",
    actors: firstBlock ? actorNames(firstBlock, state) || design.actorsLabel || "Actors" : design.actorsLabel || "Actors",
    characters: firstBlock ? characterNames(firstBlock, state) || design.charactersLabel || "Characters" : design.charactersLabel || "Characters",
  };

  return <div className="leading-tight">{values[cell.placeholder]}</div>;
}

function TemplateScaffold({ page }: { page: 1 | 2 }) {
  const { state } = useAppState();
  const design = state.settings.scheduleDesign;
  const blocks = sortedBlocks(state.scheduledBlocks);
  const dates = customLayoutDates(state);
  const visibleDates = datesForPage(dates, page, design.customPageCount);
  const lanes = state.settings.lanes.slice(0, Math.max(1, state.settings.maxParallelBlocks));
  const range = customTimeRange(state);
  const isMatrix = design.renderMode === "roomMatrix" || design.renderMode === "weeklyGrid" || design.renderMode === "horizontalTimeline";
  if (!isMatrix) return null;

  return (
    <div className="pointer-events-none absolute inset-0 text-[10px] text-stone-500">
      {visibleDates.map((date) => {
        const dateIndex = visibleDates.indexOf(date);
        const dateWidth = 90 / Math.max(1, visibleDates.length);
        const dateLeft = 5 + dateIndex * dateWidth;
        return (
          <div key={date} className="absolute top-3 rounded bg-white/85 px-2 py-1 font-black uppercase shadow-sm" style={{ left: `${dateLeft}%`, width: `${Math.max(12, dateWidth - 1)}%` }}>
            {dayLabel(date)}
          </div>
        );
      })}
      {visibleDates.map((date) => {
        const dateIndex = visibleDates.indexOf(date);
        const dateWidth = 90 / Math.max(1, visibleDates.length);
        const laneWidth = dateWidth / Math.max(1, lanes.length);
        return lanes.map((lane, laneIndex) => (
          <div
            key={`${date}-${lane}`}
            className="absolute top-10 border-b border-stone-300/70 pb-1 text-center font-semibold"
            style={{ left: `${5 + dateIndex * dateWidth + laneIndex * laneWidth}%`, width: `${laneWidth - 0.5}%` }}
          >
            {design.renderMode === "roomMatrix" ? lane : "Schedule"}
          </div>
        ));
      })}
      {getTimeSlots(range.start, range.end, 30).map((time) => {
        const y = 16 + ((timeToMinutes(time) - timeToMinutes(range.start)) / Math.max(1, timeToMinutes(range.end) - timeToMinutes(range.start))) * 78;
        return (
          <div key={time} className="absolute left-1 right-1 border-t border-stone-300/45" style={{ top: `${y}%` }}>
            <span className="relative -top-2 rounded bg-white/85 px-1 font-bold">{formatScheduleTime(time, design)}</span>
          </div>
        );
      })}
      {!blocks.length && <div className="absolute inset-0 grid place-items-center text-sm">No scheduled blocks yet</div>}
    </div>
  );
}

function templateAwareLayout(block: ScheduledBlock, state: AppState, pageCount: 1 | 2, mode: "dateLane"): CustomBlockLayout {
  const dates = customLayoutDates(state);
  const page = pageForDate(block.date, dates, pageCount);
  const visibleDates = datesForPage(dates, page, pageCount);
  const lanes = state.settings.lanes.slice(0, Math.max(1, state.settings.maxParallelBlocks));
  const range = customTimeRange(state);
  const dateIndex = Math.max(0, visibleDates.indexOf(block.date));
  const laneIndex = mode === "dateLane" ? Math.max(0, lanes.indexOf(block.laneId)) : 0;
  const dateWidth = 90 / Math.max(1, visibleDates.length);
  const laneWidth = dateWidth / Math.max(1, lanes.length);
  const start = timeToMinutes(range.start);
  const end = timeToMinutes(range.end);
  const total = Math.max(1, end - start);
  const y = 16 + ((timeToMinutes(block.startTime) - start) / total) * 78;
  const height = Math.max(8, ((timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / total) * 78);
  return {
    page,
    x: 5 + dateIndex * dateWidth + laneIndex * laneWidth + 0.35,
    y,
    width: Math.max(12, laneWidth - 0.7),
    height,
  };
}

function customLayoutDates(state: AppState) {
  const scheduledDates = sortedBlocks(state.scheduledBlocks).map((block) => block.date);
  const weekDates = getWeekDates(state.settings.weekStartDate).filter((date) => scheduledDates.includes(date));
  return weekDates.length ? weekDates : [...new Set(scheduledDates)];
}

function datesForPage(dates: string[], page: 1 | 2, pageCount: 1 | 2) {
  if (pageCount === 1) return dates;
  const split = Math.ceil(dates.length / 2);
  return page === 1 ? dates.slice(0, split) : dates.slice(split);
}

function pageForDate(date: string, dates: string[], pageCount: 1 | 2): 1 | 2 {
  if (pageCount === 1) return 1;
  return dates.indexOf(date) >= Math.ceil(dates.length / 2) ? 2 : 1;
}

function customTimeRange(state: AppState) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  const starts = blocks.map((block) => timeToMinutes(block.startTime));
  const ends = blocks.map((block) => timeToMinutes(block.endTime));
  const configuredStart = timeToMinutes(state.settings.rehearsalStartTime);
  const configuredEnd = timeToMinutes(state.settings.rehearsalEndTime);
  const start = minutesToTime(Math.min(configuredStart, ...starts));
  const end = minutesToTime(Math.max(configuredEnd, ...ends));
  return { start, end };
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function Panel({ title, children, hidden = false, className = "" }: { title: string; children: React.ReactNode; hidden?: boolean; className?: string }) {
  return <div hidden={hidden} className={`rounded-xl border border-line bg-white p-4 shadow-sm ${className}`}><h3 className="mb-3 font-semibold">{title}</h3>{children}</div>;
}

function TextStyleControl({ label, align, bold, onAlignChange, onBoldChange }: { label: string; align: ScheduleTextAlign; bold: boolean; onAlignChange: (align: ScheduleTextAlign) => void; onBoldChange: (bold: boolean) => void }) {
  return <div className="rounded-lg border border-line bg-panel p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <label className="flex items-center gap-1 text-xs font-medium"><input type="checkbox" checked={bold} onChange={(event) => onBoldChange(event.target.checked)} /> Bold</label>
    </div>
    <div className="grid grid-cols-3 gap-1" aria-label={`${label} alignment`}>
      {(["left", "center", "right"] as ScheduleTextAlign[]).map((option) => <button key={option} onClick={() => onAlignChange(option)} className={`rounded px-2 py-1.5 text-xs font-medium capitalize ${align === option ? "bg-ink text-white" : "bg-white text-stone-700 hover:bg-stone-100"}`}>{option}</button>)}
    </div>
  </div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="mt-2 block text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mr-2" />{label}</label>;
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium">{label}<span className="mt-1 flex items-center gap-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-12 rounded border border-line p-1" /><input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 rounded border border-line px-2 py-1" /></span></label>;
}

function pageShape(paperSize: PaperSize, orientation: PrintOrientation) {
  const sizes = {
    letter: { portrait: { width: 8.5, height: 11 }, landscape: { width: 11, height: 8.5 } },
    legal: { portrait: { width: 8.5, height: 14 }, landscape: { width: 14, height: 8.5 } },
    a4: { portrait: { width: 8.27, height: 11.69 }, landscape: { width: 11.69, height: 8.27 } },
  } as const;
  return sizes[paperSize][orientation];
}

function customBlockStyle(blockStyle: BlockStyle, color: string, isDark: boolean, density: number) {
  const padding = density < 35 ? "6px 8px" : density > 70 ? "14px 16px" : "10px 12px";
  const base = {
    borderLeft: `7px solid ${color}`,
    borderTopColor: isDark ? "#334155" : "#e6e1d8",
    borderRightColor: isDark ? "#334155" : "#e6e1d8",
    borderBottomColor: isDark ? "#334155" : "#e6e1d8",
    background: isDark ? "#1f2937" : "#fff",
    color: isDark ? "#f8fafc" : "#17211f",
    borderRadius: 8,
    padding,
  };

  if (blockStyle === "sharp") return { ...base, borderRadius: 0 };
  if (blockStyle === "sticky") return { ...base, background: "#fff4bf", color: "#2b241f", boxShadow: "2px 3px 0 rgba(0,0,0,.1)", transform: "rotate(-.2deg)" };
  if (blockStyle === "outline") return { ...base, background: "transparent", borderColor: color, borderLeft: `7px solid ${color}` };
  if (blockStyle === "filled") return { ...base, background: isDark ? "#1f2937" : `color-mix(in srgb, ${color} 15%, white)` };
  if (blockStyle === "minimal") return { ...base, background: "transparent", borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderLeft: `3px solid ${color}`, paddingLeft: 9 };
  return base;
}

function defaultLayout(blocks: ScheduledBlock[], block: ScheduledBlock, page: 1 | 2): CustomBlockLayout {
  const index = Math.max(0, blocks.findIndex((item) => item.id === block.id));
  return {
    x: 4 + (index % 2) * 46,
    y: 4 + Math.floor(index / 2) * 17,
    width: 42,
    height: 14,
    page,
  };
}

function clampLayout(layout: CustomBlockLayout, snap: boolean): CustomBlockLayout {
  const step = snap ? 2 : 0.5;
  const round = (value: number) => Math.round(value / step) * step;
  const width = clamp(round(layout.width), 16, 96);
  const height = clamp(round(layout.height), 8, 90);
  return {
    page: layout.page,
    width,
    height,
    x: clamp(round(layout.x), 0, 100 - width),
    y: clamp(round(layout.y), 0, 100 - height),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rgbaToHex(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return "#ffffff";
  return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`;
}
