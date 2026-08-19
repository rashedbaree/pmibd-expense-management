// Directly sets a Supabase Auth user's password, bypassing email entirely.
// Reuses the same service role keys already configured for
// migrate-prod-to-dev.js.
//
// Usage:
//   node scripts/set-user-password.js <PROD|DEV> <email> <new-password>

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

const [, , targetArg, email, newPassword] = process.argv;
const target = targetArg?.toUpperCase();

if (!target || !["PROD", "DEV"].includes(target) || !email || !newPassword) {
  console.error("Usage: node scripts/set-user-password.js <PROD|DEV> <email> <new-password>");
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error("New password must be at least 8 characters.");
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
  const { data, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw new Error(`Listing users failed: ${listError.message}`);

  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`No auth user found with email ${email} in ${target}.`);
    process.exit(1);
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (error) throw new Error(`Updating password failed: ${error.message}`);

  console.log(`Password updated for ${email} (${user.id}) in ${target}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
