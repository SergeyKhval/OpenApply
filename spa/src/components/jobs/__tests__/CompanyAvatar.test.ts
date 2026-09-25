import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import CompanyAvatar from "../CompanyAvatar.vue";

const initials = (companyName: string) => mount(CompanyAvatar, { props: { companyName } }).text();

describe("CompanyAvatar initials", () => {
  it.each([
    ["Northwind Labs", "NL"],
    ["Cedar & Co", "CC"],
    ["Quillsoft", "QU"],
    ["  Émile   Studio ", "ÉS"],
    ["&", "&"],
  ])("%s -> %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
