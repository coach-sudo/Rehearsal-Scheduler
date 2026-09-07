import type { AppState, BlockStyle, FontPairing, HeaderStyle, PrintOrientation, PrintSpacing, ScheduleDesignCell, ScheduleDesignSettings, ScheduledBlock, ScheduleLayout, ScheduleRenderMode, ScheduleTemplate } from "../types";
import { dayNames, formatTime, getDayOfWeek, getTimeSlots, getWeekDates, timeToMinutes } from "./time";

type TemplateDefinition = {
  id: ScheduleTemplate;
  label: string;
  purpose: string;
  readPath: string;
  renderMode: ScheduleRenderMode;
  primary: string;
  accent: string;
  block: BlockStyle;
  header: HeaderStyle;
  layout: ScheduleLayout;
  orientation: PrintOrientation;
  spacing: PrintSpacing;
  density: number;
  fontPairing: FontPairing;
  showActorNames: boolean;
  showCharacterNames: boolean;
  showRoom: boolean;
  showConflicts: boolean;
  showNotes: boolean;
  showIcons: boolean;
  showDurations: boolean;
  showRehearsalNumbers: boolean;
};

// The designer deliberately has two strong starting points. Everything else
// is handled by field-level controls, not a parade of near-duplicate presets.
export const scheduleTemplates: TemplateDefinition[] = [
  {
    id: "beatCardsByDay",
    label: "Beat Cards by Day",
    purpose: "Best for young casts because each day has clear call cards with times, rooms, and names.",
    readPath: "Day columns, cards sorted by start time",
    renderMode: "beatCardsByDay",
    primary: "#15231f",
    accent: "#426d5a",
    block: "rounded",
    header: "divider",
    layout: "cards",
    orientation: "landscape",
    spacing: "comfortable",
    density: 58,
    fontPairing: "classic",
    showActorNames: true,
    showCharacterNames: false,
    showRoom: true,
    showConflicts: true,
    showNotes: true,
    showIcons: false,
    showDurations: true,
    showRehearsalNumbers: false,
  },
  {
    id: "weeklyGrid",
    label: "Weekly Grid",
    purpose: "Best when directors and actors want a familiar calendar grid with clear called names.",
    readPath: "Days across top, time down side",
    renderMode: "weeklyGrid",
    primary: "#1f2937",
    accent: "#5f86a6",
    block: "minimal",
    header: "divider",
    layout: "grid",
    orientation: "landscape",
    spacing: "compact",
    density: 36,
    fontPairing: "classic",
    showActorNames: true,
    showCharacterNames: false,
    showRoom: true,
    showConflicts: true,
    showNotes: false,
    showIcons: false,
    showDurations: false,
    showRehearsalNumbers: false,
  },
];

export const fontPairings = {
  classic: { label: "Classic: Inter / Helvetica", heading: "Inter, Arial, sans-serif", body: "Inter, Arial, sans-serif" },
  theatrical: { label: "Theatrical: Georgia / Source Sans", heading: "Georgia, 'Times New Roman', serif", body: "Inter, Arial, sans-serif" },
  modern: { label: "Modern: Poppins / DM Sans", heading: "Poppins, Inter, Arial, sans-serif", body: "'DM Sans', Inter, Arial, sans-serif" },
  film: { label: "Film: Roboto Condensed", heading: "'Arial Narrow', Arial, sans-serif", body: "'Arial Narrow', Arial, sans-serif" },
  youth: { label: "Youth: Nunito", heading: "Nunito, Inter, Arial, sans-serif", body: "Nunito, Inter, Arial, sans-serif" },
} as const;

export function sortedBlocks(blocks: ScheduledBlock[]) {
  return [...blocks].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
    a.laneId.localeCompare(b.laneId)
  );
}

export function beatTitles(block: ScheduledBlock, state: AppState) {
  if (block.customTitle) return block.customTitle;
  return block.beatIds.map((id) => state.beats.find((beat) => beat.id === id)?.title).filter(Boolean).join(" + ");
}

export function actorNames(block: ScheduledBlock, state: AppState) {
  if (["break", "lunch", "custom"].includes(String(block.blockType))) {
    const activeIds = state.actors.filter((actor) => actor.active).map((actor) => actor.id);
    if (activeIds.length && activeIds.every((actorId) => block.actorIds.includes(actorId))) return "Company";
  }
  return block.actorIds.map((id) => state.actors.find((actor) => actor.id === id)?.name).filter(Boolean).join(", ");
}

export function characterNames(block: ScheduledBlock, state: AppState) {
  if (!block.beatIds.length) return "";
  return block.actorIds.map((id) => state.characterMap.find((item) => item.actorId === id)?.characterName).filter(Boolean).join(", ");
}

export function blockTypeColor(block: ScheduledBlock, state: AppState, design: ScheduleDesignSettings) {
  if (!design.useRehearsalTypeColors) return "#171717";
  if (block.blockType === "break" || block.blockType === "lunch") return design.runColor;
  if (block.blockType === "custom") return design.musicColor;
  const title = beatTitles(block, state).toLowerCase();
  if (title.includes("fight")) return design.fightColor;
  if (title.includes("music") || title.includes("song")) return design.musicColor;
  if (title.includes("run") || title.includes("stumble")) return design.runColor;
  return design.sceneColor;
}

export function formatScheduleTime(time: string, design: ScheduleDesignSettings) {
  return design.timeFormat === "24" ? time : formatTime(time);
}

export function dayLabel(date: string) {
  return `${dayNames[getDayOfWeek(date)]}, ${date}`;
}

export function durationLabel(block: ScheduledBlock) {
  const minutes = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
  return `${minutes} min`;
}

function contentFitScale(state: AppState, design: ScheduleDesignSettings) {
  if (design.paginationMode === "forceTwoPages") return 1;
  // The proportional grid already allocates a real time band to every call.
  // Scaling the whole grid makes the spreadsheet labels unreadable before the
  // available page area is actually used.
  if (design.renderMode === "weeklyGrid") return 1;
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return 1;
  const dates = unique(blocks.map((block) => block.date));
  const maxDayBlocks = Math.max(1, ...dates.map((date) => blocks.filter((block) => block.date === date).length));
  const detailWeight =
    Number(design.showActorNames) +
    Number(design.showCharacterNames) +
    Number(design.showRoom || design.showLaneNames) +
    Number(design.showNotes) +
    Number(design.showConflicts);
  const blockPressure = design.template === "weeklyGrid" ? blocks.length / 24 : blocks.length / 20;
  const dayPressure = design.template === "weeklyGrid" ? maxDayBlocks / 7 : maxDayBlocks / 5;
  const detailPressure = detailWeight * 0.045;
  // Larger type needs a little more room. The content still fits the selected
  // paper target, but the designer's type scale remains visibly responsive.
  const textPressure = Math.max(0, (design.minimumTextSize ?? 11) - 11) * 0.035;
  const raw = 1.08 - Math.max(blockPressure, dayPressure) * 0.18 - detailPressure - textPressure;
  return Math.max(0.72, Math.min(1, Number(raw.toFixed(3))));
}

export function scheduleExportHtml(state: AppState) {
  const design = state.settings.scheduleDesign;
  const fonts = fontPairings[design.fontPairing];
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(state.settings.playTitle)} schedule</title><style>${baseCss(state, design, fonts)}</style></head><body>${renderPaper(state, design)}</body></html>`;
}

type RenderPagePlan = {
  blocks: ScheduledBlock[];
  pageNumber: number;
  pageCount: number;
  label?: string;
};

function renderPaper(state: AppState, design: ScheduleDesignSettings) {
  if (design.customLayoutEnabled) {
    return `<main class="custom-export ${design.template} ${design.orientation} ${design.spacing}">
      ${renderCustomPages(state, design)}
    </main>`;
  }
  const pages = planReadablePages(state, design);
  return pages.map((page) => {
    const pageState = { ...state, scheduledBlocks: page.blocks };
    const mode = design.renderMode;
    const scale = contentFitScale(pageState, design);
    return `<main class="print-wrapper schedule-paper ${design.template} ${design.orientation} ${design.spacing} ${mode} ${design.paginationMode !== "forceTwoPages" ? "one-page" : ""}">
      ${renderHeader(pageState, design, page)}
      <div class="schedule-content" style="--content-scale:${scale};--content-width:${100 / scale}%">
        <div class="scaled-content">${renderContentForMode(pageState, design)}</div>
      </div>
      ${renderFooter(design)}
    </main>`;
  }).join("");
}

function renderContentForMode(state: AppState, design: ScheduleDesignSettings) {
  const mode = design.renderMode;
  return mode === "beatCardsByDay" ? renderBeatCardsByDay(state, design) :
    mode === "horizontalTimeline" ? renderHorizontalTimeline(state, design) :
    mode === "actorCallMatrix" ? renderActorCallMatrix(state, design) :
    mode === "runOfDayStrip" ? renderRunOfDayStrip(state, design) :
    mode === "weeklyGrid" ? renderWeeklyGrid(state, design) :
    mode === "roomBoard" ? renderRoomMatrix(state, design) :
    mode === "roomMatrix" ? renderRoomMatrix(state, design) :
    mode === "actorCallSheet" ? renderActorCallSheet(state, design) :
    mode === "directorWorklist" ? renderDirectorWorklist(state, design) :
    mode === "denseTable" ? renderDenseTable(state, design) :
    mode === "formalCallSheet" ? renderFormalCallSheet(state, design) :
    mode === "visualBoard" ? renderVisualBoard(state, design) :
    mode === "parentFriendly" ? renderParentFriendly(state, design) :
    mode === "digitalDisplay" ? renderDigitalDisplay(state, design) :
    renderDayStack(state, design);
}

function planReadablePages(state: AppState, design: ScheduleDesignSettings): RenderPagePlan[] {
  const blocks = sortedBlocks(state.scheduledBlocks);
  const pageCount = shouldUseTwoPages(blocks, state, design) ? 2 : 1;
  if (!blocks.length || pageCount === 1) {
    return [{ blocks, pageNumber: 1, pageCount: 1 }];
  }

  if (design.renderMode === "actorCallMatrix") {
    const split = Math.ceil(blocks.length / 2);
    return [
      { blocks: blocks.slice(0, split), pageNumber: 1, pageCount, label: "First half of weekly calls" },
      { blocks: blocks.slice(split), pageNumber: 2, pageCount, label: "Second half of weekly calls" },
    ].filter((page) => page.blocks.length);
  }

  const dates = unique(blocks.map((block) => block.date));
  if (dates.length <= 1) {
    const split = Math.ceil(blocks.length / 2);
    return [
      { blocks: blocks.slice(0, split), pageNumber: 1, pageCount },
      { blocks: blocks.slice(split), pageNumber: 2, pageCount },
    ].filter((page) => page.blocks.length);
  }

  const split = Math.ceil(dates.length / 2);
  const firstDates = new Set(dates.slice(0, split));
  const secondDates = new Set(dates.slice(split));
  return [
    { blocks: blocks.filter((block) => firstDates.has(block.date)), pageNumber: 1, pageCount, label: dayRangeLabel(dates.slice(0, split)) },
    { blocks: blocks.filter((block) => secondDates.has(block.date)), pageNumber: 2, pageCount, label: dayRangeLabel(dates.slice(split)) },
  ].filter((page) => page.blocks.length);
}

function shouldUseTwoPages(blocks: ScheduledBlock[], state: AppState, design: ScheduleDesignSettings) {
  if (design.paginationMode === "forceTwoPages") return blocks.length > 0;
  return false;
}

function dayRangeLabel(dates: string[]) {
  if (!dates.length) return "";
  if (dates.length === 1) return dayLabel(dates[0]);
  return `${dayNames[getDayOfWeek(dates[0])]}-${dayNames[getDayOfWeek(dates[dates.length - 1])]}`;
}

function renderCustomPages(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  const pageCount = design.customPageCount;
  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const page = (pageIndex + 1) as 1 | 2;
    return `<section class="schedule-paper custom-page ${design.orientation}">
      <div class="custom-canvas">
        ${renderCustomScaffold(state, design, page)}
        ${design.customCells.filter((cell) => cell.page === page).map((cell) => renderCustomCell(cell, state, design)).join("")}
        ${design.customShowBlockCards ? blocks.filter((block) => layoutFor(block, state, design).page === page).map((block, index) => {
          const layout = layoutFor(block, state, design, index);
          const color = blockTypeColor(block, state, design);
          return `<article class="custom-block ${design.blockStyle}" style="left:${layout.x}%;top:${layout.y}%;width:${layout.width}%;height:${layout.height}%;--block-color:${color}">
            <div class="block-time">${escapeHtml(dayLabel(block.date))} | ${escapeHtml(formatScheduleTime(block.startTime, design))} - ${escapeHtml(formatScheduleTime(block.endTime, design))}${design.showDurations ? ` | ${escapeHtml(durationLabel(block))}` : ""}</div>
            <div class="block-title">${design.showIcons ? `${escapeHtml(iconForBlock(block, state))} ` : ""}${escapeHtml(beatTitles(block, state) || "Untitled rehearsal")}</div>
            <div class="block-meta">
              ${design.showRehearsalNumbers ? `<div><strong>Rehearsal #:</strong> ${index + 1}</div>` : ""}
              ${design.showCharacterNames ? `<div><strong>${escapeHtml(design.charactersLabel || "Characters")}:</strong> ${escapeHtml(characterNames(block, state) || "None listed")}</div>` : ""}
              ${design.showActorNames ? `<div><strong>${escapeHtml(design.actorsLabel || "Actors")}:</strong> ${escapeHtml(actorNames(block, state) || "None listed")}</div>` : ""}
              ${design.showRoom || design.showLaneNames ? `<div><strong>${escapeHtml(design.roomLabel || "Room")}:</strong> ${escapeHtml(block.laneId)}</div>` : ""}
              ${design.showConflicts && block.conflicts.length ? `<div class="conflict"><strong>${escapeHtml(design.conflictsLabel || "Conflicts")}:</strong> ${escapeHtml(block.conflicts.join("; "))}</div>` : ""}
            </div>
          </article>`;
        }).join("") : ""}
      </div>
    </section>`;
  }).join("");
}

