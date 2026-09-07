interface Props {
  tone?: "green" | "amber" | "red" | "gray" | "blue";
  children: React.ReactNode;
}

const tones = {
  green: "bg-green-100 text-green-800 border-green-200",
  amber: "bg-amber-100 text-amber-900 border-amber-200",
  red: "bg-red-100 text-red-800 border-red-200",
  gray: "bg-stone-100 text-stone-700 border-stone-200",
  blue: "bg-sky-100 text-sky-800 border-sky-200",
};

export default function StatusBadge({ tone = "gray", children }: Props) {
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium border ${tones[tone]}`}>{children}</span>;
}
