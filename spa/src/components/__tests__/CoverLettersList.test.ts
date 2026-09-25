import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { mount, RouterLinkStub } from "@vue/test-utils";
import { SearchSymbol } from "@/constants/symbols";

const letter = (id: string, companyName: string, position: string) => ({
  id,
  body: "Dear hiring team",
  createdAt: { toDate: () => new Date(2026, 8, 20) },
  jobApplication: { id: `job-${id}`, companyName, position },
});

vi.mock("@/composables/useCoverLetters", () => ({
  useCoverLetters: () => ({
    coverLetters: ref([letter("1", "Northwind Labs", "Senior Frontend Engineer"), letter("2", "Quillsoft", "Product Engineer")]),
    isLoading: ref(false),
  }),
}));

import CoverLettersList from "../CoverLettersList.vue";

describe("CoverLettersList", () => {
  it("shows only the letters that match the search", () => {
    const wrapper = mount(CoverLettersList, {
      global: {
        stubs: { RouterLink: RouterLinkStub },
        provide: { [SearchSymbol as symbol]: computed(() => "quill") },
      },
    });
    const rows = wrapper.findAll("li");
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain("Quillsoft");
  });
});
