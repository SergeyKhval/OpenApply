import { computed } from "vue";
import { useAuth } from "@/composables/useAuth";
import { getAllowanceState } from "@/lib/aiAllowance";

export function useAiAllowance() {
  const { userProfile } = useAuth();

  const allowance = computed(() => {
    const billingProfile = userProfile.value?.billingProfile;
    return billingProfile ? getAllowanceState(billingProfile, new Date()) : null;
  });

  // Until the profile loads, let the server decide.
  const canUseAi = computed(() => allowance.value?.canUse ?? true);

  return { allowance, canUseAi };
}
