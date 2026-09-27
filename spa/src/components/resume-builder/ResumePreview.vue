<template>
  <!-- The print view the PDF comes from, laid out at page width and scaled to
       fit, so line breaks match what you download -->
  <div ref="frame" class="overflow-hidden rounded-card border border-border bg-white shadow-card" :style="{ height: `${pageHeight * scale}px` }">
    <iframe
      ref="page"
      :srcdoc="html"
      :title="`Preview of ${title}`"
      class="block origin-top-left bg-white"
      :style="{ width: `${layoutWidth}px`, height: `${pageHeight}px`, transform: `scale(${scale})` }"
      sandbox="allow-same-origin"
      tabindex="-1"
      @load="measure"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { refDebounced, useElementSize } from "@vueuse/core";
import { structuredToDoc, type StructuredResume } from "@/lib/builtResume";
import { tailoredResumeHtml, type ExportTemplate } from "@/lib/tailoredResumeExport";

type ResumePreviewProps = { resume: StructuredResume; title: string; template?: ExportTemplate };

const { resume, title, template = "classic" } = defineProps<ResumePreviewProps>();

// US Letter at 96 dpi; A4 is close enough in width for a preview
const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;

// Rebuilt a moment after typing stops, not on every key
const source = computed(() => JSON.stringify(resume));
const settled = refDebounced(source, 300);
const html = computed(() => tailoredResumeHtml(structuredToDoc(JSON.parse(settled.value)), title, template));

// A page scaled much below 0.85 gets hard to read, so a narrower pane reflows
// the text at its own width instead (the print HTML slims its padding on phones)
const REFLOW_BELOW = 700;
const { width } = useElementSize(useTemplateRef<HTMLElement>("frame"));
const reflow = computed(() => width.value > 0 && width.value < REFLOW_BELOW);
const layoutWidth = computed(() => (reflow.value ? width.value : PAGE_WIDTH));
const scale = computed(() => (width.value && !reflow.value ? Math.min(1, width.value / PAGE_WIDTH) : 1));

// At least one page tall, longer when the resume runs over. Same-origin (no
// scripts allowed) only so the height can be read
const page = useTemplateRef<HTMLIFrameElement>("page");
const pageHeight = ref(PAGE_HEIGHT);
// Page-shaped on a desktop pane, only as tall as the text on a phone
const minHeight = computed(() => (!reflow.value ? PAGE_HEIGHT : width.value >= 480 ? Math.round((width.value * PAGE_HEIGHT) / PAGE_WIDTH) : 0));
function measure() {
  const body = page.value?.contentDocument?.body;
  pageHeight.value = Math.max(minHeight.value, body?.scrollHeight ?? 0);
}
// Switching between page and reflow changes the height the text needs
watch(layoutWidth, measure, { flush: "post" });
</script>
