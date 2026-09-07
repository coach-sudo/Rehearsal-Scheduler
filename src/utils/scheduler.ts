import type { AppState, PlannerSelection, ScheduleLogEntry, ScheduledBlock } from "../types";
import { addMinutes, getWeekDates, id, overlaps, sameBeatSet, timeToMinutes } from "./time";
import { isActorAvailable } from "./availability";

export function getUniqueActorsForBeats(beatIds: string[], state: Pick<AppState, "beats">): string[] {
  const actorIds = new Set<string>();
  beatIds.forEach((beatId) => {
    const beat = state.beats.find((candidate) => candidate.id === beatId);
    beat?.rosterActorIds.forEach((actorId) => actorIds.add(actorId));
  });
  return [...actorIds];
}

export function mergePlannerSelections(selections: PlannerSelection[], state: AppState, weekId = state.settings.weekStartDate): ScheduledBlock[] {
  const bySlot = new Map<string, PlannerSelection[]>();
  selections.forEach((selection) => {
    const key = `${selection.date}|${selection.laneId}|${selection.startTime}`;
    bySlot.set(key, [...(bySlot.get(key) ?? []), selection]);
  });

  const grouped = [...bySlot.entries()]
    .map(([key, entries]) => {
      const [date, laneId, startTime] = key.split("|");
      return {
        date,
        laneId,
        startTime,
        beatIds: [...new Set(entries.map((entry) => entry.beatId))].sort(),
      };
    })
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      a.laneId.localeCompare(b.laneId) ||
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );

  const blocks: ScheduledBlock[] = [];
  for (const slot of grouped) {
    const last = blocks[blocks.length - 1];
    const shouldMerge =
      last &&
      last.date === slot.date &&
      last.laneId === slot.laneId &&
      last.endTime === slot.startTime &&
      sameBeatSet(last.beatIds, slot.beatIds);

    if (shouldMerge) {
      last.endTime = addMinutes(slot.startTime, state.settings.plannerSlotMinutes);
      last.actorIds = getUniqueActorsForBeats(last.beatIds, state);
      last.conflicts = getBlockConflicts(last, state);
    } else {
      const block: ScheduledBlock = {
        id: id("block"),
        weekId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: addMinutes(slot.startTime, state.settings.plannerSlotMinutes),
        laneId: slot.laneId,
        beatIds: slot.beatIds,
        actorIds: getUniqueActorsForBeats(slot.beatIds, state),
        conflicts: [],
        createdAt: new Date().toISOString(),
      };
      block.conflicts = getBlockConflicts(block, state);
      blocks.push(block);
    }
  }
  return addLaneConflicts([...blocks, ...scheduledBlockouts(state, weekId)], state);
}

export function getBlockConflicts(block: ScheduledBlock, state: AppState): string[] {
  if (block.blockType === "break" || block.blockType === "lunch") return [];
  const conflicts = new Set<string>();
  const timeCursor: string[] = [];
  for (let minute = timeToMinutes(block.startTime); minute < timeToMinutes(block.endTime); minute += state.settings.plannerSlotMinutes) {
    timeCursor.push(addMinutes("00:00", minute));
  }

  block.actorIds.forEach((actorId) => {
    const actor = state.actors.find((candidate) => candidate.id === actorId);
    const isMissing = timeCursor.some((time) => !isActorAvailable(actorId, block.date, time, state, { ignoreScheduledCalls: block.blockType === "custom" }));
    if (isMissing) conflicts.add(actor?.name ? `${actor.name}: unavailable or overridden` : `${actorId}: missing actor`);
  });
  return [...conflicts];
}

export function createLogEntries(blocks: ScheduledBlock[]): ScheduleLogEntry[] {
  return blocks.flatMap((block) =>
    block.beatIds.map((beatId) => ({
      id: id("log"),
      scheduledBlockId: block.id,
      beatId,
      date: block.date,
      startTime: block.startTime,
      endTime: block.endTime,
      laneId: block.laneId,
      actorIds: block.actorIds,
      conflicts: block.conflicts,
      createdAt: new Date().toISOString(),
    }))
  );
}

