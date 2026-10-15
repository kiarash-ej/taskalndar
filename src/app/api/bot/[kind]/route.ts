import type { NextRequest } from "next/server";
import { isBotKind, parseCommand, sendBotMessage } from "@/lib/messaging/bots";
import { botTokens, botWebhookSecret } from "@/lib/messaging/config";
import { secretMatches } from "@/lib/messaging/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

// Webhook for the Bale/Telegram bot. Register it with setWebhook at
// /api/bot/<kind>?secret=<BOT_WEBHOOK_SECRET> (Telegram can instead send the
// secret in X-Telegram-Bot-Api-Secret-Token). Handles "/start <code>", which
// links the chat to the channel showing that code, and "/stop".

const HELP =
  "برای دریافت خلاصهٔ روزانهٔ پلنر، در تنظیمات تسکلندر کانال پیام‌رسان را بسازید و دستور /start را همراه کدی که نشان می‌دهد این‌جا بفرستید. برای قطع ارسال: /stop";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/bot/[kind]">) {
  const { kind } = await ctx.params;
  if (!isBotKind(kind)) return new Response(null, { status: 404 });

  const token = botTokens()[kind];
  const presented =
    request.headers.get("x-telegram-bot-api-secret-token") ?? request.nextUrl.searchParams.get("secret");
  if (!token || !secretMatches(presented, botWebhookSecret())) return new Response(null, { status: 401 });

  const command = parseCommand(await request.json().catch(() => null));
  // Acknowledge everything else: the messenger retries updates that fail.
  if (!command) return Response.json({ ok: true });

  const supabase = createAdminClient();
  let reply = HELP;
  if (command.command === "start" && command.argument) {
    const { data: linked, error } = await supabase.rpc("link_notification_channel", {
      p_kind: kind,
      p_code: command.argument,
      p_chat_id: command.chatId,
    });
    if (error) throw new Error(error.message);
    reply = linked
      ? "✅ وصل شد. خلاصهٔ روزانهٔ پلنر از این پس همین‌جا فرستاده می‌شود. برای قطع: /stop"
      : "❌ این کد معتبر نیست یا منقضی شده. در تنظیمات تسکلندر کانال را دوباره بسازید.";
  } else if (command.command === "stop") {
    const { error } = await supabase.rpc("unlink_notification_chat", {
      p_kind: kind,
      p_chat_id: command.chatId,
    });
    if (error) throw new Error(error.message);
    reply = "ارسال خلاصه به این گفت‌وگو قطع شد.";
  }

  await sendBotMessage(kind, token, command.chatId, reply).catch((error) => {
    console.error(`${kind} bot reply failed:`, error);
  });
  return Response.json({ ok: true });
}
