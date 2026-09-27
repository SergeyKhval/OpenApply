import { describe, expect, it, vi } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import type { NextUpItem } from "@/lib/nextUp";
import type { JobApplication } from "@/types";

vi.mock("@/analytics", () => ({ trackEvent: vi.fn() }));

import NextUpCompact from "../NextUpCompact.vue";

const job = (id: string, companyName: string) => ({ id, companyName, position: "Engineer" }) as JobApplication;
const items: NextUpItem[] = [
  { kind: "follow-up", job: job("a", "Brightline Health"), dueAt: new Date(2026, 8, 25), overdueDays: 0 },
  {
    kind: "interview",
    job: job("b", "Northwind Labs"),
    interview: { name: "Tech screen", conductedAt: new Date(2026, 8, 26, 10) },
  } as unknown as NextUpItem,
  { kind: "stale-saved", job: job("c", "Quillsoft"), savedDaysAgo: 6 },
];

const mountList = (list = items) =>
  mount(NextUpCompact, { props: { items: list }, global: { stubs: { RouterLink: RouterLinkStub } } });

describe("NextUpCompact", () => {
  it("shows two rows and offers the rest", async () => {
    const wrapper = mountList();
    expect(wrapper.findAll("li")).toHaveLength(2);
    const all = wrapper.get("button");
    expect(all.text()).toBe("All 3");
    await all.trigger("click");
    expect(wrapper.findAll("li")).toHaveLength(3);
    expect(wrapper.get("button").text()).toBe("Less");
  });

  it("each row opens its job", () => {
    const links = mountList().findAllComponents(RouterLinkStub).map((link) => link.props("to"));
    expect(links).toEqual(["/jobs/a", "/jobs/b"]);
  });

  it("reads like the canvas", () => {
    const text = mountList().text();
    expect(text).toContain("This week");
    expect(text).toContain("Follow up with Brightline Health");
    expect(text).toContain("Tech screen");
  });

  it("has no All link with two or fewer, and hides when there's nothing to do", () => {
    expect(mountList(items.slice(0, 2)).find("button").exists()).toBe(false);
    expect(mountList([]).html()).toBe("<!--v-if-->");
  });
});