function renderCustomCell(cell: ScheduleDesignCell, state: AppState, design: ScheduleDesignSettings) {
  return `<section class="custom-cell" style="left:${cell.x}%;top:${cell.y}%;width:${cell.width}%;height:${cell.height}%;background:${escapeHtml(cell.backgroundColor || "rgba(255,255,255,.88)")};color:${escapeHtml(cell.textColor || design.primaryColor)};font-size:${cell.fontSize ?? 12}px;font-weight:${cell.bold ? 800 : 500}">
    <div class="custom-cell-label">${escapeHtml(cell.label)}</div>
    <div class="custom-cell-value">${placeholderValue(cell, state, design)}</div>
  </section>`;
}

function placeholderValue(cell: ScheduleDesignCell, state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  const firstBlock = blocks[0];
  if (cell.placeholder === "playTitle") return escapeHtml(state.settings.playTitle);
  if (cell.placeholder === "week") return `${escapeHtml(design.weekLabel || "Week of")} ${escapeHtml(state.settings.weekStartDate)}`;
  if (cell.placeholder === "castList") return escapeHtml(state.actors.filter((actor) => actor.active).map((actor) => actor.name).join(", ") || "Cast TBD");
  if (cell.placeholder === "directorNotes") return escapeHtml(design.rehearsalNotes || "Notes");
  if (cell.placeholder === "emergencyContact") return escapeHtml(design.emergencyContact || "Emergency contact");
  if (cell.placeholder === "footerText") return escapeHtml(design.footerText || "Footer");
  if (cell.placeholder === "date") return escapeHtml(firstBlock ? dayLabel(firstBlock.date) : "Date");
  if (cell.placeholder === "time") return escapeHtml(firstBlock ? `${formatScheduleTime(firstBlock.startTime, design)}-${formatScheduleTime(firstBlock.endTime, design)}` : design.timeLabel || "Time");
  if (cell.placeholder === "beat") return escapeHtml(firstBlock ? beatTitles(firstBlock, state) : design.workLabel || "Work");
  if (cell.placeholder === "room") return escapeHtml(firstBlock ? firstBlock.location || firstBlock.laneId : design.roomLabel || "Room");
  if (cell.placeholder === "actors") return escapeHtml(firstBlock ? actorNames(firstBlock, state) : design.actorsLabel || "Actors");
  if (cell.placeholder === "characters") return escapeHtml(firstBlock ? characterNames(firstBlock, state) : design.charactersLabel || "Characters");
  return renderCustomScheduleTable(state, design);
}

function renderCustomScheduleTable(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return "No scheduled blocks yet";
  const showRoom = design.showRoom || design.showLaneNames;
  if (design.customScheduleStyle === "list") {
    return `<div class="custom-list">${blocks.map((block) => `<div><strong>${escapeHtml(dayNames[getDayOfWeek(block.date)])} ${escapeHtml(formatScheduleTime(block.startTime, design))}-${escapeHtml(formatScheduleTime(block.endTime, design))}</strong><span>${escapeHtml(beatTitles(block, state) || block.customTitle || "Call")}${showRoom ? ` | ${escapeHtml(block.location || block.laneId)}` : ""}</span>${design.showActorNames ? `<small>${escapeHtml(actorNames(block, state))}</small>` : ""}</div>`).join("")}</div>`;
  }
  if (design.customScheduleStyle === "cards") {
    return `<div class="custom-card-list">${blocks.map((block) => `<article style="--block-color:${blockTypeColor(block, state, design)}"><strong>${escapeHtml(beatTitles(block, state) || block.customTitle || "Call")}</strong><span>${escapeHtml(dayLabel(block.date))} | ${escapeHtml(formatScheduleTime(block.startTime, design))}-${escapeHtml(formatScheduleTime(block.endTime, design))}</span>${showRoom ? `<small>${escapeHtml(block.location || block.laneId)}</small>` : ""}${design.showActorNames ? `<small>${escapeHtml(actorNames(block, state))}</small>` : ""}</article>`).join("")}</div>`;
  }
  if (design.customScheduleStyle === "timeline") {
    return `<div class="custom-timeline">${blocks.map((block) => `<div><strong>${escapeHtml(formatScheduleTime(block.startTime, design))}</strong><span>${escapeHtml(dayLabel(block.date))}<br>${escapeHtml(beatTitles(block, state) || block.customTitle || "Call")}${showRoom ? ` | ${escapeHtml(block.location || block.laneId)}` : ""}</span></div>`).join("")}</div>`;
  }
  return `<table class="custom-cell-table"><thead><tr><th>Date</th><th>${escapeHtml(design.timeLabel || "Time")}</th><th>${escapeHtml(design.workLabel || "Work")}</th>${showRoom ? `<th>${escapeHtml(design.roomLabel || "Room")}</th>` : ""}${design.showCharacterNames ? `<th>${escapeHtml(design.charactersLabel || "Characters")}</th>` : ""}${design.showActorNames ? `<th>${escapeHtml(design.actorsLabel || "Actors")}</th>` : ""}${design.showConflicts ? `<th>${escapeHtml(design.conflictsLabel || "Conflicts")}</th>` : ""}</tr></thead><tbody>${blocks.map((block) => `<tr><td>${escapeHtml(dayNames[getDayOfWeek(block.date)])}<br>${escapeHtml(block.date.slice(5))}</td><td>${escapeHtml(formatScheduleTime(block.startTime, design))}<br>${escapeHtml(formatScheduleTime(block.endTime, design))}${design.showDurations ? `<br>${escapeHtml(durationLabel(block))}` : ""}</td><td>${escapeHtml(beatTitles(block, state) || block.customTitle || "Call")}</td>${showRoom ? `<td>${escapeHtml(block.location || block.laneId)}</td>` : ""}${design.showCharacterNames ? `<td>${escapeHtml(characterNames(block, state))}</td>` : ""}${design.showActorNames ? `<td>${escapeHtml(actorNames(block, state))}</td>` : ""}${design.showConflicts ? `<td>${escapeHtml(block.conflicts.join("; "))}</td>` : ""}</tr>`).join("")}</tbody></table>`;
}

function renderCustomScaffold(state: AppState, design: ScheduleDesignSettings, page: 1 | 2) {
  if (design.renderMode !== "roomMatrix" && design.renderMode !== "weeklyGrid") return "";
  const dates = customLayoutDates(state);
  const visibleDates = datesForPage(dates, page, design.customPageCount);
  const lanes = state.settings.lanes.slice(0, Math.max(1, state.settings.maxParallelBlocks));
  const range = customTimeRange(state);
  const dateWidth = 90 / Math.max(1, visibleDates.length);
  const laneWidth = dateWidth / Math.max(1, lanes.length);
  const dateLabels = visibleDates.map((date, index) => `<div class="scaffold-date" style="left:${5 + index * dateWidth}%;width:${Math.max(12, dateWidth - 1)}%">${escapeHtml(dayLabel(date))}</div>`).join("");
  const laneLabels = visibleDates.flatMap((date, dateIndex) => lanes.map((lane, laneIndex) => `<div class="scaffold-lane" style="left:${5 + dateIndex * dateWidth + laneIndex * laneWidth}%;width:${laneWidth - 0.5}%">${escapeHtml(design.renderMode === "roomMatrix" ? lane : "Schedule")}</div>`)).join("");
  const start = timeToMinutes(range.start);
  const end = timeToMinutes(range.end);
  const timeRows = getTimeSlots(range.start, range.end, 30).map((time) => {
    const top = 16 + ((timeToMinutes(time) - start) / Math.max(1, end - start)) * 78;
    return `<div class="scaffold-time" style="top:${top}%"><span>${escapeHtml(formatScheduleTime(time, design))}</span></div>`;
  }).join("");
  return `<div class="custom-scaffold">${dateLabels}${laneLabels}${timeRows}</div>`;
}

function renderHeader(state: AppState, design: ScheduleDesignSettings, page?: RenderPagePlan) {
  const subtitle = `${design.weekLabel || "Week of"} ${state.settings.weekStartDate}${page && page.pageCount > 1 ? ` | Page ${page.pageNumber} of ${page.pageCount}${page.label ? ` | ${page.label}` : ""}` : ""}`;
  const showTopLogo = design.logoDataUrl && design.logoPosition.startsWith("top");
  const directorDetails = renderDirectorDetails(design);
  return `<header class="header ${design.headerStyle}">
    ${showTopLogo ? `<img class="logo logo-${design.logoPosition}" src="${design.logoDataUrl}" alt="">` : ""}
    <div class="header-copy">
      ${design.headerLabel ? `<div class="eyebrow">${escapeHtml(design.headerLabel)}</div>` : ""}
      <h1>${escapeHtml(state.settings.playTitle)}</h1>
      <div class="subtitle">${escapeHtml(subtitle)}</div>
      ${design.directorContactPlacement === "header" ? directorDetails : ""}
      ${design.showNotes && design.rehearsalNotes ? `<div class="notes"><strong>${escapeHtml(design.notesLabel || "Notes")}:</strong> ${escapeHtml(design.rehearsalNotes)}</div>` : ""}
      ${design.emergencyContact ? `<div class="notes">${escapeHtml(design.emergencyContact)}</div>` : ""}
    </div>
  </header>`;
}

