import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb, OTHER, OWNER } from "./test-db";

let db: PGlite;

beforeAll(async () => { db = await migratedDb(); }, 30_000);
afterAll(async () => { await db?.close(); });

async function rows(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows;
}

async function rejects(sql: string, params: unknown[], error: RegExp) {
  await db.exec("savepoint expect_error");
  await expect(db.query(sql, params)).rejects.toThrow(error);
  await db.exec("rollback to savepoint expect_error");
}

async function channelCode(userId = OWNER, kind = "bale") {
  const [{ link_code }] = (await db.query<{ link_code: string }>(
    "insert into public.notification_channels (user_id, kind) values ($1, $2) returning link_code", [userId, kind],
  )).rows;
  return link_code;
}

const link = "select public.link_notification_channel($1, $2, $3) as linked";

describe("notification_channels", () => {
  it("gives a new channel a long random link code and evening defaults", async () => {
    await asUser(db, OWNER, async () => {
      const code = await channelCode();
      expect(code).toMatch(/^[0-9a-f]{32}$/);
      expect(await rows(`select enabled, send_time::text, include_tasks, include_blocks, include_note, chat_id,
        link_code_expires_at > now() as fresh from public.notification_channels`)).toEqual([{
        enabled: true, send_time: "21:00:00", include_tasks: true, include_blocks: true, include_note: true,
        chat_id: null, fresh: true,
      }]);
    });
  });

  it("lets the owner change settings but never the chat, code or send history", async () => {
    await asUser(db, OWNER, async () => {
      await channelCode();
      await db.query("update public.notification_channels set send_time = '07:30', include_note = false, enabled = false");
      await rejects("update public.notification_channels set chat_id = '123'", [], /permission denied/);
      await rejects("update public.notification_channels set link_code = 'x'", [], /permission denied/);
      await rejects("update public.notification_channels set last_sent_on = '2026-10-15'", [], /permission denied/);
      await rejects("insert into public.notification_channels (user_id, kind, chat_id) values ($1, 'telegram', '1')",
        [OWNER], /permission denied/);
      await rejects("update public.notification_channels set send_time = '07:10'", [], /check constraint/);
      await rejects("insert into public.notification_channels (user_id, kind) values ($1, 'sms')", [OWNER], /check constraint/);
      await rejects("insert into public.notification_channels (user_id, kind) values ($1, 'bale')", [OWNER], /duplicate key/);
      await db.query("delete from public.notification_channels");
    });
  });

  it("keeps channels private", async () => {
    await asUser(db, OWNER, async () => {
      await channelCode();
      await db.exec(`set local request.jwt.claim.sub = '${OTHER}'`);
      expect(await rows("select * from public.notification_channels")).toEqual([]);
      await rejects("insert into public.notification_channels (user_id, kind) values ($1, 'telegram')", [OWNER], /row-level security/);
    });
  });
});

describe("link_notification_channel", () => {
  it("links the chat that sends a valid code, once", async () => {
    await asUser(db, "service_role", async () => {
      const code = await channelCode();
      expect(await rows(link, ["telegram", code, "42"])).toEqual([{ linked: false }]); // wrong bot
      expect(await rows(link, ["bale", code, "42"])).toEqual([{ linked: true }]);
      expect(await rows("select chat_id, link_code, linked_at is not null as linked from public.notification_channels"))
        .toEqual([{ chat_id: "42", link_code: null, linked: true }]);
      expect(await rows(link, ["bale", code, "666"])).toEqual([{ linked: false }]); // already used
    });
  });

  it("refuses an expired code", async () => {
    await asUser(db, "service_role", async () => {
      const code = await channelCode();
      await db.query("update public.notification_channels set link_code_expires_at = now() - interval '1 minute'");
      expect(await rows(link, ["bale", code, "42"])).toEqual([{ linked: false }]);
    });
  });

  it("unlinks every channel of a chat that sends /stop", async () => {
    await asUser(db, "service_role", async () => {
      await db.query(link, ["bale", await channelCode(OWNER), "42"]);
      await db.query(link, ["bale", await channelCode(OTHER), "42"]);
      expect(await rows("select public.unlink_notification_chat('bale', '42') as removed")).toEqual([{ removed: 2 }]);
      expect(await rows("select * from public.notification_channels")).toEqual([]);
    });
  });

  it("can only be called with the service role", async () => {
    let code = "";
    await asUser(db, OWNER, async () => {
      code = await channelCode();
      await rejects(link, ["bale", code, "42"], /permission denied/);
      await rejects("select public.unlink_notification_chat('bale', '42')", [], /permission denied/);
    });
    await asUser(db, null, async () => {
      await rejects(link, ["bale", code, "42"], /permission denied/);
    });
  });
});
