import { ref } from "vue";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { trackEvent } from "@/analytics";

type CheckoutResponse = { url: string };

type StartCheckoutResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

type CheckoutRequest = {
  priceId: string;
  success_url: string;
  cancel_url: string;
};

export function useCreditsCheckout() {
  const isProcessing = ref(false);
  const errorMessage = ref<string | null>(null);

  const startCheckout = async (
    priceId: string,
  ): Promise<StartCheckoutResult> => {
    const createStripeCheckoutSession = httpsCallable<
      CheckoutRequest,
      CheckoutResponse
    >(functions, "createStripeCheckoutSession");

    if (isProcessing.value) {
      return { success: false, error: "Purchase already in progress" };
    }

    try {
      isProcessing.value = true;
      errorMessage.value = null;
      const success_url = new URL(window.location.href);
      success_url.searchParams.append("dialog-name", "checkout-success");
      const cancel_url = new URL(window.location.href);
      cancel_url.searchParams.append("dialog-name", "checkout-canceled");

      const { data } = await createStripeCheckoutSession({
        priceId,
        success_url: success_url.href,
        cancel_url: cancel_url.href,
      });

      if (data?.url) {
        trackEvent("checkout_started", { priceId });
        window.open(data.url, "_blank");
        return { success: true };
      }

      throw new Error("Checkout session did not return a URL");
    } catch (error) {
      console.error("Failed to start checkout session", error);
      let message = "Unable to start checkout";

      const maybeError = error as { message?: string };
      if (
        typeof maybeError?.message === "string" &&
        maybeError.message.length
      ) {
        message = maybeError.message;
      }

      errorMessage.value = message;
      return { success: false, error: message };
    } finally {
      isProcessing.value = false;
    }
  };

  return {
    errorMessage,
    isProcessing,
    startCheckout,
  };
}
