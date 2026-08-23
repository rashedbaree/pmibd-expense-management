// Removes duplicate expenses (same date, portfolio, category, amount,
// description, and cheque number), keeping the earliest-created row in
// each group. Dry run by default - never deletes without --confirm.
//
// Usage:
//   node scripts/dedupe-expenses.js <PROD|DEV>
//   node scripts/dedupe-expenses.js <PROD|DEV> --confirm

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

const [, , targetArg, flag] = process.argv;
const target = targetArg?.toUpperCase();
const confirmed = flag === "--confirm";

if (!target || !["PROD", "DEV"].includes(target)) {
  console.error("Usage: node scripts/dedupe-expenses.js <PROD|DEV> [--confirm]");
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

function signature(e) {
  return [
    e.date,
    e.portfolio_id,
    e.category_id,
    Number(e.amount).toFixed(2),
    (e.description ?? "").trim().toLowerCase(),
    (e.cheque_number ?? "").trim().toLowerCase(),
  ].join("|");
}

async function main() {
  const { data: rows, error } = await supabase
    .from("expenses")
    .select(
      `id, date, amount, description, cheque_number, created_at,
       portfolio_id, category_id,
       portfolio:portfolios(name),
       category:expense_categories(name)`,
    )
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Query failed: ${error.message}`);

  const groups = new Map();
  for (const e of rows) {
    const key = signature(e);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const toDelete = [];
  let groupCount = 0;

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    groupCount++;
    // group is already sorted by created_at ascending (query order) - keep
    // the first (earliest), delete the rest.
    const [keep, ...rest] = group;
    console.log(
      `KEEP   ${keep.date}  ${keep.portfolio?.name ?? "?"} / ${keep.category?.name ?? "?"}  ` +
        `${keep.amount}  "${keep.description}"  id=${keep.id}`,
    );
    for (const dupe of rest) {
      console.log(`  DELETE id=${dupe.id}  created_at=${dupe.created_at}`);
      toDelete.push(dupe.id);
    }
  }

  console.log(
    `\n${groupCount} duplicate group(s), ${toDelete.length} row(s) would be deleted (1 kept per group).`,
  );

  if (toDelete.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (!confirmed) {
    console.log("\nDry run only - nothing deleted. Re-run with --confirm to actually delete these rows.");
    return;
  }

  const { error: auditError } = await supabase
    .from("audit_log")
    .delete()
    .eq("entity_type", "expense")
    .in("entity_id", toDelete);
  if (auditError) throw new Error(`Deleting audit_log rows failed: ${auditError.message}`);

  const { error: deleteError } = await supabase.from("expenses").delete().in("id", toDelete);
  if (deleteError) throw new Error(`Deleting expenses failed: ${deleteError.message}`);

  console.log(`\nDeleted ${toDelete.length} duplicate row(s) from ${target}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
