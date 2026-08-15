// One-off utility: copies PROD data into the DEV Supabase project.
//
// Portfolios and categories are matched to DEV's existing rows by name
// (not by ID) - DEV was set up independently and its portfolios/categories
// have their own auto-generated IDs that don't match PROD's, even when the
// names are identical. Any PROD portfolio/category/event with no matching
// name in DEV gets created there. All PROD IDs get remapped to the
// corresponding DEV IDs before expenses (and everything that references
// them) are copied over.
//
// Expenses, their approval history, uploaded documents, and the audit log
// all reference `users`, which in turn requires matching Supabase Auth
// accounts - since PROD and DEV are separate projects with separate Auth
// systems, those user references are remapped to a single DEV admin
// account instead of trying to recreate every real person's account.
// `users` and `approval_matrix` are not copied at all.
//
// Usage:
//   1. Copy scripts/migrate-prod-to-dev.env.example to
//      scripts/migrate-prod-to-dev.env.local and fill in the values below.
//      That file is gitignored - never commit it.
//   2. node scripts/migrate-prod-to-dev.js

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

const envFile = path.join(__dirname, "migrate-prod-to-dev.env.local");
const env = { ...loadEnvFile(envFile), ...process.env };

const {
  PROD_SUPABASE_URL,
  PROD_SERVICE_ROLE_KEY,
  DEV_SUPABASE_URL,
  DEV_SERVICE_ROLE_KEY,
  DEV_ADMIN_USER_ID,
} = env;

const required = {
  PROD_SUPABASE_URL,
  PROD_SERVICE_ROLE_KEY,
  DEV_SUPABASE_URL,
  DEV_SERVICE_ROLE_KEY,
  DEV_ADMIN_USER_ID,
};
const missing = Object.entries(required)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length > 0) {
  console.error(`Missing config: ${missing.join(", ")}`);
  console.error(
    `Set these in scripts/migrate-prod-to-dev.env.local (see .env.example).`,
  );
  process.exit(1);
}

const prod = createClient(PROD_SUPABASE_URL, PROD_SERVICE_ROLE_KEY);
const dev = createClient(DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY);

async function fetchAll(client, table) {
  const { data, error } = await client.from(table).select("*");
  if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
  return data ?? [];
}

// Matches `prodRows` against `devRows` using `keyFn` (applied to rows that
// are already in DEV's ID-space). Anything unmatched is created in DEV via
// `insertRowFn`. Returns a Map from the original PROD row's `id` to the
// corresponding DEV row's `id`.
async function buildOrCreateMap(table, prodRows, devRows, keyFn, insertRowFn) {
  const devByKey = new Map(devRows.map((r) => [keyFn(r), r.id]));
  const idMap = new Map();
  const toCreate = [];

  for (const row of prodRows) {
    const existingId = devByKey.get(keyFn(row));
    if (existingId) {
      idMap.set(row.id, existingId);
    } else {
      toCreate.push(row);
    }
  }

  if (toCreate.length > 0) {
    const payload = toCreate.map(insertRowFn);
    const { data, error } = await dev.from(table).insert(payload).select("*");
    if (error) throw new Error(`Creating new ${table} rows in DEV failed: ${error.message}`);
    const newByKey = new Map(data.map((r) => [keyFn(r), r.id]));
    for (const row of toCreate) {
      idMap.set(row.id, newByKey.get(keyFn(insertRowFn(row))));
    }
  }

  console.log(
    `${table}: matched ${prodRows.length - toCreate.length} existing, created ${toCreate.length} new`,
  );
  return idMap;
}

