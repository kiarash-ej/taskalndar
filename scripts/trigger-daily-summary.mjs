// Start command of the Railway cron service (schedule "*/15 * * * *"): asks
// the app to send the daily summaries that are due, then exits.
// Needs APP_URL (the app's public URL) and CRON_SECRET.
const { APP_URL, CRON_SECRET } = process.env;
if (!APP_URL || !CRON_SECRET) {
  console.error("APP_URL and CRON_SECRET must be set");
  process.exit(1);
}

const response = await fetch(new URL("/api/cron/daily-summary", APP_URL), {
  method: "POST",
  headers: { Authorization: `Bearer ${CRON_SECRET}` },
});
console.log(response.status, await response.text());
process.exit(response.ok ? 0 : 1);
