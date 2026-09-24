import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { computed, ref } from "vue";

const plan = ref<"free" | "pro">("free");

vi.mock("@/composables/useAiAllowance", () => ({
  useAiAllowance: () => ({
    allowance: computed(() => ({ plan: plan.value })),
  }),
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}));

import SuccessCheckoutDialog from "../SuccessCheckoutDialog.vue";

const passThrough = { template: "<div><slot /></div>" };

const mountDialog = () =>
  mount(SuccessCheckoutDialog, {
    props: { isOpen: true },
    global: {
      stubs: {
        Dialog: passThrough,
        DialogContent: passThrough,
        DialogHeader: passThrough,
        DialogTitle: passThrough,
        DialogFooter: passThrough,
      },
    },
  });

describe("SuccessCheckoutDialog", () => {
  it("waits for the webhook before confirming Pro", () => {
    plan.value = "free";
    const wrapper = mountDialog();
    expect(wrapper.text()).toContain("Activating your plan");
    expect(wrapper.text()).not.toContain("150 AI checks a month");
  });

  it("confirms Pro once the subscription is synced", () => {
    plan.value = "pro";
    const wrapper = mountDialog();
    expect(wrapper.text()).toContain("Welcome to Pro");
    expect(wrapper.text()).toContain("You now have 150 AI checks a month.");
  });
});
