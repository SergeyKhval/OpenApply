import { ref } from "vue";
import { defineStore } from "pinia";

export const useDrawerNavigationStore = defineStore("drawerNavigation", () => {
  const isOpen = ref(false);

  return {
    isOpen,
    open: () => {
      isOpen.value = true;
    },
    close: () => {
      isOpen.value = false;
    },
    toggle: () => {
      isOpen.value = !isOpen.value;
    },
    update: (value: boolean) => {
      isOpen.value = value;
    },
  };
});
