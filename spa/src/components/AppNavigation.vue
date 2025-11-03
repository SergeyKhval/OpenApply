<template>
  <div class="lg:max-w-64 flex flex-col h-full">
    <div class="p-6 border-b border-sidebar-border h-20 flex items-center">
      <h2 class="text-xl font-semibold">
        <RouterLink to="/dashboard/applications">OpenApply</RouterLink>
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
      <div class="flex items-center mb-2">
        <div class="grow flex items-center gap-2">
          <PhCoins :size="32" />
          <Tooltip>
            <TooltipTrigger as-child>
              <p class="text-xl">
                {{ userProfile?.billingProfile?.currentBalance }}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              <p class="text-center">
                Coins are used for AI features,<br />
                e.g. cover letter generation
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Dialog>
          <DialogTrigger as-child>
            <Button size="sm">Top up</Button>
          </DialogTrigger>
          <DialogScrollContent class="md:min-w-200">
            <DialogHeader>
              <DialogTitle>Top up your coins</DialogTitle>
              <DialogDescription
                >Coins are used for AI features</DialogDescription
              >
            </DialogHeader>

            <CreditPackOptions
              :loading="isProcessing"
              @purchase="startCheckout"
            />
          </DialogScrollContent>
        </Dialog>
      </div>

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
            </div>
          </div>
          <DropdownMenuSeparator />
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
import { useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth.ts";
import {
  PhArchive,
  PhBriefcase,
  PhCaretUp,
  PhCoins,
  PhDiscordLogo,
  PhEnvelopeSimple,
  PhReadCvLogo,
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import CreditPackOptions from "@/components/CreditPackOptions.vue";
import { useCreditsCheckout } from "@/composables/useCreditsCheckout.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AppNavigationEmits = {
  (event: "close-nav"): void;
};

const emit = defineEmits<AppNavigationEmits>();

const { user, userProfile, logout } = useAuth();
const router = useRouter();

const navLinks = [
  {
    id: 1,
    name: "Applications",
    to: "/dashboard/applications",
    icon: PhBriefcase,
  },
  { id: 2, name: "Resumes", to: "/dashboard/resumes", icon: PhReadCvLogo },
  {
    id: 3,
    name: "Cover letters",
    to: "/dashboard/cover-letters",
    icon: PhEnvelopeSimple,
  },
  { id: 4, name: "Archive", to: "/dashboard/archive", icon: PhArchive },
];

const { startCheckout, isProcessing } = useCreditsCheckout();

const handleLogout = async () => {
  const result = await logout();
  if (result.success) {
    await router.push("/");
  }
};
</script>
