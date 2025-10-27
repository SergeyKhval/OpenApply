import { computed } from "vue";
import { useCollection, useCurrentUser } from "vuefire";
import { collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/firebase/config";
import type { Resume } from "@/types";

export function useResumes() {
  const user = useCurrentUser();
  
  const resumesQuery = computed(() =>
    user.value
      ? query(
          collection(db, "userResumes"),
          where("userId", "==", user.value.uid),
          orderBy("createdAt", "desc")
        )
      : null
  );
  
  return useCollection<Resume>(resumesQuery);
}