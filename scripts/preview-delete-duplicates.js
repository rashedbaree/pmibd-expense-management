// Finds expense rows that are exact duplicates of each other - every data
// column matches (date, portfolio, category, event, description, vendor,
// payment method, amount, cheque number, entry type, status, remarks,
// approval routing, submitted/created/updated-by) - and previews which ones
// would be removed. Only `id`, `created_at` and `updated_at` are excluded
// from the comparison, since those are always unique per row by design.
// Read-only by default - never deletes without --confirm.
//
// Within each duplicate group, the oldest row (by created_at, then id) is
// kept and every later row is proposed for deletion - the assumption being
// that duplicates come from a double form submission or a bulk import that
// ran twice, and the first entry is the real one.
//
// Usage:
//   node scripts/preview-delete-duplicates.js <PROD|DEV>
//   node scripts/preview-delete-duplicates.js <PROD|DEV> --confirm
//   node scripts/preview-delete-duplicates.js <PROD|DEV> --date 2026-01-15 [--confirm]

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

const args = process.argv.slice(2);
const target = args[0]?.toUpperCase();
const confirmed = args.includes("--confirm");
const dateFlagIdx = args.indexOf("--date");
const dateArg = dateFlagIdx !== -1 ? args[dateFlagIdx + 1] : undefined;

if (!target || !["PROD", "DEV"].includes(target)) {
  console.error(
    "Usage: node scripts/preview-delete-duplicates.js <PROD|DEV> [--date YYYY-MM-DD] [--confirm]",
  );
  process.exit(1);
}

const envFile = path.join(__dirname, "migrate-prod-to-dev.env.local");
const env = { ...loadEnvFile(envFile), ...process.env };

const url = env[`${target}_SUPABASE_URL`];
const serviceRoleKey = env[`${target}_SERVICE_ROLE_KEY`];

if (!url || !serviceRoleKey) {
  console.error(
    `Missing ${target}_SUPABASE_URL / ${target}_SERVICE_ROLE_KEY in scripts/migrate-prod-to-dev.env.local`,
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

// Every data column must match for two rows to be considered duplicates -
// only id/created_at/updated_at (inherently unique per row) are left out.
function dupKey(r) {
  return [
    r.date,
    r.portfolio_id,
    r.category_id,
    r.event_id ?? "",
    r.description ?? "",
    r.vendor ?? "",
    r.payment_method,
    r.amount,
    r.cheque_number ?? "",
    r.entry_type,
    r.reverses_expense_id ?? "",
    r.status,
    r.remarks ?? "",
    r.required_approval_role ?? "",
    r.current_approver_role ?? "",
    r.submitted_by,
    r.created_by,
    r.updated_by ?? "",
  ].join("|");
}

async function main() {
  let query = supabase
    .from("expenses")
    .select(
      `id, date, portfolio_id, category_id, event_id, description, vendor,
       payment_method, amount, cheque_number, entry_type, reverses_expense_id,
       status, remarks, required_approval_role, current_approver_role,
       submitted_by, created_by, updated_by, created_at,
       portfolio:portfolios(name),
       category:expense_categories(name)`,
    )
    .order("created_at", { ascending: true });

  if (dateArg) query = query.eq("date", dateArg);

  const { data: rows, error } = await query;
  if (error) throw new Error(`Query failed: ${error.message}`);

  const groups = new Map();
  for (const r of rows) {
    const key = dupKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const dupGroups = [...groups.values()].filter((g) => g.length > 1);

  console.log(
    `${target}: scanned ${rows.length} expense(s)${dateArg ? ` dated ${dateArg}` : ""}, found ${dupGroups.length} duplicate group(s)\n`,
  );

  const toDelete = [];
  for (const group of dupGroups) {
    console.log(`Group (${group.length} rows):`);
    for (const [i, r] of group.entries()) {
      const action = i === 0 ? "KEEP  " : "DELETE";
      console.log(
        `  [${action}] ${r.created_at}  ${r.portfolio?.name ?? "?"} / ${r.category?.name ?? "?"}  ` +
          `${r.date}  ${r.amount}  "${r.description}"  vendor=${r.vendor ?? "-"}  ` +
          `cheque=${r.cheque_number ?? "-"}  status=${r.status}  id=${r.id}`,
      );
      if (i > 0) toDelete.push(r);
    }
    console.log("");
  }

  if (toDelete.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (!confirmed) {
    console.log(
      `Dry run only - nothing deleted. Re-run with --confirm to actually delete these ${toDelete.length} row(s).`,
    );
    return;
  }

  const ids = toDelete.map((r) => r.id);

  const { error: auditError } = await supabase
    .from("audit_log")
    .delete()
    .eq("entity_type", "expense")
    .in("entity_id", ids);
  if (auditError) throw new Error(`Deleting audit_log rows failed: ${auditError.message}`);

  const { error: deleteError, count } = await supabase
    .from("expenses")
    .delete({ count: "exact" })
    .in("id", ids);
  if (deleteError) {
    throw new Error(
      `Deleting expenses failed: ${deleteError.message}\n` +
        `(If this mentions a foreign key on reverses_expense_id, one of the rows marked ` +
        `DELETE above is the original of a reversal - re-check that group by hand before retrying.)`,
    );
  }

  console.log(`\nDeleted ${count ?? ids.length} duplicate expense(s) and their audit_log entries from ${target}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
