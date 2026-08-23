// Identifies likely-duplicate expenses (same date, portfolio, category,
// amount, description, and cheque number) - read-only, never deletes
// anything. Review the output, then use preview-delete-by-date.js or a
// one-off script to actually remove whichever rows you decide are the
// unwanted copies.
//
// Usage:
//   node scripts/find-duplicate-expenses.js <PROD|DEV>

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

const [, , targetArg] = process.argv;
const target = targetArg?.toUpperCase();

if (!target || !["PROD", "DEV"].includes(target)) {
  console.error("Usage: node scripts/find-duplicate-expenses.js <PROD|DEV>");
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
      `id, date, amount, description, vendor, cheque_number, status, entry_type, created_at,
       portfolio_id, category_id,
       portfolio:portfolios(name),
       category:expense_categories(name)`,
    )
    .order("date", { ascending: true });

  if (error) throw new Error(`Query failed: ${error.message}`);

  const groups = new Map();
  for (const e of rows) {
    const key = signature(e);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const duplicateGroups = [...groups.values()].filter((g) => g.length > 1);
  const duplicateRowCount = duplicateGroups.reduce((sum, g) => sum + g.length, 0);

  console.log(
    `${target}: ${rows.length} total expense(s), ${duplicateGroups.length} duplicate group(s), ${duplicateRowCount} row(s) involved\n`,
  );

  for (const group of duplicateGroups) {
    const first = group[0];
    console.log(
      `--- ${group.length}x  ${first.date}  ${first.portfolio?.name ?? "?"} / ${first.category?.name ?? "?"}  ` +
        `${first.amount}  "${first.description}"  cheque=${first.cheque_number ?? "-"}`,
    );
    for (const e of group) {
      console.log(`    id=${e.id}  created_at=${e.created_at}  status=${e.status}`);
    }
  }

  if (duplicateGroups.length === 0) {
    console.log("No duplicates found.");
  } else {
    console.log(
      `\n${duplicateRowCount} row(s) across ${duplicateGroups.length} group(s) look like duplicates. ` +
        `This script only reports - nothing was deleted.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
