#!/usr/bin/env node
/**
 * Export D1 submissions as JSONL for offline review and labeling.
 * Usage: npm run db:export -- [limit]
 *
 * Environment variables (optional):
 *   CLOUDFLARE_ACCOUNT_ID - your Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN - API token with D1 read permissions
 *
 * If env vars are not set, falls back to wrangler CLI.
 */

const args = process.argv.slice(2);
const limit = args[0] ? parseInt(args[0], 10) : 100;

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const databaseId = process.env.D1_DATABASE_ID;

  if (accountId && apiToken && databaseId) {
    await exportViaApi(accountId, apiToken, databaseId, limit);
  } else {
    console.error("Error: Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and D1_DATABASE_ID env vars.");
    console.error("\nAlternatively, use wrangler directly:");
    console.error(`  wrangler d1 execute jd_concierge --remote --command "SELECT * FROM submissions ORDER BY created_at DESC LIMIT ${limit}"`);
    process.exit(1);
  }
}

async function exportViaApi(accountId, apiToken, databaseId, limit) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sql: `SELECT * FROM submissions ORDER BY created_at DESC LIMIT ${limit}`
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`API request failed: ${response.status} ${err}`);
    process.exit(1);
  }

  const data = await response.json();
  if (!data.success || !data.result?.[0]?.results) {
    console.error("Unexpected API response format");
    process.exit(1);
  }

  const rows = data.result[0].results;

  // Output JSONL (one JSON object per line)
  for (const row of rows) {
    console.log(JSON.stringify(row));
  }

  console.error(`\nExported ${rows.length} rows (last ${limit})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
