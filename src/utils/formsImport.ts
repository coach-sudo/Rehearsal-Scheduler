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
  const availabilityColumns = headers
    .flatMap((header, index) => {
      const directGuess = guessAvailabilityColumn(header, state);
      if (directGuess) return [directGuess];
      const answerGuess = guessAnswerTextColumn(header, rows, index, state);
      return answerGuess ? [answerGuess] : [];
    })
    .filter((guess): guess is AvailabilityColumnGuess => Boolean(guess));
  const warnings = [
    !headers.length ? "No CSV headers found." : "",
    !nameColumn ? "No actor/name column was detected." : "",
    !availabilityColumns.length ? "No availability time-slot columns were detected. Put day and time in the question title or answer choices, such as Monday 3:00-3:30." : "",
  ].filter(Boolean);
  return { headers, rows, nameColumn, emailColumn, roleColumn, availabilityColumns, warnings };
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
      if (column.fromCellValues) {
        extractAvailabilityMentions(row[index], state, column.dayOfWeek).forEach((slot) => {
          const key = `${actor.id}|${slot.dayOfWeek}|${slot.startTime}`;
          const nextSlot: AvailabilitySlot = {
            actorId: actor.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            available: true,
          };
          const existingIndex = availability.findIndex((item) => `${item.actorId}|${item.dayOfWeek}|${item.startTime}` === key);
          if (existingIndex >= 0) availability[existingIndex] = nextSlot;
          else availability.push(nextSlot);
        });
        return;
      }

      if (column.dayOfWeek === undefined || !column.startTime) return;
      const status = valueToAvailability(row[index]);
      if (status === null) return;
      const block = getAvailabilityBlockForTime(column.startTime, state.settings.availabilityBlockMinutes);
      const key = `${actor.id}|${column.dayOfWeek}|${block.startTime}`;
      const nextSlot: AvailabilitySlot = {
        actorId: actor.id,
        dayOfWeek: column.dayOfWeek,
        startTime: block.startTime,
        endTime: addMinutes(block.startTime, state.settings.availabilityBlockMinutes),
        available: status,
      };
      const existingIndex = availability.findIndex((slot) => `${slot.actorId}|${slot.dayOfWeek}|${slot.startTime}` === key);
      if (existingIndex >= 0) availability[existingIndex] = nextSlot;
      else availability.push(nextSlot);
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

function extractAvailabilityMentions(value: string, state: AppState, fallbackDay?: DayOfWeek) {
  const parts = value.split(/[\n;,|]+/).map((part) => part.trim()).filter(Boolean);
  return parts.flatMap((part) => {
    const directGuess = guessAvailabilityColumn(part, state);
    if (directGuess?.dayOfWeek !== undefined && directGuess.startTime) {
      const block = getAvailabilityBlockForTime(directGuess.startTime, state.settings.availabilityBlockMinutes);
      return [{ dayOfWeek: directGuess.dayOfWeek, startTime: block.startTime, endTime: block.endTime }];
    }

    if (fallbackDay === undefined) return [];
    const timeMatches = [...part.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi)];
    if (!timeMatches.length) return [];
    const startTime = toTime(timeMatches[0][1], timeMatches[0][2], timeMatches[0][3], state);
    const endTime = timeMatches[1]
      ? toTime(timeMatches[1][1], timeMatches[1][2], timeMatches[1][3], state)
      : addMinutes(startTime, state.settings.availabilityBlockMinutes);
    const block = getAvailabilityBlockForTime(startTime, state.settings.availabilityBlockMinutes);
    return [{ dayOfWeek: fallbackDay, startTime: block.startTime, endTime: endTime > block.startTime ? endTime : block.endTime }];
  });
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