function renderFooter(design: ScheduleDesignSettings) {
  const showFooterLogo = design.logoDataUrl && design.logoPosition.startsWith("footer");
  const footerText = design.footerText || "Generated by Rehearsal Scheduler";
  return `<footer class="schedule-footer">
    <span>${escapeHtml(footerText)}</span>
    ${design.directorContactPlacement === "footer" ? renderDirectorDetails(design) : ""}
    ${showFooterLogo ? `<img class="logo footer-logo logo-${design.logoPosition}" src="${design.logoDataUrl}" alt="">` : ""}
  </footer>`;
}

function directorEntries(design: ScheduleDesignSettings) {
  const directors = (design.directors ?? [])
    .filter((director) => director.name.trim() || director.contact.trim())
    .slice(0, 3);
  if (directors.length) return directors;
  return design.directorName || design.directorContact
    ? [{ name: design.directorName, contact: design.directorContact }]
    : [];
}

function renderDirectorDetails(design: ScheduleDesignSettings) {
  const directors = directorEntries(design);
  if (!directors.length) return "";
  return `<div class="director-details">${directors.map((director) => `<span class="notes director-contact">${escapeHtml([director.name, director.contact].filter(Boolean).join(" | "))}</span>`).join("")}</div>`;
}

function renderDayStack(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  return Object.entries(groupBy(blocks, "date")).map(([date, dayBlocks]) => `
    <section class="day-section">
      <h2>${escapeHtml(dayLabel(date))}</h2>
      <div class="${design.layout === "timeline" ? "timeline" : "block-list"}">
        ${dayBlocks.map((block, index) => renderBlock(block, state, design, index)).join("")}
      </div>
    </section>
  `).join("");
}

function renderBeatCardsByDay(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  const days = Object.entries(groupBy(blocks, "date"));
  return `<div class="beat-card-days">${days.map(([date, dayBlocks]) => `
    <section class="beat-day-column">
      <h2>${escapeHtml(dayNames[getDayOfWeek(date)])}<span>${escapeHtml(date.slice(5))}</span></h2>
      <div class="beat-day-cards">
        ${dayBlocks.map((block, index) => renderBeatDayCard(block, state, design, index)).join("")}
      </div>
    </section>
  `).join("")}</div>`;
}

