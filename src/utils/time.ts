import type { DayOfWeek } from "../types";

export const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const shortDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatTime(time: string): string {
  const minutes = timeToMinutes(time);
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours = hours24 % 12 || 12;
  return `${hours}:${String(mins).padStart(2, "0")} ${suffix}`;
}

export function addMinutes(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

export function getTimeSlots(startTime: string, endTime: string, stepMinutes: number): string[] {
  const slots: string[] = [];
  for (let minute = timeToMinutes(startTime); minute < timeToMinutes(endTime); minute += stepMinutes) {
    slots.push(minutesToTime(minute));
  }
  return slots;
}

export function getAvailabilityBlockForTime(time: string, blockMinutes = 30): { startTime: string; endTime: string } {
  const minute = timeToMinutes(time);
  const start = Math.floor(minute / blockMinutes) * blockMinutes;
  return { startTime: minutesToTime(start), endTime: minutesToTime(start + blockMinutes) };
}

export function getDayOfWeek(date: string): DayOfWeek {
  return new Date(`${date}T12:00:00`).getDay() as DayOfWeek;
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export function getWeekDates(weekStartDate: string): string[] {
  const monday = normalizeWeekStart(weekStartDate);
  return [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset));
}

export function normalizeWeekStart(date: string): string {
  const value = new Date(`${date}T12:00:00`);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return value.toISOString().slice(0, 10);
}

export function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
}

export function sameBeatSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, index) => id === right[index]);
}

export function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}
