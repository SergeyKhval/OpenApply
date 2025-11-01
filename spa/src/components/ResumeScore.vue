<template>
  <svg viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(-90)">
      <circle
        r="80"
        stroke-width="5"
        pathLength="100"
        :stroke-dasharray="`${score} ${100 - score}`"
        :stroke="getMatchColor(score)"
        fill="none"
      />
    </g>
    <text
      x="2"
      y="6"
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="75"
      :fill="getMatchColor(score)"
    >
      {{ score }}
    </text>
  </svg>
</template>

<script setup lang="ts">
type ResumeScoreProps = {
  score: number;
};

const { score } = defineProps<ResumeScoreProps>();

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpHue(h1: number, h2: number, t: number) {
  const delta = ((((h2 - h1) % 360) + 540) % 360) - 180;
  return (h1 + delta * t + 360) % 360;
}

function getMatchColor(percent: number) {
  percent = Math.max(0, Math.min(100, percent));

  let L, C, h;

  if (percent < 50) {
    const t = percent / 50;
    // red → yellow
    L = lerp(0.6861, 0.769, t);
    C = lerp(0.2061, 0.188, t);
    h = lerpHue(14.9941, 70.08, t);
  } else {
    const t = (percent - 50) / 50;
    // yellow → green
    L = lerp(0.769, 0.7124, t);
    C = lerp(0.188, 0.0977, t);
    h = lerpHue(70.08, 186.6761, t);
  }

  // browser-compatible OKLCH string
  return `oklch(${L} ${C} ${h})`;
}
</script>
