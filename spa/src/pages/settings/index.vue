<!-- /settings: "Me" on phones (the tab bar's third tab), a list of settings
     and account actions. Desktop has the sidebar menu, so it opens the first
     section instead. -->
<template>
  <div class="flex flex-col gap-5 px-4 pt-6 pb-8">
    <h1 class="text-[28px] font-extrabold">Me</h1>

    <section class="flex items-center gap-3 rounded-card border border-transparent bg-card p-4 shadow-card dark:border-border">
      <Avatar class="size-12">
        <AvatarImage v-if="user?.photoURL" :src="user.photoURL" alt="" />
        <AvatarFallback class="bg-secondary text-[15px] font-bold text-secondary-foreground">{{ initials }}</AvatarFallback>
      </Avatar>
      <div class="flex min-w-0 flex-col">
        <span class="truncate text-[17px] font-semibold">{{ user?.displayName || user?.email }}</span>
        <span class="truncate text-sm text-muted-foreground">
          <template v-if="user?.displayName">{{ user.email }} · </template>{{ plan }}
        </span>
      </div>
    </section>

    <section v-for="(group, index) in groups" :key="index" :class="GROUP">
      <Component
        :is="row.href ? 'a' : row.to ? RouterLink : 'button'"
        v-for="row in group"
        :key="row.label"
        v-bind="row.href ? { href: row.href, target: '_blank', rel: 'noopener noreferrer' } : row.to ? { to: row.to } : { type: 'button' }"
        :class="ROW"
        @click="row.action?.()"
      >
        <span class="grid size-9 shrink-0 place-items-center rounded-full bg-muted" :class="row.danger ? 'text-destructive' : 'text-soft-foreground'">
          <Component :is="row.icon" :size="18" />
        </span>
        <span class="flex min-w-0 grow flex-col">
          <span class="text-[15.5px] font-semibold" :class="{ 'text-destructive': row.danger }">{{ row.label }}</span>
          <span v-if="row.detail" class="text-[13px] text-muted-foreground">{{ row.detail }}</span>
        </span>
        <PhArrowSquareOut v-if="row.href" class="shrink-0 text-muted-foreground" />
        <PhCaretRight v-else-if="row.to" class="shrink-0 text-muted-foreground" />
      </Component>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, type Component as VueComponent } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  PhArrowSquareOut,
  PhCaretRight,
  PhChatCircle,
  PhDownloadSimple,
  PhEnvelopeSimple,
  PhGithubLogo,
  PhPalette,
  PhSignOut,
  PhSparkle,
  PhTrash,
} from "@phosphor-icons/vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAiAllowance } from "@/composables/useAiAllowance";
import { useAuth } from "@/composables/useAuth";
import { initialsOf, planLabel } from "@/lib/account";
import { GITHUB_URL, HELP_URL } from "@/constants/links";

defineOptions({ name: "SettingsMe" });

type Row = {
  label: string;
  icon: VueComponent;
  detail?: string;
  to?: string;
  href?: string;
  action?: () => void;
  danger?: boolean;
};

const GROUP = "flex flex-col divide-y divide-border overflow-hidden rounded-card border border-transparent bg-card shadow-card dark:border-border";
const ROW = "flex min-h-15 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60";

const router = useRouter();
const { user, userProfile, logout } = useAuth();
const { allowance } = useAiAllowance();

// Same breakpoint as the sidebar (lg)
const openFirstSectionOnDesktop = () => {
  if (window.matchMedia?.("(min-width: 1024px)").matches) router.replace("/settings/plan");
};
onMounted(openFirstSectionOnDesktop);
onActivated(openFirstSectionOnDesktop);

const initials = computed(() => initialsOf(user.value?.displayName, user.value?.email));
const plan = computed(() => planLabel(allowance.value?.plan, userProfile.value?.billingProfile));

async function signOut() {
  const result = await logout();
  if (result.success) await router.push("/");
}

const groups = computed<Row[][]>(() => [
  [
    {
      label: "Plan and AI usage",
      icon: PhSparkle,
      to: "/settings/plan",
      detail: allowance.value ? `${allowance.value.used} of ${allowance.value.limit} AI checks used` : undefined,
    },
    { label: "Import and export", icon: PhDownloadSimple, to: "/settings/import-export" },
    { label: "Email", icon: PhEnvelopeSimple, to: "/settings/email" },
    { label: "Appearance", icon: PhPalette, to: "/settings/appearance" },
  ],
  [
    { label: "Help and feedback", icon: PhChatCircle, href: HELP_URL },
    { label: "GitHub", icon: PhGithubLogo, href: GITHUB_URL },
  ],
  [
    { label: "Sign out", icon: PhSignOut, action: signOut },
    { label: "Delete account", icon: PhTrash, to: "/settings/account", danger: true },
  ],
]);
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
