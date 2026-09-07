import type { Actor, AppState, BeatAvailability, Override } from "../types";
import { addMinutes, getAvailabilityBlockForTime, getDayOfWeek, overlaps } from "./time";

export function getActorOverrideStatus(
  actorId: string,
  date: string,
  startTime: string,
  endTime: string,
  overrides: Override[]
): Override | undefined {
  return overrides.find(
    (override) =>
      override.actorId === actorId &&
      override.date === date &&
      overlaps(override.startTime, override.endTime, startTime, endTime)
  );
}

export function isActorAvailable(actorId: string, date: string, startTime: string, state: AppState, options: { ignoreScheduledCalls?: boolean } = {}): boolean {
  const actor = state.actors.find((candidate) => candidate.id === actorId && candidate.active);
  if (!actor) return false;

  const endTime = addMinutes(startTime, state.settings.plannerSlotMinutes);
  const override = getActorOverrideStatus(actorId, date, startTime, endTime, state.overrides);
  if (override?.type === "unavailable") return false;
  if (override?.type === "available") return true;

  if (!options.ignoreScheduledCalls) {
    const actorCall = state.plannerBlockouts.find(
      (blockout) =>
        blockout.includeInSchedule &&
        ["break", "lunch", "custom"].includes(blockout.type) &&
        blockout.date === date &&
        (!blockout.actorIds?.length || blockout.actorIds.includes(actorId)) &&
        overlaps(blockout.startTime, blockout.endTime, startTime, endTime)
    );
    if (actorCall) return false;
  }

  const block = getAvailabilityBlockForTime(startTime, state.settings.availabilityBlockMinutes);
  const dayOfWeek = getDayOfWeek(date);
  const slot = state.availability.find(
    (entry) =>
      entry.actorId === actorId &&
      entry.dayOfWeek === dayOfWeek &&
      entry.startTime === block.startTime
  );
  return slot?.available === true;
}

export function isSlotBlocked(date: string, startTime: string, endTime: string, laneId: string, state: AppState) {
  return state.plannerBlockouts.some(
    (blockout) =>
      blockout.date === date &&
      blockout.type !== "custom" &&
      (!blockout.laneId || blockout.laneId === laneId) &&
      overlaps(blockout.startTime, blockout.endTime, startTime, endTime)
  );
}

export function getSlotBlockouts(date: string, startTime: string, endTime: string, laneId: string, state: AppState) {
  return state.plannerBlockouts.filter(
    (blockout) =>
      blockout.date === date &&
      blockout.type !== "custom" &&
      (!blockout.laneId || blockout.laneId === laneId) &&
      overlaps(blockout.startTime, blockout.endTime, startTime, endTime)
  );
}

export function getBeatAvailability(beatId: string, date: string, startTime: string, state: AppState): BeatAvailability {
  const beat = state.beats.find((candidate) => candidate.id === beatId);
  if (!beat) {
    return {
      beatId,
      canRehearse: false,
      missingCount: 1,
      missingActors: [],
      overrideConflicts: [],
      rosterSize: 0,
      reason: "Beat not found",
    };
  }

  const endTime = addMinutes(startTime, state.settings.plannerSlotMinutes);
  const missingActors: Actor[] = [];
  const overrideConflicts: Actor[] = [];

  beat.rosterActorIds.forEach((actorId) => {
    const actor = state.actors.find((candidate) => candidate.id === actorId && candidate.active);
    const override = getActorOverrideStatus(actorId, date, startTime, endTime, state.overrides);
    if (override?.type === "unavailable" && actor) overrideConflicts.push(actor);
    if (!actor || !isActorAvailable(actorId, date, startTime, state)) {
      if (actor) missingActors.push(actor);
    }
  });

  const missingCount = missingActors.length + beat.rosterActorIds.filter((actorId) => !state.actors.some((actor) => actor.id === actorId && actor.active)).length;
  const canRehearse = missingCount <= state.settings.maxAbsencesAllowed;
  const reason = canRehearse
    ? "Available"
    : overrideConflicts.length
      ? `Override conflict: ${overrideConflicts.map((actor) => actor.name).join(", ")}`
    : missingActors.length
      ? `Not marked Available in the Availability Matrix: ${missingActors.map((actor) => actor.name).join(", ")}`
      : "Missing actors from availability matrix";

  return {
    beatId,
    canRehearse,
    missingCount,
    missingActors,
    overrideConflicts,
    rosterSize: beat.rosterActorIds.length,
    reason,
  };
}

export function getAvailableBeatsForSlot(date: string, startTime: string, laneId: string, state: AppState): BeatAvailability[] {
  void laneId;
  return state.beats
    .map((beat) => getBeatAvailability(beat.id, date, startTime, state))
    .filter((availability) => availability.canRehearse);
}
