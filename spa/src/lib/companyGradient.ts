const GRADIENT_PAIRS = [
  ["#f093fb", "#f5576c"], // pink → red
  ["#4facfe", "#00f2fe"], // blue → cyan
  ["#43e97b", "#38f9d7"], // green → teal
  ["#fa709a", "#fee140"], // pink → yellow
  ["#a18cd1", "#fbc2eb"], // purple → pink
  ["#fccb90", "#d57eeb"], // peach → purple
  ["#667eea", "#764ba2"], // indigo → purple
  ["#f6d365", "#fda085"], // yellow → salmon
  ["#89f7fe", "#66a6ff"], // cyan → blue
  ["#fddb92", "#d1fdff"], // gold → ice
  ["#a1c4fd", "#c2e9fb"], // light blue → sky
  ["#f5af19", "#f12711"], // amber → red
  ["#c471f5", "#fa71cd"], // violet → magenta
  ["#48c6ef", "#6f86d6"], // sky → slate blue
  ["#feada6", "#f5efef"], // blush → white
  ["#e0c3fc", "#8ec5fc"], // lavender → blue
] as const;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCompanyGradient(companyName: string): string {
  const index = hashString(companyName) % GRADIENT_PAIRS.length;
  const [from, to] = GRADIENT_PAIRS[index];
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}
