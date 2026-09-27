// The name shown in the account menu and the jobs greeting. It lives on the
// Firebase auth user (displayName); Google fills it, code sign-in leaves it empty.

export const MAX_NAME_LENGTH = 80;

export function normalizeName(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/** A message for the name field, or null when the (normalized) name can be saved. */
export function nameError(name: string): string | null {
  if (name.length > MAX_NAME_LENGTH) return `Keep it under ${MAX_NAME_LENGTH} characters.`;
  return null;
}
