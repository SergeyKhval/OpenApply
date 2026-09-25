import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ChoicePills from "../ChoicePills.vue";

const OPTIONS = [
  { value: "short", label: "Short" },
  { value: "standard", label: "Standard" },
];

describe("ChoicePills", () => {
  it("is a labelled radio group with the current choice checked", () => {
    const wrapper = mount(ChoicePills, { props: { label: "Length", options: OPTIONS, modelValue: "standard" } });
    const group = wrapper.get('[role="radiogroup"]');
    expect(wrapper.get(`#${group.attributes("aria-labelledby")}`).text()).toBe("Length");
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios.map((radio) => radio.attributes("aria-checked"))).toEqual(["false", "true"]);
  });

  it("picks on click and with the arrow keys", async () => {
    const wrapper = mount(ChoicePills, { props: { label: "Length", options: OPTIONS, modelValue: "standard" } });
    await wrapper.findAll('[role="radio"]')[0].trigger("click");
    await wrapper.get('[role="radiogroup"]').trigger("keydown", { key: "ArrowRight" });
    expect(wrapper.emitted("update:modelValue")).toEqual([["short"], ["short"]]);
  });
});
