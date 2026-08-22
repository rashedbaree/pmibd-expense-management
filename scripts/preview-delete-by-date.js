// Previews (and, with --confirm, deletes) expenses on a given date in one
// environment. Read-only by default - never deletes without --confirm.
//
// Usage:
//   node scripts/preview-delete-by-date.js <PROD|DEV> <YYYY-MM-DD>
//   node scripts/preview-delete-by-date.js <PROD|DEV> <YYYY-MM-DD> --confirm

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

const [, , targetArg, dateArg, flag] = process.argv;
const target = targetArg?.toUpperCase();
const confirmed = flag === "--confirm";

if (!target || !["PROD", "DEV"].includes(target) || !dateArg) {
  console.error("Usage: node scripts/preview-delete-by-date.js <PROD|DEV> <YYYY-MM-DD> [--confirm]");
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

async function main() {
  const { data: rows, error } = await supabase
    .from("expenses")
    .select(
      `id, date, amount, description, vendor, cheque_number, status, created_at,
       portfolio:portfolios(name),
       category:expense_categories(name)`,
    )
    .eq("date", dateArg)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Query failed: ${error.message}`);

  console.log(`${target}: ${rows.length} expense(s) dated ${dateArg}\n`);
  for (const r of rows) {
    console.log(
      `  ${r.created_at}  ${r.portfolio?.name ?? "?"} / ${r.category?.name ?? "?"}  ` +
        `${r.amount}  "${r.description}"  cheque=${r.cheque_number ?? "-"}  status=${r.status}  id=${r.id}`,
    );
  }

  if (rows.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  if (!confirmed) {
    console.log(`\nDry run only - nothing deleted. Re-run with --confirm to actually delete these ${rows.length} row(s).`);
    return;
  }

  const ids = rows.map((r) => r.id);

  const { error: auditError } = await supabase
    .from("audit_log")
    .delete()
    .eq("entity_type", "expense")
    .in("entity_id", ids);
  if (auditError) throw new Error(`Deleting audit_log rows failed: ${auditError.message}`);

  const { error: deleteError } = await supabase.from("expenses").delete().in("id", ids);
  if (deleteError) throw new Error(`Deleting expenses failed: ${deleteError.message}`);

  console.log(`\nDeleted ${ids.length} expense(s) and their audit_log entries from ${target}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
