<!-- Account button at the bottom of the sidebar and the menu it opens -->
<template>
  <DropdownMenu v-slot="{ open }">
    <DropdownMenuTrigger
      class="flex w-full cursor-pointer items-center gap-2.5 border-t border-border px-2 pt-3 pb-1 text-left text-sm"
    >
      <Avatar class="size-[34px]">
        <AvatarImage v-if="user?.photoURL" :src="user.photoURL" alt="" />
        <AvatarFallback class="bg-secondary text-[13px] font-bold text-secondary-foreground">{{ initials }}</AvatarFallback>
      </Avatar>
      <span class="flex min-w-0 flex-col">
        <span class="truncate font-semibold">{{ user?.displayName || user?.email }}</span>
        <span class="text-[12.5px] text-muted-foreground">{{ plan }}</span>
      </span>
      <PhCaretDown class="ml-auto shrink-0 text-muted-foreground transition-transform" :class="{ 'rotate-180': open }" />
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="start" class="w-[var(--reka-dropdown-menu-trigger-width)] min-w-56">
      <DropdownMenuLabel class="truncate text-[13px] font-normal text-muted-foreground">{{ user?.email }}</DropdownMenuLabel>
      <DropdownMenuItem as-child>
        <RouterLink to="/settings/plan"><PhGear />Settings</RouterLink>
      </DropdownMenuItem>
      <DropdownMenuItem v-if="hasSubscription" :disabled="isOpeningPortal" @select="openBillingPortal">
        <PhCreditCard />Manage subscription
      </DropdownMenuItem>
      <DropdownMenuItem as-child>
        <a :href="HELP_URL" target="_blank" rel="noopener noreferrer nofollow"><PhChatCircle />Help and feedback</a>
      </DropdownMenuItem>
      <DropdownMenuItem as-child>
        <a :href="GITHUB_URL" target="_blank" rel="noopener noreferrer"><PhGithubLogo />GitHub</a>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="signOut"><PhSignOut />Sign out</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { PhCaretDown, PhChatCircle, PhCreditCard, PhGear, PhGithubLogo, PhSignOut } from "@phosphor-icons/vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAiAllowance } from "@/composables/useAiAllowance";
import { useAuth } from "@/composables/useAuth";
import { useProSubscription } from "@/composables/useProSubscription";
import { initialsOf, planLabel } from "@/lib/account";
import { GITHUB_URL, HELP_URL } from "@/constants/links";

const { user, userProfile, logout } = useAuth();
const { allowance } = useAiAllowance();
const { isOpeningPortal, openBillingPortal } = useProSubscription();
const router = useRouter();

const initials = computed(() => initialsOf(user.value?.displayName, user.value?.email));
const plan = computed(() => planLabel(allowance.value?.plan, userProfile.value?.billingProfile));
// Anyone with a Stripe subscription (even a lapsed one) can manage it.
const hasSubscription = computed(() => !!userProfile.value?.billingProfile?.stripeSubscriptionId);

async function signOut() {
  const result = await logout();
  if (result.success) await router.push("/");
}
</script>
