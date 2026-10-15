import { describe, expect, it, vi } from "vitest";
import { isBotKind, parseCommand, sendBotMessage, telegramLinkUrl } from "./bots";

describe("parseCommand", () => {
  it("reads /start with its code and the chat it came from", () => {
    expect(parseCommand({ message: { text: "/start 0123abcd", chat: { id: 42 } } }))
      .toEqual({ command: "start", argument: "0123abcd", chatId: "42" });
  });

  it("accepts a bot mention and extra spaces", () => {
    expect(parseCommand({ message: { text: "  /start@TaskalndarBot   abc ", chat: { id: -7 } } }))
      .toEqual({ command: "start", argument: "abc", chatId: "-7" });
  });

  it("reads /stop without an argument", () => {
    expect(parseCommand({ message: { text: "/stop", chat: { id: 1 } } }))
      .toEqual({ command: "stop", argument: "", chatId: "1" });
  });

  it("ignores updates that aren't text commands", () => {
    expect(parseCommand({ message: { text: "سلام", chat: { id: 1 } } })).toBeNull();
    expect(parseCommand({ edited_message: {} })).toBeNull();
    expect(parseCommand(null)).toBeNull();
    expect(parseCommand({ message: { text: "/start x" } })).toBeNull();
  });
});

describe("sendBotMessage", () => {
  it("posts to the bot API of the chosen messenger", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    await sendBotMessage("bale", "TOKEN", "42", "سلام", fetch);
    await sendBotMessage("telegram", "TOKEN", "42", "سلام", fetch);
    expect(fetch.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      "https://tapi.bale.ai/botTOKEN/sendMessage",
      "https://api.telegram.org/botTOKEN/sendMessage",
    ]);
    const init = (fetch.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ chat_id: "42", text: "سلام" });
  });

  it("throws when the API refuses, without leaking the token", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, description: "chat not found" }), { status: 400 }));
    const error = await sendBotMessage("telegram", "SECRET", "42", "x", fetch).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("chat not found");
    expect((error as Error).message).not.toContain("SECRET");
  });
});

describe("helpers", () => {
  it("recognizes the supported messengers", () => {
    expect(isBotKind("bale")).toBe(true);
    expect(isBotKind("telegram")).toBe(true);
    expect(isBotKind("sms")).toBe(false);
  });

  it("builds a Telegram deep link that starts the bot with the code", () => {
    expect(telegramLinkUrl("TaskalndarBot", "abc")).toBe("https://t.me/TaskalndarBot?start=abc");
  });
});