function renderBeatDayCard(block: ScheduledBlock, state: AppState, design: ScheduleDesignSettings, index: number) {
  const color = blockTypeColor(block, state, design);
  const isGeneralCall = !block.beatIds.length && (block.blockType === "break" || block.blockType === "lunch");
  const showRoom = (design.showRoom || design.showLaneNames) && (!isGeneralCall || Boolean(block.location));
  const showActors = design.showActorNames && !isGeneralCall;
  return `<article data-block-id="${escapeHtml(block.id)}" class="beat-day-card ${design.blockStyle} time-${design.cardTimePlacement}" style="--block-color:${color};${typographyVariables(design)}">
    <div class="card-time">${escapeHtml(formatScheduleTime(block.startTime, design))} - ${escapeHtml(formatScheduleTime(block.endTime, design))}${design.showDurations ? ` | ${escapeHtml(durationLabel(block))}` : ""}</div>
    <div class="card-body"><h3>${design.showIcons ? `${escapeHtml(iconForBlock(block, state))} ` : ""}${escapeHtml(beatTitles(block, state) || "Untitled rehearsal")}</h3>
    ${showRoom ? `<div class="card-room">${escapeHtml(block.location || block.laneId)}</div>` : ""}
    ${showActors ? `<p class="called-names"><strong class="called-label">${escapeHtml(design.calledLabel || "Called")}:</strong> <span class="actor-value">${escapeHtml(actorNames(block, state) || "Cast TBD")}</span></p>` : ""}
    ${design.showCharacterNames && block.beatIds.length ? `<p><strong>${escapeHtml(design.charactersLabel || "Characters")}:</strong> ${escapeHtml(characterNames(block, state) || "Characters TBD")}</p>` : ""}
    ${design.showNotes ? `<small>${escapeHtml(blockFocus(block, state))}</small>` : ""}
    ${design.showRehearsalNumbers && block.beatIds.length ? `<small>Rehearsal #${index + 1}</small>` : ""}
    ${design.showConflicts && block.conflicts.length ? `<em>${escapeHtml(block.conflicts.join("; "))}</em>` : ""}
    </div>
  </article>`;
}

function renderHorizontalTimeline(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  const range = customTimeRange(state);
  const start = timeToMinutes(range.start);
  const end = timeToMinutes(range.end);
  const total = Math.max(1, end - start);
  const ticks = getTimeSlots(range.start, range.end, 30);
  const compact = design.paginationMode === "preferOnePage";
  return `<div class="horizontal-timeline">
    <div class="timeline-ruler">
      <div class="timeline-day-label">Day</div>
      <div class="timeline-scale">${ticks.map((time) => {
        const left = ((timeToMinutes(time) - start) / total) * 100;
        return `<span style="left:${left}%">${escapeHtml(formatScheduleTime(time, design))}</span>`;
      }).join("")}</div>
    </div>
    ${Object.entries(groupBy(blocks, "date")).map(([date, dayBlocks]) => {
      const lanes = unique(dayBlocks.map((block) => block.laneId));
      const detailLines = Number(design.showActorNames) + Number(design.showCharacterNames) + Number(design.showNotes);
      const barHeight = compact ? 20 : detailLines ? 42 : 24;
      const laneStep = compact ? 22 : barHeight + 5;
      const trackHeight = Math.max(compact ? 28 : 54, lanes.length * laneStep + (compact ? 5 : 16));
      return `<section class="timeline-day-row" style="min-height:${trackHeight}px">
        <h2>${escapeHtml(dayNames[getDayOfWeek(date)])}<span>${escapeHtml(date.slice(5))}</span></h2>
        <div>
        <div class="timeline-track" style="height:${trackHeight}px">
          ${ticks.map((time) => `<i style="left:${((timeToMinutes(time) - start) / total) * 100}%"></i>`).join("")}
          ${dayBlocks.map((block) => {
            const laneIndex = Math.max(0, lanes.indexOf(block.laneId));
            const left = ((timeToMinutes(block.startTime) - start) / total) * 100;
            const width = ((timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / total) * 100;
            const color = blockTypeColor(block, state, design);
            return `<article class="timeline-bar" style="left:${left}%;top:${8 + laneIndex * laneStep}px;width:${Math.max(4, width)}%;height:${barHeight}px;--block-color:${color}">
              <strong>${escapeHtml(beatTitles(block, state) || "Call")}</strong>
              <span>${escapeHtml(formatScheduleTime(block.startTime, design))}-${escapeHtml(formatScheduleTime(block.endTime, design))}${design.showRoom || design.showLaneNames ? ` | ${escapeHtml(block.location || block.laneId)}` : ""}</span>
              ${design.showActorNames ? `<span>${escapeHtml(design.calledLabel || "Called")}: ${escapeHtml(actorNames(block, state) || "Cast TBD")}</span>` : ""}
              ${design.showCharacterNames && block.beatIds.length ? `<span>${escapeHtml(design.charactersLabel || "Characters")}: ${escapeHtml(characterNames(block, state) || "Characters TBD")}</span>` : ""}
              ${design.showNotes ? `<span>${escapeHtml(blockFocus(block, state))}</span>` : ""}
              ${design.showConflicts && block.conflicts.length ? `<em>${escapeHtml(block.conflicts.join("; "))}</em>` : ""}
            </article>`;
          }).join("")}
        </div>
        <div class="timeline-call-details">
          ${dayBlocks.map((block) => `<p><strong>${escapeHtml(formatScheduleTime(block.startTime, design))}-${escapeHtml(formatScheduleTime(block.endTime, design))}</strong> ${escapeHtml(beatTitles(block, state) || "Call")}${design.showRoom || design.showLaneNames ? ` | ${escapeHtml(design.roomLabel || "Room")}: ${escapeHtml(block.location || block.laneId)}` : ""}${design.showActorNames ? ` | ${escapeHtml(design.calledLabel || "Called")}: ${escapeHtml(actorNames(block, state) || "Cast TBD")}` : ""}</p>`).join("")}
        </div>
        </div>
      </section>`;
    }).join("")}
  </div>`;
}

function renderActorCallMatrix(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  const calledActorIds = unique(blocks.flatMap((block) => block.actorIds));
  const actors = state.actors.filter((actor) => actor.active && calledActorIds.includes(actor.id));
  return `<table class="actor-call-matrix" style="--actor-count:${Math.max(1, actors.length)};--call-count:${Math.max(1, blocks.length)}">
    <thead>
      <tr>
        <th>Actor</th>
        ${blocks.map((block) => `<th class="matrix-call-header">
          <span class="matrix-call-time">${escapeHtml(dayNames[getDayOfWeek(block.date)].slice(0, 3))} ${escapeHtml(block.date.slice(5))} | ${escapeHtml(formatScheduleTime(block.startTime, design))}</span>
          <small>${escapeHtml(beatTitles(block, state) || "Call")}</small>
        </th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${actors.map((actor) => {
        return `<tr>
          <td><strong>${escapeHtml(actor.name)}</strong>${design.showCharacterNames ? `<small>${escapeHtml(state.characterMap.find((item) => item.actorId === actor.id)?.characterName || "")}</small>` : ""}</td>
          ${blocks.map((block) => `<td class="${block.actorIds.includes(actor.id) ? "called-cell" : ""}">${block.actorIds.includes(actor.id) ? "CALL" : ""}</td>`).join("")}
        </tr>`;
      }).join("")}
    </tbody>
  </table>`;
}

function renderRunOfDayStrip(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  return `<div class="run-strip-days">${Object.entries(groupBy(blocks, "date")).map(([date, dayBlocks]) => `
    <section class="run-day-strip">
      <h2>${escapeHtml(dayNames[getDayOfWeek(date)])}<span>${escapeHtml(date.slice(5))}</span></h2>
      ${dayBlocks.map((block, index) => {
        const color = blockTypeColor(block, state, design);
        return `<article class="run-strip-item" style="--block-color:${color}">
          <div class="run-time">${escapeHtml(formatScheduleTime(block.startTime, design))} - ${escapeHtml(formatScheduleTime(block.endTime, design))}${design.showDurations ? `<span>${escapeHtml(durationLabel(block))}</span>` : ""}</div>
          <strong>${design.showIcons ? `${escapeHtml(iconForBlock(block, state))} ` : ""}${escapeHtml(beatTitles(block, state) || "Call")}</strong>
          ${design.showActorNames ? `<p class="called-names"><strong>${escapeHtml(design.calledLabel || "Called")}:</strong> ${escapeHtml(actorNames(block, state) || "Cast TBD")}</p>` : ""}
          ${design.showCharacterNames && block.beatIds.length ? `<p><strong>${escapeHtml(design.charactersLabel || "Characters")}:</strong> ${escapeHtml(characterNames(block, state) || "Characters TBD")}</p>` : ""}
          ${design.showRoom || design.showLaneNames ? `<small>${escapeHtml(block.location || block.laneId)}</small>` : ""}
          ${design.showNotes ? `<small>${escapeHtml(blockFocus(block, state))}</small>` : ""}
          ${design.showRehearsalNumbers && block.beatIds.length ? `<small>Rehearsal #${index + 1}</small>` : ""}
          ${design.showConflicts && block.conflicts.length ? `<em>${escapeHtml(block.conflicts.join("; "))}</em>` : ""}
        </article>`;
      }).join("")}
    </section>
  `).join("")}</div>`;
}

function renderWeeklyGrid(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  const dates = orderedScheduleDates(state, blocks);
  const range = roundedTimeRange(state, blocks);
  const start = timeToMinutes(range.start);
  const end = timeToMinutes(range.end);
  const total = Math.max(1, end - start);
  const ticks = inclusiveTimeMarkers(start, end, 30);

  return `<section class="weekly-engine" style="${typographyVariables(design)};--day-count:${Math.max(1, dates.length)}">
    <div class="pro-grid">
      <div class="grid-corner">${escapeHtml(design.timeLabel || "Time")}</div>
      <div class="grid-day-heads">
        ${dates.map((date, index) => `<div class="grid-day-head" style="left:${(index / dates.length) * 100}%;width:${100 / dates.length}%">
          <strong>${escapeHtml(dayNames[getDayOfWeek(date)])}</strong><span>${escapeHtml(shortDateLabel(date))}</span>
        </div>`).join("")}
      </div>
      <div class="grid-time-axis">
        ${ticks.slice(0, -1).map((tick, index) => {
          const nextTick = ticks[index + 1];
          const markerOffset = verticalOffset(design.timeCellVerticalAlign ?? design.cellContentVerticalAlign);
          const markerTop = ((tick - start + (nextTick - tick) * markerOffset) / total) * 100;
          const transform = markerOffset === 1 ? "translateY(-100%)" : markerOffset === 0.5 ? "translateY(-50%)" : "translateY(0)";
          return `<span class="grid-time-marker" style="top:${markerTop}%;transform:${transform}">${escapeHtml(formatScheduleTime(minutesToTime(tick), design))}</span>`;
        }).join("")}
      </div>
      <div class="grid-stage">
        ${dates.map((date, index) => `<div class="grid-day-band" style="left:${(index / dates.length) * 100}%;width:${100 / dates.length}%"></div>`).join("")}
        ${ticks.map((tick) => `<i class="grid-line" style="top:${((tick - start) / total) * 100}%"></i>`).join("")}
        ${blocks.map((block, index) => renderProportionalGridBlock(block, state, design, index, dates, start, total)).join("")}
      </div>
    </div>
  </section>`;
}

function renderProportionalGridBlock(block: ScheduledBlock, state: AppState, design: ScheduleDesignSettings, index: number, dates: string[], gridStart: number, total: number) {
  const dateIndex = Math.max(0, dates.indexOf(block.date));
  // A lane only takes horizontal space while it is actually competing with
  // another lane. This keeps ordinary calls full-width while preserving a
  // clear side-by-side view for genuinely simultaneous rehearsals.
  const lanes = activeLanesForBlock(block, state.scheduledBlocks);
  const laneIndex = Math.max(0, lanes.indexOf(block.laneId));
  const dayWidth = 100 / Math.max(1, dates.length);
  const laneWidth = dayWidth / Math.max(1, lanes.length);
  const rawTop = ((timeToMinutes(block.startTime) - gridStart) / total) * 100;
  const rawHeight = ((timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / total) * 100;
  const top = Math.max(0, Math.min(100, rawTop));
  const height = Math.max(0.1, Math.min(100 - top, rawHeight));
  const left = dateIndex * dayWidth + laneIndex * laneWidth;
  const color = blockTypeColor(block, state, design);
  const title = beatTitles(block, state) || block.customTitle || "Call";
  const room = block.location || block.laneId;
  const isGeneralCall = !block.beatIds.length && (block.blockType === "break" || block.blockType === "lunch");
  const showActors = design.showActorNames && !isGeneralCall;
  const safeTextSize = safeBlockTextSize(block, design, showActors, isGeneralCall, lanes.length);
  return `<article data-block-id="${escapeHtml(block.id)}" data-max-text-size="${safeTextSize}" class="grid-call-block ${design.blockStyle}" style="left:calc(${left}% + 2px);top:calc(${top}% + 2px);width:calc(${laneWidth}% - 4px);height:calc(${height}% - 4px);--block-color:${color};--block-font-size:${safeTextSize}px">
    <span class="grid-call-number">${index + 1}</span>
    <span class="grid-call-time">${escapeHtml(formatScheduleTime(block.startTime, design))} - ${escapeHtml(formatScheduleTime(block.endTime, design))}</span>
    <strong>${escapeHtml(title)}</strong>
    ${design.showRoom || design.showLaneNames ? `<span class="grid-call-room">${escapeHtml(room)}</span>` : ""}
    ${showActors ? `<span class="grid-call-actors"><b>${escapeHtml(design.calledLabel || "Called")}:</b> ${escapeHtml(actorNames(block, state) || "Cast TBD")}</span>` : ""}
    ${design.showCharacterNames && block.beatIds.length ? `<span class="grid-call-detail"><b>${escapeHtml(design.charactersLabel || "Characters")}:</b> ${escapeHtml(characterNames(block, state) || "TBD")}</span>` : ""}
    ${design.showNotes ? `<span class="grid-call-detail">${escapeHtml(blockFocus(block, state))}</span>` : ""}
    ${design.showConflicts && block.conflicts.length ? `<em>${escapeHtml(block.conflicts.join("; "))}</em>` : ""}
  </article>`;
}

function orderedScheduleDates(state: AppState, blocks: ScheduledBlock[]) {
  const scheduledDates = unique(blocks.map((block) => block.date)).sort();
  const weekDates = getWeekDates(state.settings.weekStartDate).filter((date) => scheduledDates.includes(date));
  return weekDates.length ? weekDates : scheduledDates;
}

function shortDateLabel(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function roundedTimeRange(state: AppState, blocks: ScheduledBlock[]) {
  const starts = [timeToMinutes(state.settings.rehearsalStartTime), ...blocks.map((block) => timeToMinutes(block.startTime))];
  const ends = [timeToMinutes(state.settings.rehearsalEndTime), ...blocks.map((block) => timeToMinutes(block.endTime))];
  const start = Math.floor(Math.min(...starts) / 30) * 30;
  const end = Math.ceil(Math.max(...ends) / 30) * 30;
  return { start: minutesToTime(start), end: minutesToTime(Math.max(start + 30, end)) };
}

function inclusiveTimeMarkers(start: number, end: number, step: number) {
  const markers: number[] = [];
  for (let minute = start; minute <= end; minute += step) markers.push(minute);
  return markers;
}

function verticalOffset(align: ScheduleDesignSettings["cellContentVerticalAlign"]) {
  if (align === "center") return 0.5;
  if (align === "bottom") return 1;
  return 0;
}

function safeBlockTextSize(block: ScheduledBlock, design: ScheduleDesignSettings, showActors: boolean, isGeneralCall: boolean, concurrentLaneCount: number) {
  const requested = design.blockTextSizes?.[block.id] ?? design.minimumTextSize ?? 11;
  const duration = Math.max(10, timeToMinutes(block.endTime) - timeToMinutes(block.startTime));
  const detailLines = 2
    + Number(design.showRoom || design.showLaneNames)
    + Number(showActors)
    + Number(design.showCharacterNames && !isGeneralCall && block.beatIds.length)
    + Number(design.showNotes)
    + Number(design.showConflicts && block.conflicts.length);
  // A short call has a physically limited printed area. This conservative cap
  // keeps user-selected type inside that area instead of clipping the card.
  const capacity = Math.floor((duration * 1.6) / Math.max(2, detailLines));
  // More actors and simultaneous lanes create more wrapped lines. Lower the
  // cap before the content reaches the card edge rather than clipping it.
  const actorPenalty = showActors ? Math.max(0, block.actorIds.length - 2) : 0;
  const lanePenalty = Math.max(0, concurrentLaneCount - 1) * 2;
  const cap = Math.max(7, Math.min(28, capacity - actorPenalty - lanePenalty));
  return Math.max(8, Math.min(requested, cap));
}

function activeLanesForBlock(block: ScheduledBlock, blocks: ScheduledBlock[]) {
  const start = timeToMinutes(block.startTime);
  const end = timeToMinutes(block.endTime);
  const lanes = unique(
    blocks
      .filter((candidate) => candidate.date === block.date)
      .filter((candidate) => timeToMinutes(candidate.startTime) < end && timeToMinutes(candidate.endTime) > start)
      .map((candidate) => candidate.laneId),
  ).sort();
  return lanes.length ? lanes : [block.laneId || "Main"];
}

function renderRoomMatrix(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  const dates = unique(blocks.map((block) => block.date));
  const lanes = unique(blocks.map((block) => block.laneId));
  return dates.map((date) => {
    const dayBlocks = blocks.filter((block) => block.date === date);
    const times = unique(dayBlocks.flatMap((block) => [block.startTime, block.endTime])).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    const occupied = new Set<string>();
    return `<section class="day-section"><h2>${escapeHtml(dayLabel(date))}</h2><table class="room-matrix">
      <thead><tr><th>${escapeHtml(design.timeLabel || "Time")}</th>${lanes.map((lane) => `<th>${escapeHtml(lane)}</th>`).join("")}</tr></thead>
      <tbody>${times.map((time) => `<tr><td class="time-cell">${escapeHtml(formatScheduleTime(time, design))}</td>${lanes.map((lane) => {
        const key = `${lane}|${time}`;
        if (occupied.has(key)) return "";
        const found = dayBlocks.filter((block) => block.laneId === lane && block.startTime === time);
        if (!found.length) return `<td class="empty-cell"></td>`;
        const block = found[0];
        const rowIndex = times.indexOf(time);
        const span = Math.max(1, times.filter((slot) => timeToMinutes(slot) >= timeToMinutes(block.startTime) && timeToMinutes(slot) < timeToMinutes(block.endTime)).length);
        times.slice(rowIndex, rowIndex + span).forEach((slot) => occupied.add(`${lane}|${slot}`));
        return `<td rowspan="${span}" class="span-cell">${renderMiniBlock(block, state, design, rowIndex)}</td>`;
      }).join("")}</tr>`).join("")}</tbody>
    </table></section>`;
  }).join("");
}

function renderActorCallSheet(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  return Object.entries(groupBy(blocks, "date")).map(([date, dayBlocks]) => `
    <section class="day-section actor-calls">
      <h2>${escapeHtml(dayLabel(date))}</h2>
      ${dayBlocks.map((block, index) => `<article class="call-row">
        <div class="call-time">${escapeHtml(formatScheduleTime(block.startTime, design))}<span>${escapeHtml(formatScheduleTime(block.endTime, design))}${design.showDurations ? ` | ${escapeHtml(durationLabel(block))}` : ""}</span></div>
        <div class="call-main"><strong>${design.showIcons ? `${escapeHtml(iconForBlock(block, state))} ` : ""}${escapeHtml(beatTitles(block, state) || "Untitled rehearsal")}</strong>${design.showActorNames ? `<p>${escapeHtml(actorNames(block, state) || "Cast TBD")}</p>` : ""}${design.showCharacterNames ? `<small>${escapeHtml(characterNames(block, state) || "Characters TBD")}</small>` : ""}${design.showRehearsalNumbers ? `<small>Rehearsal #${index + 1}</small>` : ""}${design.showConflicts && block.conflicts.length ? `<small class="conflict">${escapeHtml(block.conflicts.join("; "))}</small>` : ""}</div>
        ${design.showRoom || design.showLaneNames ? `<div class="call-room">${escapeHtml(block.location || block.laneId)}</div>` : ""}
      </article>`).join("")}
    </section>
  `).join("");
}

function renderDirectorWorklist(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  const groups = groupByValue(blocks, (block) => workType(block, state));
  return `<div class="worklist">${Object.entries(groups).map(([type, typedBlocks]) => `
    <section class="work-card"><h2>${escapeHtml(type)}</h2>${sortedBlocks(typedBlocks).map((block, index) => renderBlock(block, state, design, index, true)).join("")}</section>
  `).join("")}</div>`;
}

function renderDenseTable(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  return `<table class="dense-table"><thead><tr><th>Day</th><th>${escapeHtml(design.timeLabel || "Time")}</th>${design.showRoom || design.showLaneNames ? `<th>${escapeHtml(design.roomLabel || "Room")}</th>` : ""}<th>${escapeHtml(design.workLabel || "Work")}</th>${design.showCharacterNames ? `<th>${escapeHtml(design.charactersLabel || "Characters")}</th>` : ""}${design.showActorNames ? `<th>${escapeHtml(design.actorsLabel || "Actors")}</th>` : ""}${design.showRehearsalNumbers ? "<th>#</th>" : ""}${design.showConflicts ? `<th>${escapeHtml(design.conflictsLabel || "Conflicts")}</th>` : ""}</tr></thead><tbody>
    ${blocks.map((block, index) => `<tr><td>${escapeHtml(dayNames[getDayOfWeek(block.date)])}<br>${escapeHtml(block.date.slice(5))}</td><td>${escapeHtml(formatScheduleTime(block.startTime, design))}-${escapeHtml(formatScheduleTime(block.endTime, design))}${design.showDurations ? `<br>${escapeHtml(durationLabel(block))}` : ""}</td>${design.showRoom || design.showLaneNames ? `<td>${escapeHtml(block.location || block.laneId)}</td>` : ""}<td>${design.showIcons ? `${escapeHtml(iconForBlock(block, state))} ` : ""}${escapeHtml(beatTitles(block, state))}</td>${design.showCharacterNames ? `<td>${escapeHtml(block.beatIds.length ? characterNames(block, state) : "")}</td>` : ""}${design.showActorNames ? `<td>${escapeHtml(actorNames(block, state))}</td>` : ""}${design.showRehearsalNumbers ? `<td>${block.beatIds.length ? index + 1 : ""}</td>` : ""}${design.showConflicts ? `<td>${escapeHtml(block.conflicts.join("; "))}</td>` : ""}</tr>`).join("")}
  </tbody></table>`;
}

function renderFormalCallSheet(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  const firstCall = blocks[0]?.startTime;
  return `<section class="call-sheet-summary">
    <div><span>General Call</span><strong>${firstCall ? escapeHtml(formatScheduleTime(firstCall, design)) : "TBD"}</strong></div>
    <div><span>Rooms</span><strong>${escapeHtml(unique(blocks.map((block) => block.laneId)).join(", "))}</strong></div>
    <div><span>Scheduled Blocks</span><strong>${blocks.length}</strong></div>
  </section>${renderDenseTable(state, design)}`;
}

function renderVisualBoard(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  return `<div class="visual-board">${Object.entries(groupBy(blocks, "date")).map(([date, dayBlocks]) => `<section class="visual-day"><h2>${escapeHtml(dayLabel(date))}</h2>${dayBlocks.map((block, index) => renderBlock(block, state, design, index)).join("")}</section>`).join("")}</div>`;
}

function renderParentFriendly(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  return Object.entries(groupBy(blocks, "date")).map(([date, dayBlocks]) => `
    <section class="day-section parent-list"><h2>${escapeHtml(dayLabel(date))}</h2>
      ${dayBlocks.map((block, index) => `<article class="parent-call"><strong>Arrive by ${escapeHtml(formatScheduleTime(block.startTime, design))}</strong><span>Dismissal around ${escapeHtml(formatScheduleTime(block.endTime, design))}${design.showDurations ? ` | ${escapeHtml(durationLabel(block))}` : ""}</span>${design.showActorNames ? `<p>${escapeHtml(actorNames(block, state) || "Cast TBD")}</p>` : ""}${design.showCharacterNames && block.beatIds.length ? `<p>${escapeHtml(characterNames(block, state) || "Characters TBD")}</p>` : ""}<small>${design.showIcons ? `${escapeHtml(iconForBlock(block, state))} ` : ""}${escapeHtml(beatTitles(block, state))}${design.showRoom || design.showLaneNames ? ` | ${escapeHtml(block.location || block.laneId)}` : ""}${design.showRehearsalNumbers && block.beatIds.length ? ` | Rehearsal #${index + 1}` : ""}</small>${design.showConflicts && block.conflicts.length ? `<small class="conflict">${escapeHtml(block.conflicts.join("; "))}</small>` : ""}</article>`).join("")}
    </section>
  `).join("");
}

function renderDigitalDisplay(state: AppState, design: ScheduleDesignSettings) {
  const blocks = sortedBlocks(state.scheduledBlocks);
  if (!blocks.length) return emptyState();
  return `<div class="digital-grid">${Object.entries(groupBy(blocks, "date")).map(([date, dayBlocks]) => `<section class="digital-day"><h2>${escapeHtml(dayLabel(date))}</h2>${dayBlocks.map((block, index) => renderBlock(block, state, design, index)).join("")}</section>`).join("")}</div>`;
}

function renderBlock(block: ScheduledBlock, state: AppState, design: ScheduleDesignSettings, index: number, forceDate = false) {
  const color = blockTypeColor(block, state, design);
  return `<article class="schedule-block ${design.blockStyle}" style="--block-color:${color}">
    <div class="block-time">${forceDate ? `${escapeHtml(dayLabel(block.date))} | ` : ""}${escapeHtml(formatScheduleTime(block.startTime, design))} - ${escapeHtml(formatScheduleTime(block.endTime, design))}${design.showDurations ? ` | ${durationLabel(block)}` : ""}</div>
    <div class="block-title">${design.showIcons ? `${escapeHtml(iconForBlock(block, state))} ` : ""}${escapeHtml(beatTitles(block, state) || "Untitled rehearsal")}</div>
    <div class="block-meta">
      ${design.showRehearsalNumbers && block.beatIds.length ? `<div><strong>Rehearsal #:</strong> ${index + 1}</div>` : ""}
      ${design.showCharacterNames && block.beatIds.length ? `<div><strong>${escapeHtml(design.charactersLabel || "Characters")}:</strong> ${escapeHtml(characterNames(block, state) || "None listed")}</div>` : ""}
      ${design.showActorNames ? `<div><strong>${escapeHtml(design.actorsLabel || "Actors")}:</strong> ${escapeHtml(actorNames(block, state) || "None listed")}</div>` : ""}
      ${design.showRoom || design.showLaneNames ? `<div><strong>${escapeHtml(design.roomLabel || "Room")}:</strong> ${escapeHtml(block.location || block.laneId)}</div>` : ""}
      ${design.showConflicts && block.conflicts.length ? `<div class="conflict"><strong>${escapeHtml(design.conflictsLabel || "Conflicts")}:</strong> ${escapeHtml(block.conflicts.join("; "))}</div>` : ""}
    </div>
  </article>`;
}

function renderMiniBlock(block: ScheduledBlock, state: AppState, design: ScheduleDesignSettings, index: number) {
  const color = blockTypeColor(block, state, design);
  const isGeneralCall = !block.beatIds.length && (block.blockType === "break" || block.blockType === "lunch");
  const showActors = design.showActorNames && !isGeneralCall;
  const showRoom = (design.showRoom || design.showLaneNames) && (!isGeneralCall || Boolean(block.location));
  return `<div class="mini-block" style="--block-color:${color};${typographyVariables(design)}">
    <span class="mini-time">${escapeHtml(formatScheduleTime(block.startTime, design))}-${escapeHtml(formatScheduleTime(block.endTime, design))}${design.showDurations ? ` | ${escapeHtml(durationLabel(block))}` : ""}</span>
    <strong>${design.showIcons ? `${escapeHtml(iconForBlock(block, state))} ` : ""}${escapeHtml(beatTitles(block, state) || "Untitled")}</strong>
    ${design.showRehearsalNumbers && block.beatIds.length ? `<span class="mini-detail">Rehearsal #${index + 1}</span>` : ""}
    ${design.showCharacterNames && block.beatIds.length ? `<span class="mini-detail">${escapeHtml(characterNames(block, state) || "Characters TBD")}</span>` : ""}
    ${showActors ? `<span class="mini-detail actor-detail">${escapeHtml(actorNames(block, state) || "Actors TBD")}</span>` : ""}
    ${showRoom ? `<span class="mini-detail">${escapeHtml(block.location || block.laneId)}</span>` : ""}
    ${design.showConflicts && block.conflicts.length ? `<em>${escapeHtml(block.conflicts.join("; "))}</em>` : ""}
  </div>`;
}

function typographyVariables(design: ScheduleDesignSettings) {
  const toFlex = (align: ScheduleDesignSettings["cellContentVerticalAlign"]) => align === "center" ? "center" : align === "bottom" ? "flex-end" : "flex-start";
  const shared = design.cellContentVerticalAlign ?? "top";
  return `--time-align:${design.timeTextAlign};--work-align:${design.workTextAlign};--actor-align:${design.actorTextAlign};--time-weight:${design.boldTimes ? 850 : 500};--work-weight:${design.boldWork ? 850 : 500};--actor-weight:${design.boldActorNames ? 850 : 400};--cell-content-align:${toFlex(shared)};--day-cell-align:${toFlex(design.dayCellVerticalAlign ?? shared)};--time-cell-align:${toFlex(design.timeCellVerticalAlign ?? shared)};--beat-cell-align:${toFlex(design.beatCellVerticalAlign ?? shared)}`;
}

function baseCss(state: AppState, design: ScheduleDesignSettings, fonts: { heading: string; body: string }) {
  const page = pageSize(design);
  const blocks = sortedBlocks(state.scheduledBlocks);
  const dates = unique(blocks.map((block) => block.date));
  const maxDayBlocks = Math.max(1, ...dates.map((date) => blocks.filter((block) => block.date === date).length));
  const gridTimeRows = Math.max(1, unique(blocks.flatMap((block) => [block.startTime, block.endTime])).length - 1);
  const onePage = design.paginationMode !== "forceTwoPages";
  const cardCompact = onePage || (design.renderMode === "beatCardsByDay" && maxDayBlocks >= 4);
  const keyColumns = blocks.length > 12 ? 2 : 1;
  const keyWidth = blocks.length > 12 ? "3.05in" : "2.55in";
  const gridRowHeight = onePage
    ? Math.max(0.22, Math.min(0.32, 6 / gridTimeRows))
    : Math.max(0.28, Math.min(0.42, 6.2 / gridTimeRows));
  const compactness = onePage ? (blocks.length > 15 || maxDayBlocks > 4 ? "tight" : "compact") : "open";
  const densityRatio = Math.max(0, Math.min(1, (design.density - 10) / 90));
  const densityPad = `${Math.round(1 + densityRatio * 9)}px ${Math.round(2 + densityRatio * 12)}px`;
  const gridHeaderHeight = `${Math.round(24 + densityRatio * 38)}px`;
  const pad = onePage ? "0.24in" : design.spacing === "compact" ? "0.32in" : design.spacing === "large" ? "0.58in" : "0.45in";
  const dark = design.renderMode === "digitalDisplay" || design.template === "digital";
  const bg = dark ? "#101827" : "#fffefb";
  const ink = dark ? "#f8fafc" : design.primaryColor;
  const blockPad = onePage ? compactness === "tight" ? "4px 5px" : "5px 7px" : design.density < 35 ? "6px 8px" : design.density > 70 ? "14px 16px" : "10px 12px";
  const minText = Math.max(8, Math.min(design.minimumTextSize ?? 11, 28));
  const gridDetailSize = Math.max(7.2, Math.min(16, minText - 1.35 + densityRatio * 1.1));
  const tableText = Math.max(8.5, onePage ? minText - 1 : Math.max(minText - 1, design.density < 35 ? 9 : 10.5));
  const detailText = Math.max(9, onePage ? minText : Math.max(minText, design.density < 35 ? 10 : 12));
  const microText = Math.max(8, onePage ? minText - 1.25 : minText - 1.5);
  const baseStyles = `
    @page{size:${design.paperSize} ${design.orientation};margin:0}
    body{margin:0;background:#dfe4dd;color:${ink};font-family:${fonts.body};font-size:${minText}px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.preview-selection{outline:2px solid #0b78d0!important;outline-offset:1px;cursor:pointer}
    .schedule-paper{width:${page.width};height:${page.height};margin:20px auto;padding:${pad};background:${bg};box-shadow:0 18px 60px rgba(15,23,42,.18);box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;page-break-before:avoid;page-break-after:avoid;page-break-inside:avoid}
    .schedule-content{flex:1 1 auto;min-height:0;height:100%;overflow:hidden;position:relative}
    .scaled-content{width:var(--content-width);height:calc(100% / var(--content-scale));min-height:0;overflow:hidden;transform:scale(var(--content-scale));transform-origin:top left}
    h1,h2,h3{font-family:${fonts.heading};margin:0;overflow-wrap:anywhere}.eyebrow{font-size:${microText}px;text-transform:uppercase;letter-spacing:.08em;opacity:.68}.subtitle{font-size:${minText}px;opacity:.82;margin-top:2px;white-space:normal;overflow-wrap:anywhere}.template-purpose{font-size:${microText}px;opacity:.72;margin-top:3px}
    h1{font-size:${onePage ? "19px" : design.spacing === "compact" ? "20px" : design.spacing === "large" ? "28px" : "24px"};line-height:1.02}.logo{width:${Math.max(24, Math.min(220, design.logoSize))}px;height:${Math.max(24, Math.min(220, design.logoSize))}px;object-fit:contain}.notes{margin-top:2px;font-size:${microText}px;opacity:.84;line-height:1.16}.director-contact{font-weight:750}.director-details{display:grid;gap:1px;margin-top:2px}
    .header{position:relative;flex:0 0 auto;border-bottom:2px solid ${design.accentColor};padding-bottom:${onePage ? "4px" : "8px"};margin-bottom:${onePage ? "5px" : "9px"};min-height:${design.logoDataUrl && design.logoPosition.startsWith("top") ? `${Math.max(24, Math.min(220, design.logoSize))}px` : "0"}}.header-copy{min-width:0}.logo-topLeft{position:absolute;left:0;top:0}.logo-topCenter{position:absolute;left:50%;top:0;transform:translateX(-50%)}.logo-topRight{position:absolute;right:0;top:0}.header:has(.logo-topLeft) .header-copy{padding-left:${Math.max(28, Math.min(230, design.logoSize + 10))}px}.header:has(.logo-topRight) .header-copy{padding-right:${Math.max(28, Math.min(230, design.logoSize + 10))}px}.header.ribbon{background:${design.accentColor};color:white;margin:-${pad} -${pad} ${onePage ? "5px" : "9px"};padding:${onePage ? "0.17in" : pad} ${pad} ${onePage ? "5px" : "10px"}}.header.marquee{border:2px double ${design.accentColor};padding:${onePage ? "5px" : "9px"};text-align:center}.header.banner{background:${design.primaryColor};color:white;border:0;padding:${onePage ? "5px" : "10px"} ${pad};margin:-${pad} -${pad} ${onePage ? "5px" : "9px"}}.header.callsheet{border:1px solid ${design.primaryColor};padding:${onePage ? "5px" : "8px"};text-transform:uppercase}.header.divider{border-bottom:3px solid ${design.accentColor}}
    .day-section{break-inside:${design.keepDaysTogether ? "avoid" : "auto"};page-break-inside:${design.keepDaysTogether ? "avoid" : "auto"};margin:0 0 14px}.day-section h2{font-size:16px;margin-bottom:7px;color:${ink}}
    .block-list{display:grid;gap:7px}.timeline{border-left:2px solid ${design.accentColor};padding-left:12px;display:grid;gap:7px}.schedule-block{break-inside:${design.avoidSplittingBlocks ? "avoid" : "auto"};border-left:7px solid var(--block-color);margin:0;padding:${blockPad};background:${dark ? "#1f2937" : "#fff"};border-radius:8px;border-top:1px solid ${dark ? "#334155" : "#e6e1d8"};border-right:1px solid ${dark ? "#334155" : "#e6e1d8"};border-bottom:1px solid ${dark ? "#334155" : "#e6e1d8"}}
    .schedule-block.sharp{border-radius:0}.schedule-block.sticky{background:#fff4bf;color:#2b241f;transform:rotate(-.2deg);box-shadow:2px 3px 0 rgba(0,0,0,.1)}.schedule-block.outline{background:transparent;border:1px solid var(--block-color);border-left:7px solid var(--block-color)}.schedule-block.filled{background:${dark ? "#1f2937" : "color-mix(in srgb,var(--block-color) 15%,white)"}}.schedule-block.minimal{background:transparent;border-top:0;border-right:0;border-bottom:0;border-left:3px solid var(--block-color);padding-left:9px}
    .block-time{font-size:${minText}px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;color:var(--block-color);white-space:nowrap}.block-title{font-weight:900;font-size:${design.density < 35 ? Math.max(13, minText + 1) : design.density > 70 ? 20 : Math.max(16, minText + 3)}px;margin-top:2px}.block-meta{font-size:${detailText}px;line-height:1.35;margin-top:4px}.conflict{color:#b42318;font-weight:700}
    table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:${tableText}px}th,td{border:1px solid ${dark ? "#334155" : "#d9dfd3"};vertical-align:top;padding:5px;overflow-wrap:anywhere}th{background:${dark ? "#1f2937" : "#f2f4ee"};font-weight:800}.time-cell{font-weight:800;white-space:nowrap;width:.78in}
    .weekly-grid,.room-matrix{height:100%}.weekly-grid th span,.room-matrix th span{white-space:nowrap}.weekly-grid td,.room-matrix td{height:${gridRowHeight}in}.span-cell{padding:0}.empty-cell{background:${dark ? "#111827" : "#fbfbf8"}}.mini-block{height:100%;box-sizing:border-box;border-left:${onePage ? "4px" : "6px"} solid var(--block-color);background:${dark ? "#1f2937" : "color-mix(in srgb,var(--block-color) 10%,white)"};padding:${onePage ? "3px" : "5px"};margin:0;border-radius:0;font-size:${Math.max(8.5, minText - 1)}px;line-height:1.16;overflow-wrap:anywhere}.mini-block strong,.mini-block span,.mini-block em{display:block}.mini-block strong{text-align:var(--work-align,left);font-weight:var(--work-weight,850)}.mini-block .mini-detail{text-align:var(--actor-align,left)}.mini-block .actor-detail{font-weight:var(--actor-weight,400)}.mini-block em{color:#b42318;font-style:normal}.mini-block .mini-time{font-size:${microText}px;font-weight:var(--time-weight,850);text-transform:uppercase;color:var(--block-color);white-space:nowrap;text-align:var(--time-align,left)}
    .weekly-engine{height:100%;min-height:0;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr);gap:${onePage ? "6px" : "10px"}}.weekly-engine.has-call-key{grid-template-columns:minmax(0,1fr) ${keyWidth}}.pro-grid{width:100%;height:100%;min-width:0;min-height:0;display:grid;grid-template-columns:${onePage ? ".58in" : ".72in"} minmax(0,1fr);grid-template-rows:${onePage ? ".42in" : ".52in"} minmax(0,1fr);border:1px solid ${dark ? "#334155" : "#cfd6ca"};background:${dark ? "rgba(15,23,42,.2)" : "#fff"};overflow:hidden}.grid-corner{display:grid;place-items:center;border-bottom:1px solid ${dark ? "#334155" : "#cfd6ca"};border-right:1px solid ${dark ? "#334155" : "#cfd6ca"};background:${dark ? "#1f2937" : "#f2f4ee"};font-size:${microText}px;font-weight:900;text-transform:uppercase}.grid-day-heads{position:relative;min-width:0;min-height:0;border-bottom:1px solid ${dark ? "#334155" : "#cfd6ca"};background:${dark ? "#1f2937" : "#f2f4ee"};overflow:hidden}.grid-day-head{position:absolute;inset-block:0;display:grid;place-items:center;border-left:1px solid ${dark ? "#334155" : "#d9dfd3"};text-align:center;line-height:1.05;min-width:0;overflow:hidden}.grid-day-head:first-child{border-left:0}.grid-day-head strong{font-size:${Math.max(10, minText)}px;white-space:nowrap}.grid-day-head span{font-size:${microText}px;font-weight:800;white-space:nowrap;opacity:.7}.grid-time-axis{position:relative;min-width:0;min-height:0;border-right:1px solid ${dark ? "#334155" : "#cfd6ca"};background:${dark ? "rgba(31,41,55,.58)" : "#f8f8f3"};overflow:hidden}.grid-time-marker{position:absolute;left:3px;right:3px;transform:translateY(-50%);font-size:${microText}px;font-weight:850;white-space:nowrap;text-align:right;overflow:hidden;color:${dark ? "#cbd5e1" : "#48534c"}}.grid-stage{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:${dark ? "#101827" : "#fffefb"}}.grid-day-band{position:absolute;top:0;bottom:0;border-left:1px solid ${dark ? "#334155" : "#d9dfd3"};background:${dark ? "transparent" : "rgba(246,247,241,.42)"}}.grid-day-band:first-child{border-left:0}.grid-line{position:absolute;left:0;right:0;border-top:1px solid ${dark ? "rgba(71,85,105,.45)" : "rgba(156,163,175,.35)"}}.grid-call-block{position:absolute;box-sizing:border-box;min-width:0;min-height:0;border:1px solid var(--block-color);border-left:${onePage ? "4px" : "6px"} solid var(--block-color);background:${dark ? "#1f2937" : "color-mix(in srgb,var(--block-color) 12%,white)"};padding:${onePage ? "3px 4px" : "5px 6px"};overflow:hidden;line-height:1.08}.grid-call-block.rounded{border-radius:5px}.grid-call-block.sharp,.grid-call-block.minimal{border-radius:0}.grid-call-block.outline{background:${dark ? "#101827" : "#fffefb"}}.grid-call-block.filled{background:${dark ? "#1f2937" : "color-mix(in srgb,var(--block-color) 22%,white)"}}.grid-call-block strong{display:block;min-width:0;padding-right:15px;text-align:var(--work-align,left);font-size:${Math.max(8.5, minText - 1)}px;font-weight:var(--work-weight,850);overflow-wrap:anywhere}.grid-call-block span{display:block;min-width:0;font-size:${microText}px}.grid-call-time{font-weight:var(--time-weight,850);color:var(--block-color);white-space:normal;overflow-wrap:normal;text-align:var(--time-align,left)}.grid-call-room{text-align:var(--actor-align,left);font-weight:750;opacity:.76;white-space:normal;overflow-wrap:anywhere}.grid-call-number{position:absolute!important;right:3px;top:3px;display:grid!important;place-items:center;width:13px;height:13px;border-radius:99px;background:var(--block-color);color:white;font-size:8px;font-weight:900}.weekly-call-key{min-width:0;border:1px solid ${dark ? "#334155" : "#cfd6ca"};background:${dark ? "rgba(31,41,55,.72)" : "#f8f8f3"};padding:${onePage ? "5px" : "8px"};overflow:hidden}.weekly-call-key h2{font-size:${Math.max(10, minText + 1)}px;margin-bottom:${onePage ? "4px" : "6px"};white-space:nowrap}.key-list{display:grid;grid-template-columns:repeat(${keyColumns},minmax(0,1fr));gap:${onePage ? "3px" : "5px"};align-content:start}.key-item{min-width:0;border-left:4px solid var(--block-color);background:${dark ? "#101827" : "#fff"};padding:${onePage ? "3px 4px" : "5px 6px"};line-height:1.12;overflow-wrap:anywhere}.key-item strong{display:flex;gap:4px;align-items:center;font-size:${Math.max(8.5, minText - 1)}px;color:var(--block-color);white-space:nowrap}.key-item strong span{display:grid;place-items:center;min-width:14px;height:14px;border-radius:99px;background:var(--block-color);color:#fff;font-size:8px}.key-item p{margin:1px 0 0;font-size:${Math.max(8, minText - 1.5)}px;font-weight:800}.key-item small{display:block;margin-top:1px;font-size:${Math.max(7.5, microText - .5)}px}.key-item em{display:block;margin-top:1px;font-size:${Math.max(7.5, microText - .5)}px;color:#b42318;font-style:normal;font-weight:800}
    .beat-card-days{display:grid;grid-template-columns:repeat(${Math.max(1, dates.length)},minmax(0,1fr));gap:${cardCompact ? "4px" : "8px"};align-items:stretch;height:100%}.beat-day-column{min-width:0;border:1px solid ${dark ? "#334155" : "#d9dfd3"};background:${dark ? "rgba(31,41,55,.75)" : "color-mix(in srgb," + design.accentColor + " 7%,white)"};padding:${cardCompact ? "4px" : "8px"};break-inside:avoid;overflow:hidden}.beat-day-column h2,.run-day-strip h2{font-size:${cardCompact ? Math.max(12, minText + 1) : Math.max(15, minText + 3)}px;text-align:center;margin-bottom:${cardCompact ? "3px" : "7px"};white-space:nowrap}.beat-day-column h2 span,.run-day-strip h2 span{display:block;font-size:${microText}px;font-family:${fonts.body};font-weight:800;opacity:.72;white-space:nowrap}.beat-day-cards{display:grid;grid-template-rows:repeat(${maxDayBlocks},minmax(0,1fr));gap:${cardCompact ? "3px" : "7px"};height:calc(100% - ${cardCompact ? ".31in" : ".43in"});align-content:stretch}.beat-day-card{min-width:0;min-height:0;border-left:${cardCompact ? "4px" : "6px"} solid var(--block-color);background:${dark ? "#1f2937" : "#fff"};border-radius:7px;padding:${cardCompact ? "4px" : "8px"};border-top:1px solid ${dark ? "#334155" : "#e1e5dc"};border-right:1px solid ${dark ? "#334155" : "#e1e5dc"};border-bottom:1px solid ${dark ? "#334155" : "#e1e5dc"};break-inside:avoid;overflow:hidden;overflow-wrap:anywhere;display:flex;flex-direction:column;justify-content:var(--beat-cell-align,var(--cell-content-align,flex-start))}.beat-day-card.sharp{border-radius:0}.beat-day-card.outline,.beat-day-card.minimal{background:transparent}.beat-day-card.filled{background:${dark ? "#1f2937" : "color-mix(in srgb,var(--block-color) 14%,white)"}}.beat-day-card h3{text-align:var(--work-align,left);font-weight:var(--work-weight,850);font-size:${cardCompact ? Math.max(10, minText + 1) : Math.max(design.density < 35 ? 12 : 15, minText + 2)}px;line-height:1.1}.beat-day-card p{margin:${cardCompact ? "2px" : "4px"} 0 0;font-size:${cardCompact ? Math.max(9, minText - 1) : Math.max(design.density < 35 ? 9.5 : 11, minText)}px;line-height:1.18;text-align:var(--actor-align,left)}.called-names{font-weight:400}.called-names .actor-value{font-weight:var(--actor-weight,400)}.beat-day-card small,.beat-day-card em{display:block;margin-top:${cardCompact ? "1px" : "3px"};font-size:${microText}px;line-height:1.14;text-align:var(--actor-align,left)}.beat-day-card em{color:#b42318;font-style:normal;font-weight:800}.card-time{font-size:${cardCompact ? Math.max(9, minText - .5) : minText}px;font-weight:var(--time-weight,850);color:var(--block-color);text-transform:uppercase;white-space:nowrap;text-align:var(--time-align,left)}.card-room{font-size:${microText}px;font-weight:800;opacity:.78;text-align:var(--actor-align,left)}.beat-day-card.time-leftRail{display:grid;grid-template-columns:minmax(.7in,.95in) minmax(0,1fr);gap:6px}.beat-day-card.time-leftRail .card-time{grid-column:1;grid-row:1 / span 2;white-space:normal}.beat-day-card.time-leftRail .card-body{grid-column:2;min-width:0}
    .horizontal-timeline{display:grid;gap:${onePage ? "3px" : "8px"};height:100%;grid-template-rows:${onePage ? `.2in repeat(${Math.max(1, dates.length)},minmax(0,1fr))` : "auto"}}.timeline-ruler,.timeline-day-row{display:grid;grid-template-columns:${onePage ? ".83in" : "1.08in"} 1fr;gap:${onePage ? "4px" : "8px"}}.timeline-day-label{font-size:${microText}px;font-weight:900;text-transform:uppercase;opacity:.64}.timeline-scale{position:relative;height:${onePage ? "17px" : "24px"};border-bottom:1px solid ${dark ? "#334155" : "#cfd6ca"}}.timeline-scale span{position:absolute;top:0;transform:translateX(-50%);font-size:${microText}px;font-weight:800;white-space:nowrap}.timeline-day-row{min-height:0;align-items:stretch;break-inside:avoid}.one-page .timeline-day-row{min-height:0!important}.timeline-day-row h2{font-size:${onePage ? Math.max(11, minText + 1) : Math.max(14, minText + 2)}px;padding-top:${onePage ? "3px" : "9px"}}.timeline-day-row h2 span{display:block;font-size:${microText}px;font-family:${fonts.body};opacity:.68;white-space:nowrap}.timeline-day-row>div{min-height:0;display:flex;flex-direction:column}.timeline-track{position:relative;flex:0 0 auto;min-height:0;border:1px solid ${dark ? "#334155" : "#d9dfd3"};background:${dark ? "rgba(15,23,42,.3)" : "#fbfbf8"};overflow:hidden}.timeline-track i{position:absolute;top:0;bottom:0;border-left:1px dashed ${dark ? "rgba(148,163,184,.22)" : "rgba(107,114,128,.25)"}}.timeline-bar{position:absolute;border:1px solid var(--block-color);border-left-width:${onePage ? "3px" : "5px"};border-radius:4px;background:${dark ? "#1f2937" : "color-mix(in srgb,var(--block-color) 18%,white)"};padding:${onePage ? "2px 3px" : "3px 6px"};box-sizing:border-box;overflow:hidden;font-size:${microText}px;line-height:1.1}.timeline-bar strong,.timeline-bar span,.timeline-bar em{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.timeline-bar em{color:#b42318;font-style:normal;font-weight:800}.timeline-call-details{display:grid;grid-template-columns:${onePage ? "repeat(2,minmax(0,1fr))" : "1fr"};gap:${onePage ? "2px" : "3px"};margin-top:${onePage ? "2px" : "5px"};font-size:${onePage ? tableText : minText}px;overflow:hidden}.timeline-call-details p{min-width:0;margin:0;padding:${onePage ? "2px 3px" : "4px 6px"};border-left:${onePage ? "2px" : "4px"} solid ${design.accentColor};background:${dark ? "rgba(31,41,55,.45)" : "rgba(255,255,255,.72)"};line-height:1.15}.timeline-call-details strong{white-space:nowrap}
    .actor-call-matrix{height:100%;font-size:${Math.max(8, minText - 1)}px;table-layout:fixed}.actor-call-matrix th:first-child{width:${onePage ? "1.08in" : "1.4in"}}.actor-call-matrix th{padding:${onePage ? "2px" : "5px"};height:${onePage ? "1.12in" : "1.4in"}}.actor-call-matrix .matrix-call-header{vertical-align:bottom;padding:2px;text-align:left}.matrix-call-time{display:inline-block;white-space:nowrap;writing-mode:vertical-rl;transform:rotate(180deg);font-weight:850;line-height:1.05}.actor-call-matrix th small{display:block;font-weight:700;opacity:.78;white-space:normal;line-height:1.08}.actor-call-matrix tbody tr{height:${onePage ? "calc((100% - 1.12in) / var(--actor-count))" : "auto"}}.actor-call-matrix td{height:${onePage ? "auto" : ".34in"};padding:${onePage ? "2px" : "5px"};text-align:center}.actor-call-matrix td:first-child{text-align:left;font-size:${Math.max(9, minText)}px;position:sticky;left:0;background:${dark ? "#101827" : "#fffefb"};z-index:1}.actor-call-matrix td:first-child small{display:block;opacity:.65}.called-cell{background:${dark ? "#1f2937" : "color-mix(in srgb," + design.accentColor + " 18%,white)"};color:${design.accentColor};font-weight:900}
    .run-strip-days{display:grid;grid-template-columns:repeat(${Math.max(1, dates.length)},minmax(0,1fr));gap:${onePage ? "4px" : "8px"};align-items:stretch;height:100%}.run-day-strip{min-width:0;border:1px solid ${dark ? "#334155" : "#d9dfd3"};background:${dark ? "rgba(31,41,55,.62)" : "color-mix(in srgb," + design.accentColor + " 8%,white)"};padding:${onePage ? "4px" : "8px"};overflow:hidden;break-inside:avoid}.run-strip-item{border-top:1px solid ${dark ? "#334155" : "#d9dfd3"};padding:${onePage ? "4px 0" : "8px 0 9px"};break-inside:avoid}.run-strip-item:first-of-type{border-top:0}.run-strip-item strong{display:block;font-size:${onePage ? Math.max(10, minText + 1) : Math.max(design.density < 35 ? 12 : 14, minText + 2)}px;line-height:1.1;color:var(--block-color)}.run-strip-item p{margin:${onePage ? "2px" : "4px"} 0 0;font-size:${onePage ? detailText : minText}px;line-height:1.18}.run-strip-item small,.run-strip-item em{display:block;margin-top:${onePage ? "1px" : "3px"};font-size:${microText}px;line-height:1.14}.run-strip-item em{color:#b42318;font-style:normal;font-weight:800}.run-time{font-size:${minText}px;font-weight:900;white-space:nowrap}.run-time span{display:block;font-size:${microText}px;opacity:.65}
    .call-row,.parent-call{display:grid;grid-template-columns:.95in 1fr .9in;gap:10px;align-items:center;border-bottom:1px solid ${dark ? "#334155" : "#d9dfd3"};padding:8px 0}.call-time{font-weight:900;color:${design.accentColor}}.call-time span{display:block;font-size:11px;opacity:.72}.call-main p{margin:2px 0}.call-main small,.parent-call small{display:block;opacity:.75}.call-room{text-align:right;font-weight:800}
    .worklist,.visual-board,.digital-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.work-card{border:1px solid ${dark ? "#334155" : "#d9dfd3"};padding:10px;break-inside:avoid}.work-card h2,.visual-day h2,.digital-day h2{color:${design.accentColor};margin-bottom:7px}.visual-day,.digital-day{break-inside:avoid;border:1px solid ${dark ? "#334155" : "#d9dfd3"};padding:9px}.visual-board .schedule-block,.digital-grid .schedule-block{min-height:.85in;margin-bottom:7px}.digital-grid .schedule-block{background:#1f2937;color:#f8fafc}.digitalDisplay .header{background:${design.primaryColor};color:white}
    .call-sheet-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}.call-sheet-summary div{border:1px solid ${design.primaryColor};padding:8px}.call-sheet-summary span{display:block;font-size:10px;text-transform:uppercase}.call-sheet-summary strong{font-size:18px}
    .parent-call{grid-template-columns:1.2in 1fr}.parent-call strong,.parent-call span{display:block}.parent-call p{margin:0;font-weight:800}
    .custom-export{display:grid;gap:20px}.custom-page{position:relative;display:flex;flex-direction:column;height:${page.height};overflow:hidden}.custom-canvas{position:relative;flex:1;height:100%;border:1px dashed ${dark ? "#334155" : "#d9dfd3"};overflow:hidden;background:${dark ? "rgba(15,23,42,.28)" : "rgba(250,250,247,.72)"}}.custom-scaffold{position:absolute;inset:0;font-size:${microText}px;color:${dark ? "#cbd5e1" : "#6b7280"}}.scaffold-date{position:absolute;top:3%;background:${dark ? "rgba(31,41,55,.92)" : "rgba(255,255,255,.9)"};padding:4px 6px;border-radius:3px;font-weight:900;text-transform:uppercase;white-space:nowrap}.scaffold-lane{position:absolute;top:10%;border-bottom:1px solid ${dark ? "#475569" : "#cfd6ca"};padding-bottom:3px;text-align:center;font-weight:800;white-space:nowrap}.scaffold-time{position:absolute;left:1%;right:1%;border-top:1px solid ${dark ? "rgba(71,85,105,.45)" : "rgba(156,163,175,.45)"}}.scaffold-time span{position:relative;top:-8px;background:${dark ? "rgba(31,41,55,.92)" : "rgba(255,255,255,.9)"};padding:1px 4px;border-radius:3px;font-weight:800;white-space:nowrap}.custom-cell{position:absolute;box-sizing:border-box;border:1px solid ${dark ? "#475569" : "#d4d8cf"};border-radius:4px;padding:6px;overflow:auto;z-index:2}.custom-cell-label{font-size:${microText}px;text-transform:uppercase;letter-spacing:.06em;opacity:.62;margin-bottom:3px}.custom-cell-value{line-height:1.25}.custom-cell-table{font-size:inherit;table-layout:fixed}.custom-cell-table th,.custom-cell-table td{padding:3px}.custom-list{display:grid;gap:5px;font-size:inherit}.custom-list div{border-bottom:1px solid ${dark ? "#334155" : "#d9dfd3"};padding-bottom:4px}.custom-list strong,.custom-list span,.custom-list small{display:block}.custom-card-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;font-size:inherit}.custom-card-list article{border-left:5px solid var(--block-color);background:${dark ? "#1f2937" : "rgba(255,255,255,.9)"};border-radius:6px;padding:6px}.custom-card-list strong,.custom-card-list span,.custom-card-list small{display:block}.custom-timeline{display:grid;gap:5px;border-left:2px solid ${design.accentColor};padding-left:8px;font-size:inherit}.custom-timeline div{display:grid;grid-template-columns:.7in 1fr;gap:8px}.custom-block{position:absolute;z-index:3;box-sizing:border-box;border-left:7px solid var(--block-color);background:${dark ? "#1f2937" : "#fff"};border-radius:8px;padding:${blockPad};overflow:hidden;border-top:1px solid ${dark ? "#334155" : "#e6e1d8"};border-right:1px solid ${dark ? "#334155" : "#e6e1d8"};border-bottom:1px solid ${dark ? "#334155" : "#e6e1d8"};break-inside:${design.avoidSplittingBlocks ? "avoid" : "auto"}}
    .custom-block.sharp{border-radius:0}.custom-block.sticky{background:#fff4bf;color:#2b241f;transform:rotate(-.2deg);box-shadow:2px 3px 0 rgba(0,0,0,.1)}.custom-block.outline{background:transparent;border:1px solid var(--block-color);border-left:7px solid var(--block-color)}.custom-block.filled{background:${dark ? "#1f2937" : "color-mix(in srgb,var(--block-color) 15%,white)"}}.custom-block.minimal{background:transparent;border-top:0;border-right:0;border-bottom:0;border-left:3px solid var(--block-color);padding-left:9px}
    footer,.schedule-footer{position:relative;flex:0 0 auto;min-height:${design.logoDataUrl && design.logoPosition.startsWith("footer") ? `${Math.max(24, Math.min(220, design.logoSize))}px` : "0"};border-top:1px solid ${dark ? "#334155" : "#d7d7d2"};margin-top:${onePage ? "4px" : "16px"};padding-top:${onePage ? "3px" : "8px"};font-size:${microText}px;opacity:.72;break-inside:avoid}.schedule-footer>span{display:block}.footer-logo{position:absolute;top:${onePage ? "3px" : "8px"}}.logo-footerLeft{left:0}.logo-footerCenter{left:50%;transform:translateX(-50%)}.logo-footerRight{right:0}
    @media screen and (max-width:1100px){.schedule-paper{zoom:.7}}
    @media screen and (max-width:700px){.schedule-paper{zoom:.48}}
    @media print{.no-print,nav,aside{display:none!important}html,body{margin:0;padding:0;background:white;width:100%;height:100%}.print-wrapper{position:relative;top:0;left:0;transform:none!important;box-shadow:none!important;page-break-before:avoid;page-break-after:avoid;page-break-inside:avoid}.schedule-paper{box-shadow:none;margin:0;break-after:page}.schedule-paper:last-child{break-after:auto}.schedule-block,.call-row,.parent-call,.work-card,.visual-day,.digital-day,.beat-day-card,.run-strip-item,.timeline-day-row,.grid-call-block,.key-item{break-inside:avoid}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}}
  `;
  const weeklyGridStyles = `
    /* The Weekly Grid is a self-contained schedule: called actors belong in
       the matching colored block, never in a space-consuming side legend. */
    .weekly-engine,.weekly-engine.has-call-key{grid-template-columns:minmax(0,1fr);flex:1 1 0;min-height:0}
    .weekly-engine .pro-grid{grid-template-columns:${onePage ? ".78in" : ".86in"} minmax(0,1fr);grid-template-rows:${gridHeaderHeight} minmax(0,1fr);contain:layout paint}
    .weekly-call-key{display:none!important}
    .grid-day-head{align-items:var(--day-cell-align,center);justify-items:center}
    .grid-call-block{display:flex;flex-direction:column;justify-content:var(--beat-cell-align,var(--cell-content-align,flex-start));padding:${densityPad};overflow:hidden;line-height:1.1;contain:layout paint}
    .grid-call-block strong{padding-right:15px;font-size:calc(var(--block-font-size, ${Math.max(8, Math.min(11.5, minText - 1 + densityRatio * 1.2))}px) + 1px);line-height:1.05;overflow-wrap:anywhere}
    .grid-call-block span{display:block}
    .grid-call-time{font-size:calc(var(--block-font-size, ${Math.max(8, Math.min(9.5, microText))}px) - 1px);font-weight:var(--time-weight,850);color:var(--block-color);white-space:normal;overflow-wrap:normal;text-align:var(--time-align,left)}
    .grid-call-room{font-size:calc(var(--block-font-size, ${gridDetailSize}px) - 1px);text-align:var(--actor-align,left);font-weight:750;opacity:.76;white-space:normal;overflow-wrap:anywhere}
    .grid-call-actors,.grid-call-detail{margin-top:${Math.round(1 + densityRatio * 2)}px;font-size:calc(var(--block-font-size, ${gridDetailSize}px) - 1px);line-height:1.08;text-align:var(--actor-align,left);overflow-wrap:anywhere}
    .grid-call-actors b{font-weight:var(--actor-weight,850)}
    .grid-call-detail{opacity:.8}
    .grid-call-block em{display:block;margin-top:1px;font-size:${Math.max(7, microText - .8)}px;line-height:1.1;color:#b42318;font-style:normal;font-weight:800;overflow-wrap:anywhere}
  `;
  const monochromeStyles = !design.useRehearsalTypeColors ? `
    .schedule-paper{background:#fff;color:#171717}.header{border-color:#171717}.header.ribbon,.header.banner{background:#f1f1f1!important;color:#171717!important}.grid-call-block,.beat-day-card,.mini-block,.schedule-block,.custom-block{background:#fff!important;border-color:#171717!important;border-left-color:#171717!important;color:#171717!important}.grid-call-number{background:#171717!important}.grid-day-heads,.grid-corner,th{background:#f1f1f1!important}.grid-time-axis,.grid-stage,.empty-cell{background:#fff!important}.grid-line,.grid-day-band{border-color:#d6d6d6!important}.grid-call-time,.block-time,.card-time,.run-time,.timeline-bar strong,.run-strip-item strong{color:#171717!important}
  ` : "";
  return `${baseStyles}${weeklyGridStyles}${monochromeStyles}`;
}

function layoutFor(block: ScheduledBlock, state: AppState, design: ScheduleDesignSettings, index = 0) {
  return design.customBlockLayouts[block.id] ?? {
    ...templateAwareLayout(block, state, design),
    y: templateAwareLayout(block, state, design).y + Math.floor(index / 80) * 2,
  };
}

function templateAwareLayout(block: ScheduledBlock, state: AppState, design: ScheduleDesignSettings) {
  const dates = customLayoutDates(state);
  const page = pageForDate(block.date, dates, design.customPageCount);
  const visibleDates = datesForPage(dates, page, design.customPageCount);
  const lanes = state.settings.lanes.slice(0, Math.max(1, state.settings.maxParallelBlocks));
  const range = customTimeRange(state);
  const dateIndex = Math.max(0, visibleDates.indexOf(block.date));
  const laneIndex = Math.max(0, lanes.indexOf(block.laneId));
  const dateWidth = 90 / Math.max(1, visibleDates.length);
  const laneWidth = dateWidth / Math.max(1, lanes.length);
  const start = timeToMinutes(range.start);
  const end = timeToMinutes(range.end);
  const total = Math.max(1, end - start);
  return {
    page,
    x: 5 + dateIndex * dateWidth + laneIndex * laneWidth + 0.35,
    y: 16 + ((timeToMinutes(block.startTime) - start) / total) * 78,
    width: Math.max(12, laneWidth - 0.7),
    height: Math.max(8, ((timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / total) * 78),
  };
}

function customLayoutDates(state: AppState) {
  const scheduledDates = sortedBlocks(state.scheduledBlocks).map((block) => block.date);
  const weekDates = scheduledDates.filter((date, index) => scheduledDates.indexOf(date) === index);
  return weekDates.length ? weekDates : [];
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

function pageSize(design: ScheduleDesignSettings) {
  const sizes = {
    letter: { portrait: ["8.5in", "11in"], landscape: ["11in", "8.5in"] },
    legal: { portrait: ["8.5in", "14in"], landscape: ["14in", "8.5in"] },
    a4: { portrait: ["8.27in", "11.69in"], landscape: ["11.69in", "8.27in"] },
  } as const;
  const [width, height] = sizes[design.paperSize][design.orientation];
  return { width, height };
}

function emptyState() {
  return `<section class="day-section"><h2>No scheduled blocks yet</h2><p>Build a calendar from the planner first.</p></section>`;
}

function templateById(id: ScheduleTemplate) {
  return scheduleTemplates.find((template) => template.id === id);
}

function groupBy<T, K extends keyof T>(items: T[], key: K) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const value = String(item[key]);
    groups[value] = [...(groups[value] ?? []), item];
    return groups;
  }, {});
}

function groupByValue<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function workType(block: ScheduledBlock, state: AppState) {
  const title = beatTitles(block, state).toLowerCase();
  if (title.includes("fight")) return "Fight";
  if (title.includes("music") || title.includes("song")) return "Music";
  if (title.includes("run") || title.includes("stumble")) return "Runs";
  if (title.includes("all")) return "Full Cast";
  return "Scene Work";
}

function blockFocus(block: ScheduledBlock, state: AppState) {
  if (block.customTitle && !block.beatIds.length) return block.customTitle;
  const notes = block.beatIds
    .map((beatId) => state.beats.find((beat) => beat.id === beatId)?.notes)
    .filter((note): note is string => Boolean(note));
  return unique(notes).join("; ") || workType(block, state);
}

export function iconForBlock(block: ScheduledBlock, state: AppState) {
  if (block.blockType === "break") return "Break:";
  if (block.blockType === "lunch") return "Lunch:";
  if (block.blockType === "custom") return "Call:";
  const type = workType(block, state);
  return `${type}:`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}
