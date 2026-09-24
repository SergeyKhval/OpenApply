// Fallback avatar color for a company without a logo: one of the theme's
// seven avatar tints (--avatar-1..7 in shared/theme.css), stable per name.
const AVATAR_TINTS = 7;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCompanyAvatarColor(companyName: string): string {
  return `var(--avatar-${(hashString(companyName) % AVATAR_TINTS) + 1})`;
}
