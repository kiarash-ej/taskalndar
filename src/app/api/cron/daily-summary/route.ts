import { botTokens, cronSecret } from "@/lib/messaging/config";
import { sendDueSummaries } from "@/lib/messaging/daily";
import { secretMatches } from "@/lib/messaging/secrets";
import { supabaseSummarySource } from "@/lib/messaging/supabase-source";
import { createAdminClient } from "@/lib/supabase/admin";

// Called every 15 minutes by the Railway cron service
// (scripts/trigger-daily-summary.mjs) with "Authorization: Bearer <CRON_SECRET>".
export async function POST(request: Request) {
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secretMatches(presented, cronSecret())) return new Response(null, { status: 401 });

  const result = await sendDueSummaries(supabaseSummarySource(createAdminClient()), new Date(), botTokens());
  return Response.json(result);
}
