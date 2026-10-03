"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** "← Event check in" on every sub-page; hidden on the hub itself. */
export default function BackLink() {
  const pathname = usePathname();
  if (pathname === "/event-checkin") return null;
  return (
    <nav className="print:hidden mb-4 text-sm">
      <Link href="/event-checkin" className="text-brand hover:underline dark:text-zinc-300">
        ← Event check in
      </Link>
    </nav>
  );
}
