import Link from "next/link";
import Scanner from "@/components/checkin/Scanner";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const mode = (await searchParams).mode === "bag" ? "bag" : "checkin";

  const tab = (active: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold ${
      active
        ? "bg-brand text-white"
        : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
    }`;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex gap-2">
        <Link href="/event-checkin/scan?mode=checkin" className={tab(mode === "checkin")}>
          Check-in
        </Link>
        <Link href="/event-checkin/scan?mode=bag" className={tab(mode === "bag")}>
          Gift bag
        </Link>
      </div>
      <Scanner key={mode} mode={mode} />
    </div>
  );
}
