import type { AppState, Beat, PlannerSelection, ScheduleLogEntry, ScheduledBlock } from "../types";
import { addMinutes, getWeekDates, id, overlaps, sameBeatSet, timeToMinutes } from "./time";
import { getBeatAvailability, isActorAvailable, isSlotBlocked } from "./availability";

export interface SchedulingConflict {
  actorId?: string;
  actorName?: string;
  reason: string;
}

export interface BeatConflictCheck {
  canSchedule: boolean;
  conflicts: SchedulingConflict[];
}

/**
 * One source of truth for planner validation. It deliberately allows several
 * beats in one lane (a combined rehearsal), while preventing an actor from
 * being called in two lanes at the same time.
 */
export function checkBeatConflicts(
  beat: Beat,
  date: string,
  startTime: string,
  endTime: string,
  laneId: string,
  state: AppState,
): BeatConflictCheck {
  const conflicts = new Map<string, SchedulingConflict>();
  const slotMinutes = state.settings.plannerSlotMinutes;

  for (let minute = timeToMinutes(startTime); minute < timeToMinutes(endTime); minute += slotMinutes) {
    const slotStart = addMinutes("00:00", minute);
    const slotEnd = addMinutes(slotStart, slotMinutes);
    if (isSlotBlocked(date, slotStart, slotEnd, laneId, state)) {
      conflicts.set(`blocked:${slotStart}`, { reason: "Blocked by a break, blackout, late start, or half day" });
      continue;
    }

    const availability = getBeatAvailability(beat.id, date, slotStart, state);
    if (!availability.canRehearse) {
      availability.missingActors.forEach((actor) => {
        conflicts.set(`availability:${actor.id}`, { actorId: actor.id, actorName: actor.name, reason: availability.overrideConflicts.some((item) => item.id === actor.id) ? "Unavailable override" : "Not available" });
      });
      const missingActorIds = beat.rosterActorIds.filter((actorId) => !state.actors.some((actor) => actor.id === actorId && actor.active));
      missingActorIds.forEach((actorId) => conflicts.set(`missing:${actorId}`, { actorId, reason: "Missing or inactive actor" }));
    }

    const laneCalls = state.plannerSelections
      .filter((selection) => selection.date === date && selection.startTime === slotStart && selection.laneId !== laneId)
      .flatMap((selection) => state.beats.find((candidate) => candidate.id === selection.beatId)?.rosterActorIds ?? []);
    const savedLaneCalls = state.scheduledBlocks
      .filter((block) => block.date === date && block.laneId !== laneId && overlaps(slotStart, slotEnd, block.startTime, block.endTime))
      .flatMap((block) => block.actorIds);
    const calledElsewhere = new Set([...laneCalls, ...savedLaneCalls]);
    beat.rosterActorIds
      .filter((actorId) => calledElsewhere.has(actorId))
      .forEach((actorId) => {
        const actor = state.actors.find((candidate) => candidate.id === actorId);
        conflicts.set(`lane:${actorId}`, { actorId, actorName: actor?.name, reason: "Called in another lane" });
      });
  }

  return { canSchedule: conflicts.size === 0, conflicts: [...conflicts.values()] };
}

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

  // A rehearsal is valid when each beat remains inside the director's allowed
  // absence limit. Do not label a permitted absence as a calendar conflict.
  if (block.beatIds.length) {
    for (const time of timeCursor) {
      block.beatIds.forEach((beatId) => {
        const availability = getBeatAvailability(beatId, block.date, time, state);
        if (availability.canRehearse) return;
        availability.missingActors.forEach((actor) => {
          const reason = availability.overrideConflicts.some((item) => item.id === actor.id) ? "unavailable override" : "not available";
          conflicts.add(`${actor.name}: ${reason}`);
        });
        const beat = state.beats.find((candidate) => candidate.id === beatId);
        beat?.rosterActorIds
          .filter((actorId) => !state.actors.some((actor) => actor.id === actorId && actor.active))
          .forEach((actorId) => conflicts.add(`${actorId}: missing or inactive actor`));
      });
    }
    return [...conflicts];
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
  // A saved schedule remains visible for review after it is logged. It should
  // not also count as an upcoming rehearsal, otherwise one session appears in
  // both totals.
  const loggedBlockIds = new Set(state.scheduleLog.map((entry) => entry.scheduledBlockId));
  const scheduledUpcomingCount = countBeatSessions(
    state.scheduledBlocks.filter((block) => block.beatIds.includes(beatId) && !loggedBlockIds.has(block.id))
  );
  const plannedTowardGoal = Math.min(target, rehearsedCount + scheduledUpcomingCount);
  return {
    rehearsedCount,
    remainingCount: Math.max(0, target - rehearsedCount),
    remainingAfterSchedule: Math.max(0, target - plannedTowardGoal),
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
