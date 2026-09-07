import type { AppState, AvailabilitySlot, DayOfWeek } from "../types";
import { addMinutes, getAvailabilityBlockForTime, id } from "./time";

export interface FormsImportGuess {
  headers: string[];
  rows: string[][];
  nameColumn: string;
  emailColumn: string;
  roleColumn: string;
  availabilityColumns: AvailabilityColumnGuess[];
  warnings: string[];
}

export interface AvailabilityColumnGuess {
  header: string;
  dayOfWeek?: DayOfWeek;
  startTime?: string;
  endTime?: string;
  fromCellValues?: boolean;
  fromRangePair?: boolean;
  endHeader?: string;
}

const dayPatterns: Array<[DayOfWeek, RegExp]> = [
  [0, /\b(sun|sunday)\b/i],
  [1, /\b(mon|monday)\b/i],
  [2, /\b(tue|tues|tuesday)\b/i],
  [3, /\b(wed|weds|wednesday)\b/i],
  [4, /\b(thu|thur|thurs|thursday)\b/i],
  [5, /\b(fri|friday)\b/i],
  [6, /\b(sat|saturday)\b/i],
];

export function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

// Google Forms exports are CSV, while copied Google Sheets ranges are usually
// tab-separated. Supporting both makes imports work from either workflow.
function detectDelimiter(text: string): "," | "\t" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let commas = 0;
  let tabs = 0;
  let quoted = false;
  for (let index = 0; index < firstLine.length; index += 1) {
    const character = firstLine[index];
    const next = firstLine[index + 1];
    if (character === '"' && quoted && next === '"') {
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ",") {
      commas += 1;
    } else if (!quoted && character === "\t") {
      tabs += 1;
    }
  }
  return tabs > commas ? "\t" : ",";
}

export function guessFormsImport(csvText: string, state: AppState): FormsImportGuess {
  const [headers = [], ...rows] = parseCsv(csvText);
  const normalized = headers.map((header) => header.toLowerCase());
  const nameColumn = findHeader(headers, normalized, ["full name", "actor name", "student name", "performer", "name"]) ?? headers[0] ?? "";
  const emailColumn = findHeader(headers, normalized, ["email address", "email", "e-mail"]) ?? "";
  const roleColumn = findHeader(headers, normalized, ["role", "character", "part"]) ?? "";
  const inferredColumns = headers
    .flatMap((header, index) => {
      const directGuess = guessAvailabilityColumn(header, state);
      if (directGuess) return [directGuess];
      const answerGuess = guessAnswerTextColumn(header, rows, index, state);
      return answerGuess ? [answerGuess] : [];
    })
    .filter((guess): guess is AvailabilityColumnGuess => Boolean(guess));
  // When a question title names a slot and its answers also contain ranges,
  // prefer the answers. Checkbox-grid exports commonly take this shape.
  const availabilityColumns = inferredColumns.map((column) => {
    const index = headers.indexOf(column.header);
    return guessAnswerTextColumn(column.header, rows, index, state) ?? column;
  });
  const pairedRangeColumns = guessRangePairColumns(headers, rows, state);
  const allAvailabilityColumns = [...availabilityColumns, ...pairedRangeColumns.filter((pair) => !availabilityColumns.some((column) => column.header === pair.header))];
  const warnings = [
    !headers.length ? "No CSV headers found." : "",
    !nameColumn ? "No actor/name column was detected." : "",
    !allAvailabilityColumns.length ? "No availability time-slot columns were detected. Put day and time in the question title or answer choices, such as Monday 3:00-3:30." : "",
  ].filter(Boolean);
  return { headers, rows, nameColumn, emailColumn, roleColumn, availabilityColumns: allAvailabilityColumns, warnings };
}

