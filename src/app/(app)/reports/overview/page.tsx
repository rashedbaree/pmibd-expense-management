import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getVisibilityScope } from "@/lib/visibility";
import { getSpendBreakdown, resolveDateRange, type DateRangeFilters } from "@/lib/reportsData";
import OverviewClient from "./client";

export default async function ReportsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeFilters>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const scope = await getVisibilityScope(supabase, profile);
  const range = resolveDateRange(filters);
  const { periodWise, categoryWise, portfolioWise } = await getSpendBreakdown(
    supabase,
    scope,
    range,
  );

  return (
    <OverviewClient
      periodWise={periodWise}
      categoryWise={categoryWise}
      portfolioWise={portfolioWise}
      dateFrom={range.dateFrom}
      dateTo={range.dateTo}
      showAll={range.showAll}
    />
  );
}
