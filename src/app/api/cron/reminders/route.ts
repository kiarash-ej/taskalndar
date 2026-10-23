import { botTokens, cronSecret } from "@/lib/messaging/config";
import { sendDueReminders } from "@/lib/messaging/reminders";
import { secretMatches } from "@/lib/messaging/secrets";
import { supabaseReminderSource } from "@/lib/messaging/supabase-source";
import { createAdminClient } from "@/lib/supabase/admin";

// Called about once a minute by the Railway cron service
// (scripts/cron-tick.mjs) with "Authorization: Bearer <CRON_SECRET>".
export async function POST(request: Request) {
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secretMatches(presented, cronSecret())) return new Response(null, { status: 401 });

  const result = await sendDueReminders(supabaseReminderSource(createAdminClient()), new Date(), botTokens());
  return Response.json(result);
}
