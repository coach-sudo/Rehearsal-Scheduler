export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Actor {
  id: string;
  name: string;
  email?: string;
  notes?: string;
  photoDataUrl?: string;
  active: boolean;
}

export interface ActorGroup {
  id: string;
  name: string;
  actorIds: string[];
  notes?: string;
}

export interface AvailabilitySlot {
  actorId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface Beat {
  id: string;
  title: string;
  rosterActorIds: string[];
  notes?: string;
  targetRehearsalCount: number;
}

export interface CharacterMap {
  actorId: string;
  characterName: string;
}

export interface Override {
  id: string;
  actorId: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "unavailable" | "available";
  notes?: string;
}

export interface PlannerSelection {
  date: string;
  startTime: string;
  laneId: string;
  beatId: string;
}

export interface PlannerBlockout {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  laneId?: string;
  type: "break" | "lunch" | "custom" | "blackout" | "lateStart" | "halfDay";
  title: string;
  location?: string;
  actorIds?: string[];
  includeInSchedule?: boolean;
  notes?: string;
}

export interface ScheduledBlock {
  id: string;
  weekId: string;
  date: string;
  startTime: string;
  endTime: string;
  laneId: string;
  beatIds: string[];
  actorIds: string[];
  conflicts: string[];
  customTitle?: string;
  location?: string;
  blockType?: PlannerBlockout["type"];
  createdAt: string;
}

export interface ScheduleLogEntry {
  id: string;
  scheduledBlockId: string;
  beatId: string;
  date: string;
  startTime: string;
  endTime: string;
  laneId: string;
  actorIds: string[];
  conflicts: string[];
  createdAt: string;
}

export interface Settings {
  playTitle: string;
  rehearsalStartTime: string;
  rehearsalEndTime: string;
  plannerSlotMinutes: number;
  availabilityBlockMinutes: number;
  maxAbsencesAllowed: number;
  maxParallelBlocks: number;
  lanes: string[];
  weekStartDate: string;
  scheduleExportFormat: "director" | "compact" | "cast";
  scheduleExportIncludeActors: boolean;
  scheduleExportIncludeCharacters: boolean;
  scheduleExportIncludeConflicts: boolean;
  scheduleDesign: ScheduleDesignSettings;
}

export type ScheduleTemplate =
  | "beatCardsByDay"
  | "horizontalTimeline"
  | "actorCallMatrix"
  | "runOfDayStrip"
  | "clean"
  | "custom"
  | "weeklyGrid"
  | "roomBoard"
  | "ink"
  | "callSheet"
  | "actorFriendly"
  | "directorWorklist"
  | "visualBoard"
  | "parentFriendly"
  | "digital"
  | "vintage";

export type FontPairing = "classic" | "theatrical" | "modern" | "film" | "youth";
export type BlockStyle = "rounded" | "sharp" | "sticky" | "outline" | "filled" | "minimal";
export type HeaderStyle = "simple" | "marquee" | "callsheet" | "banner" | "divider" | "ribbon";
export type ScheduleLayout = "stacked" | "timeline" | "cards" | "grid" | "matrix" | "table" | "calls";
export type RenderMode = "dayStack" | "weeklyGrid" | "roomBoard" | "denseTable";
export type ScheduleRenderMode =
  | "beatCardsByDay"
  | "horizontalTimeline"
  | "actorCallMatrix"
  | "runOfDayStrip"
  | "dayStack"
  | "weeklyGrid"
  | "roomBoard"
  | "roomMatrix"
  | "actorCallSheet"
  | "directorWorklist"
  | "denseTable"
  | "formalCallSheet"
  | "visualBoard"
  | "parentFriendly"
  | "digitalDisplay";
export type PaperSize = "letter" | "legal" | "a4";
export type PrintOrientation = "portrait" | "landscape";
export type PrintSpacing = "compact" | "comfortable" | "large";
export type SchedulePaginationMode = "readableAuto" | "preferOnePage" | "forceTwoPages";
export type ScheduleTextAlign = "left" | "center" | "right";
export type ScheduleVerticalAlign = "top" | "center" | "bottom";
export type CardTimePlacement = "top" | "leftRail";
export type LogoPosition = "topLeft" | "topCenter" | "topRight" | "footerLeft" | "footerCenter" | "footerRight";
export type DirectorContactPlacement = "none" | "header" | "footer";

export interface DirectorScheduleContact {
  name: string;
  contact: string;
}

export interface ScheduleDesignSettings {
  template: ScheduleTemplate;
  customDesignName: string;
  renderMode: ScheduleRenderMode;
  primaryColor: string;
  accentColor: string;
  sceneColor: string;
  fightColor: string;
  musicColor: string;
  runColor: string;
  useRehearsalTypeColors: boolean;
  fontPairing: FontPairing;
  blockStyle: BlockStyle;
  density: number;
  showActorNames: boolean;
  showCharacterNames: boolean;
  showRoom: boolean;
  showConflicts: boolean;
  showNotes: boolean;
  showIcons: boolean;
  showDurations: boolean;
  showLaneNames: boolean;
  showRehearsalNumbers: boolean;
  headerStyle: HeaderStyle;
  headerLabel: string;
  logoDataUrl?: string;
  logoPosition: LogoPosition;
  logoSize: number;
  logoX: number;
  logoY: number;
  directorName: string;
  directorContact: string;
  directors: DirectorScheduleContact[];
  directorContactPlacement: DirectorContactPlacement;
  rehearsalNotes: string;
  emergencyContact: string;
  footerText: string;
  timeFormat: "12" | "24";
  layout: ScheduleLayout;
  paperSize: PaperSize;
  orientation: PrintOrientation;
  spacing: PrintSpacing;
  paginationMode: SchedulePaginationMode;
  fitBehaviorVersion: number;
  designSystemVersion: number;
  minimumTextSize: number;
  timeTextAlign: ScheduleTextAlign;
  workTextAlign: ScheduleTextAlign;
  actorTextAlign: ScheduleTextAlign;
  cellContentVerticalAlign: ScheduleVerticalAlign;
  dayCellVerticalAlign: ScheduleVerticalAlign;
  timeCellVerticalAlign: ScheduleVerticalAlign;
  beatCellVerticalAlign: ScheduleVerticalAlign;
  boldTimes: boolean;
  boldWork: boolean;
  boldActorNames: boolean;
  cardTimePlacement: CardTimePlacement;
  calledLabel: string;
  roomLabel: string;
  charactersLabel: string;
  notesLabel: string;
  conflictsLabel: string;
  weekLabel: string;
  timeLabel: string;
  workLabel: string;
  actorsLabel: string;
  keepDaysTogether: boolean;
  avoidSplittingBlocks: boolean;
  customLayoutEnabled: boolean;
  customPageCount: 1 | 2;
  customCanvasZoom: number;
  snapToGrid: boolean;
  customShowBlockCards: boolean;
  customScheduleStyle: "table" | "list" | "cards" | "timeline";
  customBlockLayouts: Record<string, CustomBlockLayout>;
  blockTextSizes: Record<string, number>;
  customCells: ScheduleDesignCell[];
}

export interface CustomBlockLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  page: 1 | 2;
}

export type ScheduleDesignPlaceholder =
  | "playTitle"
  | "week"
  | "scheduleTable"
  | "castList"
  | "directorNotes"
  | "emergencyContact"
  | "footerText"
  | "date"
  | "time"
  | "beat"
  | "room"
  | "actors"
  | "characters";

export interface ScheduleDesignCell {
  id: string;
  placeholder: ScheduleDesignPlaceholder;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: 1 | 2;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  bold?: boolean;
}

export interface BeatAvailability {
  beatId: string;
  canRehearse: boolean;
  missingCount: number;
  missingActors: Actor[];
  overrideConflicts: Actor[];
  rosterSize: number;
  reason: string;
}

export interface AppState {
  actors: Actor[];
  actorGroups: ActorGroup[];
  availability: AvailabilitySlot[];
  beats: Beat[];
  characterMap: CharacterMap[];
  overrides: Override[];
  plannerBlockouts: PlannerBlockout[];
  plannerSelections: PlannerSelection[];
  scheduledBlocks: ScheduledBlock[];
  scheduleLog: ScheduleLogEntry[];
  settings: Settings;
}
