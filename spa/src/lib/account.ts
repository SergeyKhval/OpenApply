// Small labels for the account button and menu.

type DateLike = { toDate(): Date };

export function initialsOf(name?: string | null, email?: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const local = (email ?? "").split("@")[0].replace(/[^a-z0-9]/gi, "");
  return local.slice(0, 2).toUpperCase() || "?";
}

export function planLabel(
  plan: "free" | "pro" | null | undefined,
  billing?: { cancelAtPeriodEnd?: boolean; currentPeriodEnd?: DateLike | null } | null,
): string {
  if (plan !== "pro") return "Free plan";
  const end = billing?.cancelAtPeriodEnd ? billing.currentPeriodEnd?.toDate() : null;
  if (!end) return "Pro";
  return `Pro until ${end.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}`;
}
