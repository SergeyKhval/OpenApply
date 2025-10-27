<template>
  <form
    class="flex flex-col gap-4"
    @submit.prevent="emit('save', interviewForm as InterviewFormInterview)"
  >
    <div class="flex flex-col gap-2">
      <Label for="interview-name">Interview name</Label>
      <Input
        id="interview-name"
        v-model="interviewForm.name"
        placeholder="Screening call"
      />
    </div>

    <div class="flex flex-col gap-2">
      <Label>Interview date</Label>
      <Popover v-model:open="isDatePickerOpen">
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            :class="
              cn(
                'w-full justify-start text-left font-normal',
                !interviewForm.conductedAt && 'text-muted-foreground',
              )
            "
          >
            <PhCalendar size="16" />
            {{
              interviewForm.conductedAt
                ? df.format(interviewForm.conductedAt.toDate())
                : "Select date"
            }}
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0">
          <!-- @vue-skip -->
          <Calendar
            v-model="interviewForm.conductedAt"
            @update:model-value="handleDateSelect"
          />
        </PopoverContent>
      </Popover>
    </div>

    <div class="justify-end flex gap-2">
      <Button size="sm" type="submit">
        <PhCheckFat />
        Save
      </Button>
      <Button size="sm" variant="secondary" @click="emit('cancel')">
        <PhRewind />
        Cancel
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { Timestamp } from "firebase/firestore";
import {
  DateFormatter,
  fromDate,
  getLocalTimeZone,
  now,
} from "@internationalized/date";
import { cn } from "@/lib/utils.ts";
import { InterviewFormInterview } from "@/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PhCalendar, PhCheckFat, PhRewind } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type InterviewFormProps = {
  interview: {
    name: string;
    conductedAt?: Timestamp;
  };
};
type InterviewFormEmits = {
  (event: "save", payload: InterviewFormInterview): void;
  (event: "cancel"): void;
};

const { interview } = defineProps<InterviewFormProps>();
const emit = defineEmits<InterviewFormEmits>();

const df = new DateFormatter("en-US", {
  dateStyle: "long",
});

const interviewForm = reactive<InterviewFormInterview>({
  ...interview,
  conductedAt: interview.conductedAt
    ? fromDate(interview.conductedAt.toDate(), getLocalTimeZone())
    : now(getLocalTimeZone()),
});

const isDatePickerOpen = ref(false);

// @ts-expect-error - Used in template for Calendar component
const handleDateSelect = () => {
  isDatePickerOpen.value = false;
};

onKeyStroke("Escape", () => emit("cancel"));
</script>
