import { todayIso, type IsoDate } from "../dates";
import { sendBotMessage, type BotKind } from "./bots";
import { isDue } from "./schedule";
import { buildDailySummary, type SummaryInput } from "./summary";

// Sends today's summary to every linked channel whose send time has passed.
// Runs every 15 minutes (POST /api/cron/daily-summary); each run catches up
// on channels the previous ones missed or failed.

export interface DueChannel {
  id: string;
  user_id: string;
  kind: BotKind;
  chat_id: string;
  send_time: string;
  last_sent_on: string | null;
  include_tasks: boolean;
  include_blocks: boolean;
  include_note: boolean;
}

export interface SummarySource {
  // enabled channels with a linked chat
  linkedChannels(): Promise<DueChannel[]>;
  dayData(userId: string, day: IsoDate): Promise<Omit<SummaryInput, "day" | "include">>;
  markSent(channelId: string, day: IsoDate): Promise<void>;
}

export interface SendResult {
  sent: number;
  failed: number;
  // due, but that messenger's bot token isn't configured
  skipped: number;
}

export async function sendDueSummaries(
  source: SummarySource,
  now: Date,
  tokens: Partial<Record<BotKind, string>>,
  send: typeof sendBotMessage = sendBotMessage,
): Promise<SendResult> {
  const day = todayIso(now);
  const result: SendResult = { sent: 0, failed: 0, skipped: 0 };

  for (const channel of (await source.linkedChannels()).filter((c) => isDue(c, now))) {
    const token = tokens[channel.kind];
    if (!token) {
      result.skipped += 1;
      continue;
    }
    try {
      const data = await source.dayData(channel.user_id, day);
      const text = buildDailySummary({
        ...data,
        day,
        include: { tasks: channel.include_tasks, blocks: channel.include_blocks, note: channel.include_note },
      });
      await send(channel.kind, token, channel.chat_id, text);
      await source.markSent(channel.id, day);
      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      console.error(`daily summary for channel ${channel.id} failed:`, error);
    }
  }
  return result;
}
