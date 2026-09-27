import { afterEach, describe, expect, it } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import ResumeBulletsEditor from "../ResumeBulletsEditor.vue";
import type { ResumeBullet } from "@/lib/builtResume";

enableAutoUnmount(afterEach);

function mountEditor(initial: string[]) {
  const bullets = ref<ResumeBullet[]>(initial.map((text, index) => ({ id: `b${index}`, text })));
  const wrapper = mount(
    defineComponent({
      setup: () => () => h(ResumeBulletsEditor, { modelValue: bullets.value, "onUpdate:modelValue": (value: ResumeBullet[]) => (bullets.value = value) }),
    }),
    { attachTo: document.body },
  );
  return { wrapper, bullets };
}

const texts = (bullets: { value: ResumeBullet[] }) => bullets.value.map((bullet) => bullet.text);

describe("ResumeBulletsEditor", () => {
  it("starts a new line on Enter at the end of a line and focuses it", async () => {
    const { wrapper, bullets } = mountEditor(["Cut load time"]);
    const field = wrapper.get("textarea");
    (field.element as HTMLTextAreaElement).setSelectionRange(13, 13);
    await field.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(texts(bullets)).toEqual(["Cut load time", ""]);
    expect(document.activeElement).toBe(wrapper.findAll("textarea")[1]!.element);
  });

  it("leaves Enter alone in the middle of a line", async () => {
    const { wrapper, bullets } = mountEditor(["Cut load time"]);
    const field = wrapper.get("textarea");
    (field.element as HTMLTextAreaElement).setSelectionRange(3, 3);
    await field.trigger("keydown", { key: "Enter" });
    expect(texts(bullets)).toEqual(["Cut load time"]);
  });

  it("removes an empty line on Backspace and goes back to the one above", async () => {
    const { wrapper, bullets } = mountEditor(["First", ""]);
    await wrapper.findAll("textarea")[1]!.trigger("keydown", { key: "Backspace" });
    await flushPromises();
    expect(texts(bullets)).toEqual(["First"]);
    expect(document.activeElement).toBe(wrapper.get("textarea").element);
  });

  it("keeps the last line even when empty", async () => {
    const { wrapper, bullets } = mountEditor([""]);
    await wrapper.get("textarea").trigger("keydown", { key: "Backspace" });
    expect(texts(bullets)).toEqual([""]);
  });

  it("moves and deletes lines with labelled buttons", async () => {
    const { wrapper, bullets } = mountEditor(["A", "B", "C"]);
    await wrapper.get('[aria-label="Move line 3 up"]').trigger("click");
    expect(texts(bullets)).toEqual(["A", "C", "B"]);
    expect(wrapper.get('[aria-label="Move line 1 up"]').attributes("disabled")).toBeDefined();
    await wrapper.get('[aria-label="Delete line 1"]').trigger("click");
    expect(texts(bullets)).toEqual(["C", "B"]);
  });
});
