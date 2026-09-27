import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SavedJobCard from "../SavedJobCard.vue";

const requirements = [
  { status: "matched", importance: "must-have" },
  { status: "matched", importance: "must-have" },
  { status: "partial", importance: "must-have" },
  { status: "missing", importance: "nice-to-have" },
];

describe("SavedJobCard", () => {
  it("shows the job, where it is, and the match with its must-haves", () => {
    const wrapper = mount(SavedJobCard, {
      props: { position: "Senior Frontend Engineer", companyName: "Northwind Labs", location: "Hybrid, Berlin", matchScore: 82, requirements },
    });
    expect(wrapper.text()).toContain("Your saved job");
    expect(wrapper.text()).toContain("Senior Frontend Engineer");
    expect(wrapper.text()).toContain("Northwind Labs · Hybrid, Berlin");
    expect(wrapper.text()).toContain("Match 82");
    expect(wrapper.text()).toContain("2 of 3 must-haves met");
  });

  it("leaves the match out when there wasn't a check (extension saves)", () => {
    const wrapper = mount(SavedJobCard, { props: { position: "UI Engineer", companyName: "Tessel" } });
    expect(wrapper.text()).not.toContain("Match");
  });

  it("the phone version fits on one line per fact", () => {
    const wrapper = mount(SavedJobCard, {
      props: { position: "Senior Frontend Engineer", companyName: "Northwind Labs", matchScore: 82, compact: true },
    });
    expect(wrapper.text()).toContain("Northwind Labs · Match 82");
  });
});
