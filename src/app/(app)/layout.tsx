import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
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
      <AppHeader navItems={navItems} userEmail={user?.email} signOutAction={signOut} />
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
