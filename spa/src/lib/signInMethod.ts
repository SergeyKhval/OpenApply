// "Signed in with …" line in Settings > Account. Accounts made with an emailed
// code have no provider (they sign in with a custom token).
const LABELS: Record<string, string> = {
  "google.com": "Google",
  password: "email and password",
};

export function signInMethodLabel(providerIds: string[]): string {
  const known = providerIds.map((id) => LABELS[id]).filter(Boolean);
  if (!known.length) return "Signed in with a code sent to your email";
  return `Signed in with ${known.join(" or ")}`;
}