function scheduledBlockouts(state: AppState, weekId: string): ScheduledBlock[] {
  const weekDates = new Set(getWeekDates(weekId));
  return state.plannerBlockouts
    .filter((blockout) => weekDates.has(blockout.date) && blockout.includeInSchedule && ["break", "lunch", "custom"].includes(blockout.type))
    .map((blockout) => {
      const actorIds = blockout.actorIds?.length ? blockout.actorIds : state.actors.filter((actor) => actor.active).map((actor) => actor.id);
      const block: ScheduledBlock = {
        id: blockout.id,
        weekId,
        date: blockout.date,
        startTime: blockout.startTime,
        endTime: blockout.endTime,
        laneId: blockout.location || blockout.laneId || "Company",
        beatIds: [],
        actorIds,
        conflicts: [],
        customTitle: blockout.title,
        location: blockout.location,
        blockType: blockout.type,
        createdAt: new Date().toISOString(),
      };
      block.conflicts = getBlockConflicts(block, state);
      return block;
    });
}

function addLaneConflicts(blocks: ScheduledBlock[], state: AppState): ScheduledBlock[] {
  return blocks.map((block) => {
    const conflicts = new Set(block.conflicts);
    blocks
      .filter((other) => other.id !== block.id && other.date === block.date && other.laneId !== block.laneId && overlaps(block.startTime, block.endTime, other.startTime, other.endTime))
      .forEach((other) => {
        block.actorIds
          .filter((actorId) => other.actorIds.includes(actorId))
          .forEach((actorId) => {
            const name = state.actors.find((actor) => actor.id === actorId)?.name ?? actorId;
            conflicts.add(`${name}: booked in another lane`);
          });
      });
    return { ...block, conflicts: [...conflicts] };
  });
}

export function getBeatProgress(beatId: string, state: AppState) {
  const beat = state.beats.find((candidate) => candidate.id === beatId);
  const entries = state.scheduleLog.filter((entry) => entry.beatId === beatId);
  const rehearsedCount = countBeatSessions(entries);
  const target = beat?.targetRehearsalCount ?? 3;
  const dates = entries.map((entry) => entry.date).sort();
  const lastRehearsedDate = dates[dates.length - 1];
  const scheduledUpcomingCount = countBeatSessions(state.scheduledBlocks.filter((block) => block.beatIds.includes(beatId)));
  return {
    rehearsedCount,
    remainingCount: Math.max(0, target - rehearsedCount),
    lastRehearsedDate,
    scheduledUpcomingCount,
    status: rehearsedCount === 0 ? "Not started" : rehearsedCount >= target ? "Done" : "In progress",
  };
}

function countBeatSessions(blocks: Array<Pick<ScheduledBlock | ScheduleLogEntry, "date" | "startTime" | "endTime" | "laneId">>) {
  const sorted = [...blocks].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
    timeToMinutes(a.endTime) - timeToMinutes(b.endTime) ||
    a.laneId.localeCompare(b.laneId)
  );
  let count = 0;
  let currentSession: Pick<ScheduledBlock | ScheduleLogEntry, "date" | "startTime" | "endTime" | "laneId"> | undefined;
  sorted.forEach((entry) => {
    // One continuous rehearsal window is one rehearsal, even if it was
    // assembled from overlapping planner blocks or moved between lanes.
    const session = currentSession;
    const continuesSession =
      session &&
      session.date === entry.date &&
      timeToMinutes(entry.startTime) <= timeToMinutes(session.endTime);
    if (!continuesSession) {
      count += 1;
      currentSession = entry;
    } else if (timeToMinutes(entry.endTime) > timeToMinutes(session.endTime)) {
      currentSession = entry;
    }
  });
  return count;
}
