import { describe, expect, it } from "vitest";
import { CODE_PREFIX, decodeShare, encodeShare, parseBlockLines, shareLink, type SharePack } from "./share";

const pack: SharePack = {
  v: 1,
  templates: [
    {
      name: "روز دانشگاه",
      blocks: [
        { start: "16:00", end: "24:00", title: "درس", tags: ["دانشگاه"] },
        { start: "08:00", end: "09:30", title: "کلاس ریاضی", tags: [] },
      ],
    },
  ],
  sleep: [{ weekday: 0, bed: "23:00", wake: "07:00" }],
  tasks: [
    { title: "ورزش", weekdays: [0, 2, 4] },
    { title: "مطالعه", weekdays: null },
  ],
};

describe("share codes", () => {
  it("round-trips a pack, Persian text included, with blocks in time order", () => {
    const code = encodeShare(pack);
    expect(code.startsWith(CODE_PREFIX)).toBe(true);
    expect(code).toMatch(/^TSK1\.[\w-]+$/);
    const decoded = decodeShare(code);
    expect("pack" in decoded && decoded.pack.templates[0].blocks.map((b) => b.start)).toEqual(["08:00", "16:00"]);
    expect("pack" in decoded && decoded.pack.tasks).toEqual(pack.tasks);
    expect("pack" in decoded && decoded.pack.sleep).toEqual(pack.sleep);
  });

  it("reads a code out of a share link or surrounding text", () => {
    const code = encodeShare(pack);
    expect(decodeShare(shareLink("https://app.test", code))).toHaveProperty("pack");
    expect(decodeShare(`این رو وارد کن: ${code} ممنون`)).toHaveProperty("pack");
  });

  it("refuses broken, empty, foreign-version or invalid contents", () => {
    const code = encodeShare(pack);
    expect(decodeShare("hello")).toHaveProperty("error");
    expect(decodeShare(code.slice(0, -10))).toHaveProperty("error");
    expect(decodeShare(encodeShare({ v: 1, templates: [], sleep: [], tasks: [] }))).toEqual({ error: "این کد خالی است." });
    const forged = (body: unknown) => CODE_PREFIX + Buffer.from(JSON.stringify(body)).toString("base64url");
    expect(decodeShare(forged({ ...pack, v: 2 }))).toHaveProperty("error");
    // an hour-long block that ends before it starts, a 30-minute night, a duplicate night
    expect(decodeShare(forged({ ...pack, templates: [{ name: "x", blocks: [{ start: "10:00", end: "09:00", title: "x" }] }] })))
      .toHaveProperty("error");
    expect(decodeShare(forged({ ...pack, sleep: [{ weekday: 1, bed: "23:00", wake: "23:30" }] }))).toHaveProperty("error");
    expect(decodeShare(forged({ ...pack, sleep: [pack.sleep[0], pack.sleep[0]] }))).toHaveProperty("error");
    expect(decodeShare(forged({ ...pack, tasks: [{ title: "", weekdays: null }] }))).toHaveProperty("error");
  });

  it("normalizes tags and treats all seven days as every day", () => {
    const forged = CODE_PREFIX + Buffer.from(JSON.stringify({
      v: 1,
      templates: [{ name: "t", blocks: [{ start: "9:00", end: "10:00", title: "a", tags: ["#كار", "كار"] }] }],
      tasks: [{ title: "b", weekdays: [6, 5, 4, 3, 2, 1, 0] }],
    })).toString("base64url");
    const decoded = decodeShare(forged);
    expect("pack" in decoded && decoded.pack.templates[0].blocks[0]).toEqual({ start: "09:00", end: "10:00", title: "a", tags: ["کار"] });
    expect("pack" in decoded && decoded.pack.tasks[0].weekdays).toBeNull();
  });
});

describe("parseBlockLines", () => {
  it("reads lines from other apps, Persian digits and tags included", () => {
    expect(parseBlockLines("07:00-08:00 ورزش #سلامتی\n\n• ۱۶:۰۰ تا ۱۸:۰۰ درس ریاضی #درس #دانشگاه\n22:00 - 00:00 کتاب")).toEqual({
      blocks: [
        { start: "07:00", end: "08:00", title: "ورزش", tags: ["سلامتی"] },
        { start: "16:00", end: "18:00", title: "درس ریاضی", tags: ["درس", "دانشگاه"] },
        { start: "22:00", end: "24:00", title: "کتاب", tags: [] },
      ],
      badLines: [],
    });
  });

  it("reports the lines it can't read", () => {
    expect(parseBlockLines("ورزش صبح\n09:00-08:00 x\n10:00-11:00 درس").badLines).toEqual([1, 2]);
  });
});
