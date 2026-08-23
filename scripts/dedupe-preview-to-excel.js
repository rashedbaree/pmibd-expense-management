// Same duplicate detection as dedupe-expenses.js, written out as an Excel
// file for easier review. Read-only - never deletes anything.
//
// Usage:
//   node scripts/dedupe-preview-to-excel.js <PROD|DEV> <output.xlsx>

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const XLSX = require("xlsx");

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

const [, , targetArg, outPathArg] = process.argv;
const target = targetArg?.toUpperCase();
const outPath = outPathArg || "dedupe-preview.xlsx";

if (!target || !["PROD", "DEV"].includes(target)) {
  console.error("Usage: node scripts/dedupe-preview-to-excel.js <PROD|DEV> <output.xlsx>");
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
      `id, date, amount, description, vendor, cheque_number, status, created_at,
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

  const duplicateGroups = [...groups.values()].filter((g) => g.length > 1);

  const sheetRows = [];
  duplicateGroups.forEach((group, groupIndex) => {
    group.forEach((e, i) => {
      sheetRows.push({
        Group: groupIndex + 1,
        Action: i === 0 ? "KEEP" : "DELETE",
        Date: e.date,
        Portfolio: e.portfolio?.name ?? "",
        Category: e.category?.name ?? "",
        Amount: Number(e.amount),
        Description: e.description ?? "",
        Vendor: e.vendor ?? "",
        "Cheque Number": e.cheque_number ?? "",
        Status: e.status,
        "Created At": e.created_at,
        "Expense ID": e.id,
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  ws["!cols"] = [
    { wch: 7 }, { wch: 8 }, { wch: 11 }, { wch: 22 }, { wch: 22 },
    { wch: 10 }, { wch: 40 }, { wch: 20 }, { wch: 14 }, { wch: 8 },
    { wch: 24 }, { wch: 38 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Duplicates");
  XLSX.writeFile(wb, outPath);

  const toDeleteCount = sheetRows.filter((r) => r.Action === "DELETE").length;
  console.log(
    `${target}: ${duplicateGroups.length} duplicate group(s), ${sheetRows.length} row(s) listed ` +
      `(${duplicateGroups.length} to keep, ${toDeleteCount} marked DELETE). Saved to ${outPath}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
