import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getVisibilityScope } from "@/lib/visibility";
import { getSpendBreakdown, resolveDateRange, type DateRangeFilters } from "@/lib/reportsData";
import { AccessDenied } from "@/components/AccessDenied";
import ReportsClient from "./client";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeFilters>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  if (profile.role === "submitter") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Reports
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const scope = await getVisibilityScope(supabase, profile);
  const range = resolveDateRange(filters);
  const { periodWise, categoryWise, portfolioWise, eventWise, approvalStatus } =
    await getSpendBreakdown(supabase, scope, range);

  return (
    <ReportsClient
      periodWise={periodWise}
      categoryWise={categoryWise}
      portfolioWise={portfolioWise}
      eventWise={eventWise}
      approvalStatus={approvalStatus}
      dateFrom={range.dateFrom}
      dateTo={range.dateTo}
      showAll={range.showAll}
    />
  );
}
