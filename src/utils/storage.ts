import type { AppState } from "../types";
import { demoState } from "../data/demoData";

export const STORAGE_KEY = "rehearsal-scheduler-state-v1";
export const SANDBOX_STORAGE_KEY = "rehearsal-scheduler-sandbox-state-v1";
export const SANDBOX_MODE_KEY = "rehearsal-scheduler-sandbox-mode";

export function loadState(storageKey = STORAGE_KEY): AppState {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return demoState;
  try {
    return normalizeState(JSON.parse(stored));
  } catch {
    return demoState;
  }
}

export function normalizeState(parsed: Partial<AppState>): AppState {
  const savedDesign = parsed.settings?.scheduleDesign;
  const migratedFromEarlierFitBehavior = !savedDesign?.fitBehaviorVersion || savedDesign.fitBehaviorVersion < 4;
  const migratedFromEarlierDesignSystem = !savedDesign?.designSystemVersion || savedDesign.designSystemVersion < 3;
  const isSupportedTemplate = savedDesign?.template === "weeklyGrid" || savedDesign?.template === "beatCardsByDay";
  const template = isSupportedTemplate ? savedDesign!.template : "beatCardsByDay";
  return {
    ...demoState,
    ...parsed,
    actorGroups: parsed.actorGroups ?? demoState.actorGroups,
    plannerBlockouts: (parsed.plannerBlockouts ?? demoState.plannerBlockouts).map((blockout) => ({
      ...blockout,
      includeInSchedule: blockout.includeInSchedule ?? (["break", "lunch", "custom"].includes(String(blockout.type))),
    })),
    settings: {
      ...demoState.settings,
      ...(parsed.settings ?? {}),
      scheduleDesign: {
        ...demoState.settings.scheduleDesign,
        ...(savedDesign ?? {}),
        // Earlier releases could hide text while forcing a page. Move those
        // saved designs to readable pagination once, then preserve choices.
        template,
        renderMode: template === "weeklyGrid" ? "weeklyGrid" : "beatCardsByDay",
        customLayoutEnabled: false,
        paginationMode: migratedFromEarlierFitBehavior || migratedFromEarlierDesignSystem ? "preferOnePage" : savedDesign?.paginationMode ?? demoState.settings.scheduleDesign.paginationMode,
        fitBehaviorVersion: 4,
        designSystemVersion: 3,
        customCells: savedDesign?.customCells ?? demoState.settings.scheduleDesign.customCells,
      },
    },
  };
}

export function saveState(state: AppState, storageKey = STORAGE_KEY): void {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

export function exportState(state: AppState): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), app: "Rehearsal Scheduler", state }, null, 2);
}

export function importState(payload: string): AppState {
  const parsed = JSON.parse(payload);
  return parsed.state ?? parsed;
}

export function resetState(storageKey = STORAGE_KEY): AppState {
  localStorage.removeItem(storageKey);
  return demoState;
}

export function createBlankState(): AppState {
  return {
    actors: [],
    actorGroups: [],
    availability: [],
    beats: [{ id: "beat_all", title: "All", rosterActorIds: [], targetRehearsalCount: 3 }],
    characterMap: [],
    overrides: [],
    plannerBlockouts: [],
    plannerSelections: [],
    scheduledBlocks: [],
    scheduleLog: [],
    settings: {
      ...demoState.settings,
      playTitle: "Untitled Play",
      weekStartDate: demoState.settings.weekStartDate,
      scheduleDesign: {
        ...demoState.settings.scheduleDesign,
        logoDataUrl: undefined,
        rehearsalNotes: "",
        emergencyContact: "",
        footerText: "",
        customBlockLayouts: {},
        customCells: [],
      },
    },
  };
}