export function applyFormsImport(csvText: string, state: AppState, mapping: Pick<FormsImportGuess, "nameColumn" | "emailColumn" | "roleColumn" | "availabilityColumns">): AppState {
  const [headers = [], ...rows] = parseCsv(csvText);
  const nameIndex = headers.indexOf(mapping.nameColumn);
  const emailIndex = headers.indexOf(mapping.emailColumn);
  const roleIndex = headers.indexOf(mapping.roleColumn);
  const availabilityIndexes = mapping.availabilityColumns
    .map((column) => ({ column, index: headers.indexOf(column.header) }))
    .filter((item) => item.index >= 0);

  const actors = [...state.actors];
  const characterMap = [...state.characterMap];
  const availability = [...state.availability];
  const allBeat = state.beats.find((beat) => beat.id === "beat_all");
  const allRoster = new Set(allBeat?.rosterActorIds ?? []);

  rows.forEach((row) => {
    const actorName = row[nameIndex]?.trim();
    if (!actorName) return;
    let actor = actors.find((candidate) => candidate.name.trim().toLowerCase() === actorName.toLowerCase());
    if (!actor) {
      actor = { id: id("actor"), name: actorName, active: true };
      actors.push(actor);
    }
    if (emailIndex >= 0 && row[emailIndex]) actor.email = row[emailIndex].trim();
    if (roleIndex >= 0 && row[roleIndex]) {
      const characterName = row[roleIndex].trim();
      const existingIndex = characterMap.findIndex((item) => item.actorId === actor.id);
      if (existingIndex >= 0) characterMap[existingIndex] = { actorId: actor.id, characterName };
      else characterMap.push({ actorId: actor.id, characterName });
    }
    allRoster.add(actor.id);

    availabilityIndexes.forEach(({ column, index }) => {
      if (column.fromRangePair && column.dayOfWeek !== undefined && column.endHeader) {
        const endIndex = headers.indexOf(column.endHeader);
        const startTime = parseTimeValue(row[index] ?? "", state);
        const endTime = parseTimeValue(row[endIndex] ?? "", state);
        if (!startTime || !endTime || endTime <= startTime) return;
        availabilitySlotsForRange(column.dayOfWeek, startTime, endTime, state).forEach((slot) => {
          writeAvailabilitySlot(availability, actor.id, slot.dayOfWeek, slot.startTime, slot.endTime, true);
        });
        return;
      }

      if (column.fromCellValues) {
        extractAvailabilityMentions(row[index], state, column.dayOfWeek).forEach((slot) => {
          writeAvailabilitySlot(availability, actor.id, slot.dayOfWeek, slot.startTime, slot.endTime, true);
        });
        return;
      }

      if (column.dayOfWeek === undefined || !column.startTime) return;
      const status = valueToAvailability(row[index]);
      if (status === null) return;
      availabilitySlotsForRange(column.dayOfWeek, column.startTime, column.endTime ?? addMinutes(column.startTime, state.settings.availabilityBlockMinutes), state)
        .forEach((slot) => writeAvailabilitySlot(availability, actor.id, slot.dayOfWeek, slot.startTime, slot.endTime, status));
    });
  });

  return {
    ...state,
    actors,
    characterMap,
    availability,
    beats: state.beats.map((beat) => beat.id === "beat_all" ? { ...beat, rosterActorIds: [...allRoster] } : beat),
  };
}

function findHeader(headers: string[], normalized: string[], candidates: string[]) {
  const exactIndex = normalized.findIndex((header) => candidates.includes(header));
  if (exactIndex >= 0) return headers[exactIndex];
  const looseIndex = normalized.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
  return looseIndex >= 0 ? headers[looseIndex] : undefined;
}

function guessAvailabilityColumn(header: string, state: AppState): AvailabilityColumnGuess | null {
  const day = dayPatterns.find(([, pattern]) => pattern.test(header));
  if (!day) return null;
  const times = [...header.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi)].map((match) => toTime(match[1], match[2], match[3], state));
  if (!times.length) return null;
  const startTime = times[0];
  const endTime = times[1] ?? addMinutes(startTime, state.settings.availabilityBlockMinutes);
  return { header, dayOfWeek: day[0], startTime, endTime, fromCellValues: false };
}

function guessAnswerTextColumn(header: string, rows: string[][], columnIndex: number, state: AppState): AvailabilityColumnGuess | null {
  const headerDay = dayPatterns.find(([, pattern]) => pattern.test(header))?.[0];
  const hasSlotAnswers = rows.some((row) => extractAvailabilityMentions(row[columnIndex] ?? "", state, headerDay).length > 0);
  return hasSlotAnswers ? { header, dayOfWeek: headerDay, fromCellValues: true } : null;
}

