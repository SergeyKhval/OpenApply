import { DigestResult, ActionItem, WinItem } from "./digest";

const CATEGORY_LABELS: Record<string, string> = {
  "decision-needed": "Offers Awaiting Decision",
  "needs-attention": "Interviews Needing Attention",
  "follow-up": "Follow Up on Applications",
  "stale-draft": "Stale Drafts",
  "consider-archiving": "Consider Archiving",
};

const CATEGORY_ORDER = [
  "decision-needed",
  "needs-attention",
  "follow-up",
  "stale-draft",
  "consider-archiving",
] as const;

const WIN_LABELS: Record<string, string> = {
  "offer-received": "Offer received",
  "moved-forward": "Moved forward",
  "new-application": "New application",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function groupActionsByCategory(actions: ActionItem[]): Map<string, ActionItem[]> {
  const map = new Map<string, ActionItem[]>();
  for (const action of actions) {
    const existing = map.get(action.category) ?? [];
    existing.push(action);
    map.set(action.category, existing);
  }
  return map;
}

function buildWinsHtml(wins: WinItem[]): string {
  if (wins.length === 0) return "";

  const items = wins
    .map((win) => {
      const label = WIN_LABELS[win.type] ?? win.type;
      return `
        <li style="margin-bottom: 8px;">
          <span style="color: #16a34a; font-weight: 600;">${label}:</span>
          ${escapeHtml(win.companyName)} — ${escapeHtml(win.position)}
        </li>`;
    })
    .join("");

  return `
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 18px; color: #166534; margin: 0 0 12px 0;">This Week's Wins</h2>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${items}
      </ul>
    </div>`;
}

function buildActionsHtml(actions: ActionItem[], appUrl: string): string {
  if (actions.length === 0) return "";

  const grouped = groupActionsByCategory(actions);
  const sections: string[] = [];

  for (const category of CATEGORY_ORDER) {
    const items = grouped.get(category);
    if (!items || items.length === 0) continue;

    const label = CATEGORY_LABELS[category];
    const listItems = items
      .map((item) => {
        const url = `${appUrl}/${item.applicationId}`;
        return `
          <li style="margin-bottom: 10px;">
            <a href="${escapeHtml(url)}" style="color: #1d4ed8; text-decoration: none; font-weight: 600;">
              ${escapeHtml(item.companyName)} — ${escapeHtml(item.position)}
            </a>
            <span style="color: #6b7280; font-size: 13px;"> (${item.daysSinceActivity} days ago)</span>
          </li>`;
      })
      .join("");

    sections.push(`
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 17px; color: #1e293b; margin: 0 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
          ${label}
        </h2>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${listItems}
        </ul>
      </div>`);
  }

  return sections.join("");
}

export function buildDigestEmailHtml(digest: DigestResult, appUrl: string): string {
  const winsSection = buildWinsHtml(digest.wins);
  const actionsSection = buildActionsHtml(digest.actions, appUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Weekly Job Search Update</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px;">
    <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

      <h1 style="font-size: 22px; color: #0f172a; margin: 0 0 24px 0;">
        Your Weekly Job Search Update
      </h1>

      ${winsSection}
      ${actionsSection}

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px 0;" />

      <p style="font-size: 12px; color: #94a3b8; margin: 0; text-align: center;">
        You're receiving this because you have an active job search on OpenApply.<br />
        <a href="{{unsubscribeUrl}}" style="color: #94a3b8;">Unsubscribe</a> from weekly digest emails.
      </p>

    </div>
  </div>
</body>
</html>`;
}

function buildWinsText(wins: WinItem[]): string {
  if (wins.length === 0) return "";

  const lines = ["This Week's Wins", "----------------"];
  for (const win of wins) {
    const label = WIN_LABELS[win.type] ?? win.type;
    lines.push(`  - ${label}: ${win.companyName} — ${win.position}`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildActionsText(actions: ActionItem[], appUrl: string): string {
  if (actions.length === 0) return "";

  const grouped = groupActionsByCategory(actions);
  const sections: string[] = [];

  for (const category of CATEGORY_ORDER) {
    const items = grouped.get(category);
    if (!items || items.length === 0) continue;

    const label = CATEGORY_LABELS[category];
    const lines = [label, "-".repeat(label.length)];

    for (const item of items) {
      lines.push(`  - ${item.companyName} — ${item.position} (${item.daysSinceActivity} days ago)`);
      lines.push(`    ${appUrl}/${item.applicationId}`);
    }
    lines.push("");
    sections.push(lines.join("\n"));
  }

  return sections.join("\n");
}

export function buildDigestEmailText(digest: DigestResult, appUrl: string): string {
  const parts: string[] = [
    "Your Weekly Job Search Update",
    "==============================",
    "",
  ];

  const winsSection = buildWinsText(digest.wins);
  if (winsSection) parts.push(winsSection);

  const actionsSection = buildActionsText(digest.actions, appUrl);
  if (actionsSection) parts.push(actionsSection);

  parts.push(
    "---",
    "To unsubscribe from weekly digest emails, visit your account settings.",
    "{{unsubscribeUrl}}",
  );

  return parts.join("\n");
}
