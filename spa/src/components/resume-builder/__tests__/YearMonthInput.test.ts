import { afterEach, describe, expect, it } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import YearMonthInput from "../YearMonthInput.vue";
import type { YearMonth } from "@/lib/builtResume";

enableAutoUnmount(afterEach);

function mountInput(initial: YearMonth | null) {
  const value = ref<YearMonth | null>(initial);
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(YearMonthInput, { label: "Start", modelValue: value.value, "onUpdate:modelValue": (next: YearMonth | null) => (value.value = next) }),
    }),
  );
  return { wrapper, value };
}

describe("YearMonthInput", () => {
  it("waits for a year before a month-only pick becomes a date", async () => {
    const { wrapper, value } = mountInput(null);
    await wrapper.get("select").setValue("3");
    expect(value.value).toBeNull();
    await wrapper.get("input").setValue("2021");
    expect(value.value).toEqual({ year: 2021, month: 3 });
  });

  it("keeps the month while the year is retyped", async () => {
    const { wrapper, value } = mountInput({ year: 2021, month: 3 });
    await wrapper.get("input").setValue("");
    expect(value.value).toBeNull();
    expect((wrapper.get("select").element as HTMLSelectElement).value).toBe("3");
    await wrapper.get("input").setValue("2022");
    expect(value.value).toEqual({ year: 2022, month: 3 });
  });

  it("changes and clears the month of a full date", async () => {
    const { wrapper, value } = mountInput({ year: 2021, month: 3 });
    await wrapper.get("select").setValue("7");
    expect(value.value).toEqual({ year: 2021, month: 7 });
    await wrapper.get("select").setValue("");
    expect(value.value).toEqual({ year: 2021, month: null });
  });

  it("follows a date set from outside", async () => {
    const { wrapper, value } = mountInput(null);
    value.value = { year: 2019, month: 11 };
    await wrapper.vm.$nextTick();
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("2019");
    expect((wrapper.get("select").element as HTMLSelectElement).value).toBe("11");
  });
});
