import type { Actor, AppState } from "../types";

export function actorAvailabilitySignature(actorId: string, state: AppState) {
  return state.availability
    .filter((slot) => slot.actorId === actorId)
    .sort((a, b) => `${a.dayOfWeek}|${a.startTime}`.localeCompare(`${b.dayOfWeek}|${b.startTime}`))
    .map((slot) => `${slot.dayOfWeek}-${slot.startTime}-${slot.available ? 1 : 0}`)
    .join("|");
}

export function availabilitySimilarity(actorA: string, actorB: string, state: AppState) {
  const slotsA = state.availability.filter((slot) => slot.actorId === actorA);
  const keys = new Set(slotsA.map((slot) => `${slot.dayOfWeek}|${slot.startTime}`));
  state.availability.filter((slot) => slot.actorId === actorB).forEach((slot) => keys.add(`${slot.dayOfWeek}|${slot.startTime}`));
  if (!keys.size) return 0;
  let matches = 0;
  keys.forEach((key) => {
    const [dayOfWeek, startTime] = key.split("|");
    const a = state.availability.find((slot) => slot.actorId === actorA && String(slot.dayOfWeek) === dayOfWeek && slot.startTime === startTime)?.available ?? false;
    const b = state.availability.find((slot) => slot.actorId === actorB && String(slot.dayOfWeek) === dayOfWeek && slot.startTime === startTime)?.available ?? false;
    if (a === b) matches += 1;
  });
  return Math.round((matches / keys.size) * 100);
}

export function similarActors(actorId: string, state: AppState): Array<{ actor: Actor; score: number }> {
  return state.actors
    .filter((actor) => actor.id !== actorId && actor.active)
    .map((actor) => ({ actor, score: availabilitySimilarity(actorId, actor.id, state) }))
    .sort((a, b) => b.score - a.score);
}
