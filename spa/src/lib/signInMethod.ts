// "Signed in with …" line in Settings > Account. Accounts made with an emailed
// code have no provider (they sign in with a custom token); accounts made with
// the old password sign-up still list "password" but now sign in with a code.
const EMAIL_CODE = "a code sent to your email";
const LABELS: Record<string, string> = {
  "google.com": "Google",
  password: EMAIL_CODE,
};

export function signInMethodLabel(providerIds: string[]): string {
  const known = [...new Set(providerIds.map((id) => LABELS[id]).filter(Boolean))];
  if (!known.length) return `Signed in with ${EMAIL_CODE}`;
  return `Signed in with ${known.join(" or ")}`;
}
