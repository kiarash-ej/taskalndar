// Start command of the Railway cron service, schedule "*/5 * * * *" (Railway's
// shortest): sends the due daily summaries, then checks reminders once a
// minute for the next five minutes so they arrive on time, and exits before
// the next run starts. Needs APP_URL (the app's public URL) and CRON_SECRET.
const { APP_URL, CRON_SECRET } = process.env;
if (!APP_URL || !CRON_SECRET) {
  console.error("APP_URL and CRON_SECRET must be set");
  process.exit(1);
}

const RUNS = 5;
const MINUTE = 60_000;
let ok = true;

async function call(path) {
  try {
    const response = await fetch(new URL(path, APP_URL), {
      method: "POST",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    console.log(path, response.status, await response.text());
    ok &&= response.ok;
  } catch (error) {
    console.error(path, error);
    ok = false;
  }
}

const started = Date.now();
await call("/api/cron/daily-summary");
for (let i = 0; i < RUNS; i++) {
  // keep to the minute marks of this run; the last check ends well before the next run
  const wait = started + i * MINUTE - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  await call("/api/cron/reminders");
}
process.exit(ok ? 0 : 1);
