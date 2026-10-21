import type { NextRequest } from "next/server";
import { weekdayIndex } from "@/lib/dates";
import { minutesOfTime } from "@/lib/blocks";
import { anchorNight, formatInstantClock, parseHookTime, resolveNight } from "@/lib/sleep";
import { bearerToken, hashHookToken, readHookParams } from "@/lib/sleep-hook";
import { createAdminClient } from "@/lib/supabase/admin";

// The phone link: a phone automation (iPhone Shortcuts, Tasker, MacroDroid…)
// calls it when an alarm is set, at bedtime or on waking. It only proposes
// that night's sleep: the planner asks the user, who accepts, changes the
// times or turns it down. Nothing reaches the planner without that answer.
//
//   POST /api/sleep?token=<secret>&wake=07:00            alarm set for 07:00
//   POST /api/sleep?token=<secret>&bed=23:30&wake=07:00  both
//   POST /api/sleep?token=<secret>&bed=now               going to bed
//   POST /api/sleep?token=<secret>&wake=now              woke up
//
// Values may also come as a JSON or form body; the secret also as
// "Authorization: Bearer <secret>". A missing side is taken from the night's
// earlier proposal or blocks already on the planner, then from the weekly schedule.

function reply(status: number, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: status === 200, message, ...extra }, { status });
}

export async function POST(request: NextRequest) {
  const params = await readHookParams(request);
  const token = bearerToken(request) ?? params.token;
  if (!token) return reply(401, "لینک ناقص است: token ندارد.");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return reply(503, "این قابلیت روی این سرور راه‌اندازی نشده است.");

  const supabase = createAdminClient();
  const { data: owner, error: ownerError } = await supabase
    .from("sleep_settings")
    .select("user_id")
    .eq("hook_token_hash", hashHookToken(token))
    .maybeSingle();
  if (ownerError) throw new Error(ownerError.message);
  if (!owner) return reply(401, "این لینک معتبر نیست. در تنظیمات تسکلندر لینک تازه بسازید.");

  const bed = parseHookTime(params.bed);
  const wake = parseHookTime(params.wake);
  if (bed === null || wake === null) return reply(400, "ساعت را به‌شکل 07:00 یا now بفرستید.");
  if (!bed && !wake) return reply(400, "ساعت خواب (bed) یا بیداری (wake) را بفرستید.");

  const anchor = anchorNight(bed, wake, new Date());
  const userId = owner.user_id;
  const [proposal, blocks, plan] = await Promise.all([
    supabase
      .from("sleep_proposals")
      .select("bed_at, wake_at")
      .eq("user_id", userId)
      .eq("night", anchor.night)
      .maybeSingle(),
    supabase.from("time_blocks").select("start_at, end_at").eq("user_id", userId).eq("sleep_night", anchor.night),
    supabase
      .from("sleep_schedules")
      .select("bedtime, wake_time")
      .eq("user_id", userId)
      .eq("weekday", weekdayIndex(anchor.night))
      .maybeSingle(),
  ]);
  if (proposal.error) throw new Error(proposal.error.message);
  if (blocks.error) throw new Error(blocks.error.message);
  if (plan.error) throw new Error(plan.error.message);

  const starts = blocks.data.map((b) => Date.parse(b.start_at));
  const ends = blocks.data.map((b) => Date.parse(b.end_at));
  const resolved = resolveNight(anchor, {
    existing: proposal.data
      ? { bedAt: new Date(proposal.data.bed_at), wakeAt: new Date(proposal.data.wake_at) }
      : blocks.data.length
        ? { bedAt: new Date(Math.min(...starts)), wakeAt: new Date(Math.max(...ends)) }
        : null,
    plan: plan.data ? { bedtime: minutesOfTime(plan.data.bedtime), wake: minutesOfTime(plan.data.wake_time) } : null,
  });
  if ("error" in resolved) return reply(422, resolved.error);

  const { error } = await supabase.from("sleep_proposals").upsert(
    {
      user_id: userId,
      night: anchor.night,
      bed_at: resolved.bedAt.toISOString(),
      wake_at: resolved.wakeAt.toISOString(),
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,night" },
  );
  if (error) throw new Error(error.message);

  const bedClock = formatInstantClock(resolved.bedAt);
  const wakeClock = formatInstantClock(resolved.wakeAt);
  return reply(200, `پیشنهاد خواب ${bedClock} تا ${wakeClock} فرستاده شد؛ در تسکلندر تأییدش کنید.`, {
    night: anchor.night,
    bed_at: resolved.bedAt.toISOString(),
    wake_at: resolved.wakeAt.toISOString(),
  });
}
