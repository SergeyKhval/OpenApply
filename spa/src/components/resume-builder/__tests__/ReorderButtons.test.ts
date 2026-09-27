import { afterEach, describe, expect, it } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import ReorderButtons from "../ReorderButtons.vue";
import { moveInPlace } from "@/lib/builtResumeEdit";

enableAutoUnmount(afterEach);

function mountList(names: string[]) {
  const list = ref([...names]);
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(
          "div",
          list.value.map((name, index) =>
            h(ReorderButtons, {
              key: name,
              label: name,
              index,
              count: list.value.length,
              onMove: (delta: -1 | 1) => moveInPlace(list.value, index, delta),
            }),
          ),
        ),
    }),
    { attachTo: document.body },
  );
  return { wrapper, list };
}

describe("ReorderButtons", () => {
  it("keeps focus on the moved item's button", async () => {
    const { wrapper, list } = mountList(["A", "B", "C"]);
    const button = wrapper.get('[aria-label="Move C up"]');
    (button.element as HTMLButtonElement).focus();
    await button.trigger("click");
    await flushPromises();
    expect(list.value).toEqual(["A", "C", "B"]);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Move C up");
  });

  it("moves focus to the other arrow when the item reaches the end", async () => {
    const { wrapper, list } = mountList(["A", "B"]);
    const button = wrapper.get('[aria-label="Move B up"]');
    (button.element as HTMLButtonElement).focus();
    await button.trigger("click");
    await flushPromises();
    expect(list.value).toEqual(["B", "A"]);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Move B down");
  });
});