async function copyTable(table, transform) {
  const data = await fetchAll(prod, table);
  if (data.length === 0) {
    console.log(`${table}: nothing to copy`);
    return [];
  }

  const rows = transform ? data.map(transform).filter(Boolean) : data;
  if (rows.length === 0) {
    console.log(`${table}: nothing to copy after filtering`);
    return [];
  }

  const { error } = await dev.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Writing ${table} to DEV failed: ${error.message}`);

  console.log(`${table}: copied ${rows.length} row(s)`);
  return rows;
}

async function copyDocumentFiles(documents) {
  if (documents.length === 0) return;
  let copied = 0;
  let failed = 0;
  for (const doc of documents) {
    const { data, error } = await prod.storage.from("expense-documents").download(doc.file_url);
    if (error) {
      failed++;
      console.warn(`  could not download ${doc.file_url} from PROD storage: ${error.message}`);
      continue;
    }
    const { error: uploadError } = await dev.storage
      .from("expense-documents")
      .upload(doc.file_url, data, { upsert: true });
    if (uploadError) {
      failed++;
      console.warn(`  could not upload ${doc.file_url} to DEV storage: ${uploadError.message}`);
      continue;
    }
    copied++;
  }
  console.log(`expense-documents storage files: copied ${copied}, failed ${failed}`);
}

async function main() {
  console.log(`Copying PROD -> DEV, attributing all activity to admin user ${DEV_ADMIN_USER_ID}\n`);

  // --- Portfolios: matched/created by name ---------------------------------
  const [prodPortfolios, devPortfolios] = await Promise.all([
    fetchAll(prod, "portfolios"),
    fetchAll(dev, "portfolios"),
  ]);
  const portfolioIdMap = await buildOrCreateMap(
    "portfolios",
    prodPortfolios,
    devPortfolios,
    (r) => r.name.trim().toLowerCase(),
    (row) => ({ name: row.name }),
  );

  // --- Categories: matched/created by name, parents before children -------
  const [prodCategories, devCategories] = await Promise.all([
    fetchAll(prod, "expense_categories"),
    fetchAll(dev, "expense_categories"),
  ]);
  const topLevel = prodCategories.filter((c) => !c.parent_category_id);
  const children = prodCategories.filter((c) => c.parent_category_id);

  const categoryIdMap = await buildOrCreateMap(
    "expense_categories",
    topLevel,
    devCategories.filter((c) => !c.parent_category_id),
    (r) => r.name.trim().toLowerCase(),
    (row) => ({ name: row.name, parent_category_id: null }),
  );

  const remappedChildren = children.map((c) => ({
    ...c,
    parent_category_id: categoryIdMap.get(c.parent_category_id) ?? null,
  }));
  const childIdMap = await buildOrCreateMap(
    "expense_categories",
    remappedChildren,
    devCategories.filter((c) => c.parent_category_id),
    (r) => `${r.parent_category_id}::${r.name.trim().toLowerCase()}`,
    (row) => ({ name: row.name, parent_category_id: row.parent_category_id }),
  );
  for (const [prodId, devId] of childIdMap) categoryIdMap.set(prodId, devId);

  // --- Events: matched/created by portfolio + name + date -------------------
  const [prodEvents, devEvents] = await Promise.all([
    fetchAll(prod, "events"),
    fetchAll(dev, "events"),
  ]);
  const remappedEvents = prodEvents
    .map((e) => ({ ...e, portfolio_id: portfolioIdMap.get(e.portfolio_id) }))
    .filter((e) => e.portfolio_id); // drop events whose portfolio somehow didn't map
  const eventIdMap = await buildOrCreateMap(
    "events",
    remappedEvents,
    devEvents,
    (r) => `${r.portfolio_id}::${r.name.trim().toLowerCase()}::${r.date}`,
    (row) => ({ name: row.name, date: row.date, portfolio_id: row.portfolio_id }),
  );

  // --- Expenses and everything that references them -------------------------
  // reverses_expense_id is a self-reference within this same table. Inserted
  // in one bulk statement, a reversal row could land before the original row
  // it points to and fail the FK check, so it's nulled out on the way in and
  // patched back in a second pass once every expense row exists.
  const reversalLinks = [];
  const expenses = await copyTable("expenses", (row) => {
    const portfolio_id = portfolioIdMap.get(row.portfolio_id);
    const category_id = categoryIdMap.get(row.category_id);
    if (!portfolio_id || !category_id) {
      console.warn(`  skipping expense ${row.id}: portfolio or category didn't map`);
      return null;
    }
    if (row.reverses_expense_id) {
      reversalLinks.push({ id: row.id, reverses_expense_id: row.reverses_expense_id });
    }
    return {
      ...row,
      portfolio_id,
      category_id,
      event_id: row.event_id ? (eventIdMap.get(row.event_id) ?? null) : null,
      reverses_expense_id: null,
      submitted_by: DEV_ADMIN_USER_ID,
      created_by: DEV_ADMIN_USER_ID,
      updated_by: DEV_ADMIN_USER_ID,
    };
  });

  if (reversalLinks.length > 0) {
    for (const link of reversalLinks) {
      const { error } = await dev
        .from("expenses")
        .update({ reverses_expense_id: link.reverses_expense_id })
        .eq("id", link.id);
      if (error) {
        console.warn(`  could not link reversal ${link.id}: ${error.message}`);
      }
    }
    console.log(`expenses: relinked ${reversalLinks.length} reversal(s)`);
  }

  await copyTable("expense_approvals", (row) => ({
    ...row,
    approver_id: DEV_ADMIN_USER_ID,
    created_by: DEV_ADMIN_USER_ID,
    updated_by: DEV_ADMIN_USER_ID,
  }));

  const documents = await copyTable("expense_documents", (row) => ({
    ...row,
    created_by: DEV_ADMIN_USER_ID,
    updated_by: DEV_ADMIN_USER_ID,
  }));

  await copyTable("audit_log", (row) => ({
    ...row,
    actor_id: DEV_ADMIN_USER_ID,
  }));

  await copyTable("bank_transactions", (row) => {
    // dedupe_key is a Postgres GENERATED column - Postgres computes it,
    // it can't be assigned on insert.
    const { dedupe_key, ...rest } = row;
    return { ...rest, created_by: DEV_ADMIN_USER_ID };
  });

  console.log("\nCopying uploaded document files (this can take a while)...");
  await copyDocumentFiles(documents);

  console.log(`\nDone. ${expenses.length} expenses now in DEV.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