function guessRangePairColumns(headers: string[], rows: string[][], state: AppState): AvailabilityColumnGuess[] {
  return dayPatterns.flatMap(([dayOfWeek, pattern]) => {
    const dayHeaders = headers.filter((header) => pattern.test(header));
    const startHeader = dayHeaders.find((header) => /\b(start|from|arrival)\b/i.test(header));
    const endHeader = dayHeaders.find((header) => /\b(end|until|departure)\b/i.test(header));
    if (!startHeader || !endHeader) return [];
    const startIndex = headers.indexOf(startHeader);
    const endIndex = headers.indexOf(endHeader);
    const hasRange = rows.some((row) => {
      const start = parseTimeValue(row[startIndex] ?? "", state);
      const end = parseTimeValue(row[endIndex] ?? "", state);
      return Boolean(start && end && end > start);
    });
    return hasRange ? [{ header: startHeader, dayOfWeek, fromRangePair: true, endHeader }] : [];
  });
}

function extractAvailabilityMentions(value: string, state: AppState, fallbackDay?: DayOfWeek) {
  const parts = value.split(/[\n;,|]+/).map((part) => part.trim()).filter(Boolean);
  return parts.flatMap((part) => {
    const directGuess = guessAvailabilityColumn(part, state);
    if (directGuess?.dayOfWeek !== undefined && directGuess.startTime) {
      return availabilitySlotsForRange(directGuess.dayOfWeek, directGuess.startTime, directGuess.endTime ?? addMinutes(directGuess.startTime, state.settings.availabilityBlockMinutes), state);
    }

    if (fallbackDay === undefined) return [];
    const timeMatches = [...part.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi)];
    if (!timeMatches.length) return [];
    const startTime = toTime(timeMatches[0][1], timeMatches[0][2], timeMatches[0][3], state);
    const endTime = timeMatches[1]
      ? toTime(timeMatches[1][1], timeMatches[1][2], timeMatches[1][3], state)
      : addMinutes(startTime, state.settings.availabilityBlockMinutes);
    return availabilitySlotsForRange(fallbackDay, startTime, endTime > startTime ? endTime : addMinutes(startTime, state.settings.availabilityBlockMinutes), state);
  });
}

function availabilitySlotsForRange(dayOfWeek: DayOfWeek, startTime: string, endTime: string, state: AppState) {
  const first = getAvailabilityBlockForTime(startTime, state.settings.availabilityBlockMinutes).startTime;
  const slots: Array<{ dayOfWeek: DayOfWeek; startTime: string; endTime: string }> = [];
  for (let cursor = first; cursor < endTime; cursor = addMinutes(cursor, state.settings.availabilityBlockMinutes)) {
    slots.push({ dayOfWeek, startTime: cursor, endTime: addMinutes(cursor, state.settings.availabilityBlockMinutes) });
  }
  return slots;
}

function writeAvailabilitySlot(availability: AvailabilitySlot[], actorId: string, dayOfWeek: DayOfWeek, startTime: string, endTime: string, available: boolean) {
  const key = `${actorId}|${dayOfWeek}|${startTime}`;
  const nextSlot: AvailabilitySlot = { actorId, dayOfWeek, startTime, endTime, available };
  const existingIndex = availability.findIndex((slot) => `${slot.actorId}|${slot.dayOfWeek}|${slot.startTime}` === key);
  if (existingIndex >= 0) availability[existingIndex] = nextSlot;
  else availability.push(nextSlot);
}

function parseTimeValue(value: string, state: AppState) {
  const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  return match ? toTime(match[1], match[2], match[3], state) : undefined;
}

function toTime(hourText: string, minuteText = "00", meridiem: string | undefined, state: AppState) {
  let hour = Number(hourText);
  const minute = Number(minuteText);
  const marker = meridiem?.toLowerCase();
  if (marker === "pm" && hour < 12) hour += 12;
  if (marker === "am" && hour === 12) hour = 0;
  if (!marker) {
    const entered = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const pmHour = hour < 12 ? hour + 12 : hour;
    const pmCandidate = `${String(pmHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (!timeFitsRehearsalWindow(entered, state) && timeFitsRehearsalWindow(pmCandidate, state)) {
      hour = pmHour;
    }
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function timeFitsRehearsalWindow(time: string, state: AppState) {
  return time >= state.settings.rehearsalStartTime && time < state.settings.rehearsalEndTime;
}

function valueToAvailability(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (/^(yes|y|available|avail|true|1|can|free|ok|okay|x|✓|checked)$/i.test(normalized)) return true;
  if (/^(no|n|unavailable|not available|false|0|cannot|can't|busy|conflict)$/i.test(normalized)) return false;
  if (normalized.includes("available") && !normalized.includes("not")) return true;
  if (normalized.includes("conflict") || normalized.includes("busy") || normalized.includes("not available")) return false;
  return null;
}
