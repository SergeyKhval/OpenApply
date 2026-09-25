import { ref } from "vue";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

// null until the server answers. One request per page load, shared by every
// caller. Pro stays "coming soon" until the Stripe price is configured.
const proAvailable = ref<boolean | null>(null);
let request: Promise<void> | null = null;

export function useProAvailability() {
  if (!request) {
    request = httpsCallable<void, { proAvailable?: boolean }>(functions, "getProAvailability")()
      .then(({ data }) => {
        proAvailable.value = data?.proAvailable === true;
      })
      .catch((error) => {
        console.error("Failed to check whether Pro is on sale", error);
        proAvailable.value = false;
        request = null;
      });
  }
  return { proAvailable };
}
