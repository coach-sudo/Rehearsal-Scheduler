import type { ScheduledBlock } from "../types";
import { formatTime } from "../utils/time";

interface Props {
  blocks: ScheduledBlock[];
  onProceed: () => void;
  onCancel: () => void;
}

export default function ConflictModal({ blocks, onProceed, onCancel }: Props) {
  const conflicted = blocks.filter((block) => block.conflicts.length);
  if (!conflicted.length) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Conflict warning</h2>
        <p className="mt-1 text-sm text-stone-600">Some generated blocks include actors with overlapping conflicts. You can proceed and keep the warning on the schedule.</p>
        <div className="mt-4 max-h-72 overflow-auto rounded border border-line">
          {conflicted.map((block) => (
            <div key={block.id} className="border-b border-line p-3 last:border-0">
              <div className="font-medium">{block.date} {formatTime(block.startTime)}-{formatTime(block.endTime)} | {block.laneId}</div>
              <div className="mt-1 text-sm text-coral">{block.conflicts.join("; ")}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-line px-4 py-2 text-sm">Cancel</button>
          <button onClick={onProceed} className="rounded bg-coral px-4 py-2 text-sm font-medium text-white">Proceed Anyway</button>
        </div>
      </div>
    </div>
  );
}
