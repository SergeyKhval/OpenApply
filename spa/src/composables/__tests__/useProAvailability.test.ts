import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";

const callable = vi.fn();

vi.mock("@/firebase/config", () => ({ functions: {} }));
vi.mock("firebase/functions", () => ({
  httpsCallable: () => callable,
}));

const load = async () => (await import("../useProAvailability")).useProAvailability;

describe("useProAvailability", () => {
  beforeEach(() => {
    vi.resetModules();
    callable.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("is unknown until the server answers, then follows it", async () => {
    callable.mockResolvedValue({ data: { proAvailable: true } });
    const useProAvailability = await load();
    const { proAvailable } = useProAvailability();
    expect(proAvailable.value).toBeNull();
    await flushPromises();
    expect(proAvailable.value).toBe(true);
  });

  it("asks once per page load", async () => {
    callable.mockResolvedValue({ data: { proAvailable: false } });
    const useProAvailability = await load();
    useProAvailability();
    useProAvailability();
    await flushPromises();
    expect(callable).toHaveBeenCalledTimes(1);
  });

  it("treats a failure as not on sale and asks again next time", async () => {
    callable.mockRejectedValueOnce(new Error("offline"));
    const useProAvailability = await load();
    const { proAvailable } = useProAvailability();
    await flushPromises();
    expect(proAvailable.value).toBe(false);

    callable.mockResolvedValueOnce({ data: { proAvailable: true } });
    useProAvailability();
    await flushPromises();
    expect(proAvailable.value).toBe(true);
  });
});
