<template>
  <div class="lg:max-w-64 flex flex-col h-full">
    <div class="p-6 border-b border-sidebar-border h-20 flex items-center">
      <h2 class="text-xl font-semibold">
        <RouterLink to="/jobs">OpenApply</RouterLink>
      </h2>
    </div>

    <nav class="flex-1 p-4 flex flex-col border-b border-b-border">
      <ul class="flex flex-col gap-1 flex-1">
        <li v-for="link in navLinks" :key="link.id">
          <RouterLink
            :to="link.to"
            class="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent transition-colors"
            active-class="bg-accent"
            @click="emit('close-nav')"
          >
            <Component :is="link.icon" :size="20" />
            <span>{{ link.name }}</span>
          </RouterLink>
        </li>
      </ul>
      <div class="rounded-lg border border-dashed border-sidebar-border/70 p-4">
        <p class="text-sm font-medium text-foreground">Join the community</p>
        <p class="mt-1 text-sm text-muted-foreground">
          Share wins, trade progress updates, and get feedback in Discord.
        </p>
        <a
          href="https://discord.gg/VSPCrpbbZb"
          class="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          <PhDiscordLogo :size="18" />
          Open Discord
        </a>
      </div>
    </nav>

    <div class="p-4">
      <DropdownMenu v-slot="{ open }">
        <DropdownMenuTrigger
          class="flex w-full items-center gap-2 cursor-pointer hover:bg-accent rounded-lg p-2"
        >
          <Avatar>
            <AvatarImage :src="user?.photoURL || ''" />
            <AvatarFallback>
              <PhUser />
            </AvatarFallback>
          </Avatar>
          <span class="grow text-left truncate">
            {{ user?.displayName || user?.email }}
          </span>

          <PhCaretUp class="transition-all" :class="{ 'rotate-180': open }" />
        </DropdownMenuTrigger>
        <DropdownMenuContent class="p-2 min-w-75">
          <div class="flex items-center gap-3 mb-2">
            <Avatar>
              <AvatarImage :src="user?.photoURL || ''" />
              <AvatarFallback>
                <PhUser />
              </AvatarFallback>
            </Avatar>
            <div>
              <p v-if="user?.displayName" class="text-lg">
                {{ user?.displayName }}
              </p>
              <p class="text-xs text-muted-foreground">{{ user?.email }}</p>
              <p v-if="proLabel" class="text-xs font-medium text-primary">
                {{ proLabel }}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem as-child>
            <RouterLink to="/settings" @click="emit('close-nav')">
              <PhGear />
              Settings
            </RouterLink>
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="hasSubscription"
            :disabled="isOpeningPortal"
            @click="openBillingPortal"
          >
            <PhCreditCard />
            Manage subscription
          </DropdownMenuItem>
          <DropdownMenuItem @click="handleLogout">
            <PhSignOut />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth.ts";
import {
  PhBriefcase,
  PhCaretUp,
  PhCreditCard,
  PhDiscordLogo,
  PhFiles,
  PhGear,
  PhSignOut,
  PhUser,
} from "@phosphor-icons/vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAiAllowance } from "@/composables/useAiAllowance";
import { useProSubscription } from "@/composables/useProSubscription";

type AppNavigationEmits = {
  (event: "close-nav"): void;
};

const emit = defineEmits<AppNavigationEmits>();

const { user, userProfile, logout } = useAuth();
const router = useRouter();

const navLinks = [
  { id: 1, name: "Jobs", to: "/jobs", icon: PhBriefcase },
  { id: 2, name: "Documents", to: "/documents", icon: PhFiles },
];

const { allowance } = useAiAllowance();
const { isOpeningPortal, openBillingPortal } = useProSubscription();

// Anyone with a Stripe subscription (even a lapsed one) can manage it.
const hasSubscription = computed(
  () => !!userProfile.value?.billingProfile?.stripeSubscriptionId,
);

const proLabel = computed(() => {
  const billing = userProfile.value?.billingProfile;
  if (allowance.value?.plan !== "pro") return null;
  if (billing?.cancelAtPeriodEnd && billing.currentPeriodEnd) {
    const endDate = billing.currentPeriodEnd.toDate().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    return `Pro until ${endDate}`;
  }
  return "Pro";
});

const handleLogout = async () => {
  const result = await logout();
  if (result.success) {
    await router.push("/");
  }
};
</script>
