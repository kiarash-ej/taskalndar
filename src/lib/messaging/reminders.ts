import { buildReminderText, type DueReminder } from "../reminders";
import { sendBotMessage, type BotKind } from "./bots";

// Sends the reminders due now (POST /api/cron/reminders, about once a minute).
// Claiming marks them sent first, so overlapping runs never double-send; a
// reminder no chat received is released for the next run to retry.

export interface ClaimedReminder extends DueReminder {
  block_id: string;
  user_id: string;
}

export interface ReminderChat {
  user_id: string;
  kind: BotKind;
  chat_id: string;
}

export interface ReminderSource {
  claimDue(): Promise<ClaimedReminder[]>;
  // every linked chat of these users
  chatsFor(userIds: string[]): Promise<ReminderChat[]>;
  release(blockIds: string[]): Promise<void>;
}

export interface ReminderResult {
  sent: number;
  failed: number;
}

export async function sendDueReminders(
  source: ReminderSource,
  now: Date,
  tokens: Partial<Record<BotKind, string>>,
  send: typeof sendBotMessage = sendBotMessage,
): Promise<ReminderResult> {
  const result: ReminderResult = { sent: 0, failed: 0 };
  const due = await source.claimDue();
  if (due.length === 0) return result;

  const chats = await source.chatsFor([...new Set(due.map((r) => r.user_id))]);
  const unsent: string[] = [];
  for (const reminder of due) {
    const text = buildReminderText(reminder, now);
    let delivered = false;
    for (const chat of chats.filter((c) => c.user_id === reminder.user_id)) {
      const token = tokens[chat.kind];
      if (!token) continue;
      try {
        await send(chat.kind, token, chat.chat_id, text);
        delivered = true;
      } catch (error) {
        console.error(`reminder for block ${reminder.block_id} via ${chat.kind} failed:`, error);
      }
    }
    if (delivered) result.sent += 1;
    else {
      result.failed += 1;
      unsent.push(reminder.block_id);
    }
  }
  if (unsent.length > 0) await source.release(unsent);
  return result;
}
