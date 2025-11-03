<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-3xl flex items-center gap-2">
        {{ credits }} coins
      </CardTitle>
    </CardHeader>

    <CardContent class="flex flex-col gap-3 mb-4 grow">
      <p class="text-4xl flex items-center">${{ price }}.00</p>
      <span
        class="text-chart-5 text-lg"
        :class="{ 'invisible hidden md:inline': !discount }"
      >
        Save {{ discount }}%
      </span>

      <Separator />
      <p class="text-muted-foreground">
        {{ Math.floor(credits / 10) }} AI resume reviews or cover letters
      </p>
    </CardContent>

    <CardFooter>
      <Button :disabled="loading" @click="emit('purchase')">
        <Spinner v-if="loading" />
        <PhCoins v-else />
        Purchase
      </Button>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PhCoins } from "@phosphor-icons/vue";
import { Spinner } from "@/components/ui/spinner";

type CreditsPriceCardProps = {
  price: number;
  credits: number;
  discount?: number;
  loading?: boolean;
};
type CreditsPriceCardEmits = {
  (event: "purchase"): void;
};

const {
  price,
  credits,
  discount = 0,
  loading = false,
} = defineProps<CreditsPriceCardProps>();
const emit = defineEmits<CreditsPriceCardEmits>();
</script>
