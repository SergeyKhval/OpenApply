import { beforeEach, describe, expect, it, vi } from "vitest";

const { docs, where } = vi.hoisted(() => ({
  docs: [] as { id: string; data: () => Record<string, unknown> }[],
  where: vi.fn(),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: () => ({
      where: (...args: unknown[]) => {
        where(...args);
        return { limit: () => ({ get: async () => ({ docs }) }) };
      },
    }),
  }),
}));
vi.mock("firebase-functions/v2/https", () => ({ onRequest: (_: unknown, fn: Function) => fn }));

import { jobSignalsLookup } from "../jobSignalsLookup";

function response() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status: (code: number) => ((res.statusCode = code), res),
    json: (body: unknown) => ((res.body = body), res),
    send: (body: unknown) => ((res.body = body), res),
    set: (name: string, value: string) => ((res.headers[name] = value), res),
  };
  return res;
}
const lookup = async (query: Record<string, string>, method = "GET") => {
  const res = response();
  await (jobSignalsLookup as unknown as Function)({ method, query }, res);
  return res;
};

describe("jobSignalsLookup", () => {
  beforeEach(() => {
    docs.length = 0;
    where.mockClear();
  });

  it("returns the whole bucket for a 4-hex prefix, never hidden docs or reports under review", async () => {
    docs.push(
      { id: "abcd01", data: () => ({ signs: { firstSeenAt: "2026-01-01" }, reports: { no_reply_30d: { days: ["2026-09-01"] } } }) },
      { id: "abcd02", data: () => ({ signs: { firstSeenAt: "2026-02-01" }, hidden: true }) },
      { id: "abcd03", data: () => ({ signs: { firstSeenAt: "2026-03-01" }, reports: { asked_for_money: { days: [] } }, reportsHidden: true }) },
    );
    const res = await lookup({ p: "abcd" });
    expect(where).toHaveBeenCalledWith("keyPrefix", "==", "abcd");
    expect(res.body).toEqual({
      entries: [
        { hash: "abcd01", signs: { firstSeenAt: "2026-01-01" }, reports: { no_reply_30d: { days: ["2026-09-01"] } } },
        { hash: "abcd03", signs: { firstSeenAt: "2026-03-01" }, reports: null },
      ],
    });
    expect(res.headers["Cache-Control"]).toBe("public, max-age=300");
  });

  it("refuses anything but a 4-hex prefix, so a full hash is never sent", async () => {
    for (const p of ["abc", "abcde", "ABCD", "a".repeat(64)]) {
      expect((await lookup({ p })).statusCode).toBe(400);
    }
    expect((await lookup({ p: "abcd" }, "POST")).statusCode).toBe(405);
    expect(where).not.toHaveBeenCalled();
  });
});
