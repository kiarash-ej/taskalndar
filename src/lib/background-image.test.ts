import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), download: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { GET } from "../app/background-image/route";
import { backgroundImageUrl } from "./profile";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "owner" });
  mocks.download.mockResolvedValue({ data: new Blob(["img"], { type: "image/webp" }), error: null });
  mocks.client.mockResolvedValue({ storage: { from: () => ({ download: mocks.download }) } });
});

const get = (path: string) => GET(new NextRequest(`http://localhost${backgroundImageUrl(path)}`));

describe("GET /background-image", () => {
  it("serves the user's own image with a long private cache", async () => {
    const response = await get("owner/a b.webp");
    expect(response.status).toBe(200);
    expect(mocks.download).toHaveBeenCalledWith("owner/a b.webp");
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(await response.text()).toBe("img");
  });

  it("refuses other users' paths and signed-out requests", async () => {
    expect((await get("other/x.png")).status).toBe(404);
    expect((await get("owner/../other/x.png")).status).toBe(404);
    mocks.user.mockResolvedValue(null);
    expect((await get("owner/x.png")).status).toBe(401);
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("answers 404 when storage has no such file", async () => {
    mocks.download.mockResolvedValue({ data: null, error: { message: "not found" } });
    expect((await get("owner/gone.png")).status).toBe(404);
  });
});
