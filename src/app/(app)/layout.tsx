import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { signOut } from "./actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/expenses", label: "Expenses" },
  { href: "/approvals", label: "Approvals" },
  { href: "/reports", label: "Reports" },
  { href: "/admin", label: "Admin", adminOnly: true },
];

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = await getCurrentProfile();
  const navItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || profile?.role === "admin",
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="print:hidden flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/pmibd-logo.svg"
              alt="PMI Bangladesh Chapter"
              width={111}
              height={43}
              className="h-8 w-auto"
              priority
            />
            <span className="hidden text-xs tracking-wide text-zinc-400 uppercase sm:inline">
              Expense Management
            </span>
          </Link>
          <nav className="flex gap-4 border-l border-zinc-200 pl-6 text-sm text-zinc-600">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-zinc-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-600">{user?.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
