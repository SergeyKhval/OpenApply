import { ref } from "vue";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { trackEvent, type AiLimitSource } from "@/analytics";
import { useToast } from "@/components/ui/toast";

type UrlResponse = { url: string | null };

function currentUrlWithDialog(dialogName: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("dialog-name", dialogName);
  return url.href;
}

export function useProSubscription() {
  const isStartingCheckout = ref(false);
  const isOpeningPortal = ref(false);
  const { toast } = useToast();

  const showError = (description: string) =>
    toast({ title: "Something went wrong", description, variant: "destructive" });

  const startProCheckout = async (source: AiLimitSource) => {
    if (isStartingCheckout.value) return;
    isStartingCheckout.value = true;

    try {
      const createCheckout = httpsCallable<
        { success_url: string; cancel_url: string },
        UrlResponse
      >(functions, "createStripeCheckoutSession");
      const { data } = await createCheckout({
        success_url: currentUrlWithDialog("checkout-success"),
        cancel_url: currentUrlWithDialog("checkout-canceled"),
      });
      if (!data?.url) throw new Error("Checkout did not return a URL");

      trackEvent("checkout_started", { plan: "pro", source });
      window.location.assign(data.url);
    } catch (error) {
      console.error("Failed to start checkout", error);
      showError("We couldn't open checkout. Try again in a moment.");
      isStartingCheckout.value = false;
    }
  };

  const openBillingPortal = async () => {
    if (isOpeningPortal.value) return;
    isOpeningPortal.value = true;

    try {
      const createPortal = httpsCallable<{ return_url: string }, UrlResponse>(
        functions,
        "createBillingPortalSession",
      );
      const { data } = await createPortal({ return_url: window.location.href });
      if (!data?.url) throw new Error("Billing portal did not return a URL");

      trackEvent("billing_portal_opened");
      window.location.assign(data.url);
    } catch (error) {
      console.error("Failed to open billing portal", error);
      showError("We couldn't open your subscription settings. Try again in a moment.");
      isOpeningPortal.value = false;
    }
  };

  return { isStartingCheckout, isOpeningPortal, startProCheckout, openBillingPortal };
}
