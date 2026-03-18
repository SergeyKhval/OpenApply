import { ActionItem, DigestStats, GreetingTier } from "./digest";

export type DigestEmailData = {
  greeting: GreetingTier;
  summaryLine: string;
  stats: DigestStats;
  actions: ActionItem[];
  totalActionCount: number;
  appUrl: string;
};

const GREETING_TEXT: Record<GreetingTier, string> = {
  "great-week": "Great week! 🎉",
  "keep-it-up": "Keep it up!",
  "check-in": "Your weekly check-in",
};

const NUDGE_TEMPLATES: Record<ActionItem["category"], (days: number) => string> = {
  "decision-needed": (d) => `Offer received ${d} days ago. Respond before it expires.`,
  "needs-attention": (d) => `No interview updates in ${d} days. Check in with the recruiter.`,
  "follow-up": (d) => `Applied ${d} days ago, no response yet. Send a follow-up.`,
  "consider-archiving": (d) => `No activity in ${d} days. Consider archiving this one.`,
  "stale-draft": (d) => `Draft created ${d} days ago. Submit it or remove it.`,
};

const LINK_TEXT: Record<ActionItem["category"], string> = {
  "decision-needed": "Respond to offer",
  "needs-attention": "Update status",
  "follow-up": "Follow up",
  "consider-archiving": "Review application",
  "stale-draft": "Edit draft",
};

const DOT_COLORS: Record<ActionItem["category"], string> = {
  "decision-needed": "#ef4444",
  "needs-attention": "#f59e0b",
  "follow-up": "#3b82f6",
  "consider-archiving": "#3b82f6",
  "stale-draft": "#3b82f6",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildStatsHtml(stats: DigestStats): string {
  return `
    <div style="display: flex; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 28px; overflow: hidden;">
      <div style="flex: 1; text-align: center; padding: 16px 8px;">
        <span style="font-size: 24px; font-weight: 700; color: #0f172a; display: block;">${stats.newApps}</span>
        <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; display: block;">New Apps</span>
      </div>
      <div style="flex: 1; text-align: center; padding: 16px 8px; border-left: 1px solid #e2e8f0;">
        <span style="font-size: 24px; font-weight: 700; color: #0f172a; display: block;">${stats.interviews}</span>
        <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; display: block;">Interviews</span>
      </div>
      <div style="flex: 1; text-align: center; padding: 16px 8px; border-left: 1px solid #e2e8f0;">
        <span style="font-size: 24px; font-weight: 700; color: #0f172a; display: block;">${stats.offers}</span>
        <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; display: block;">Offers</span>
      </div>
    </div>`;
}

function buildActionsHtml(actions: ActionItem[], appUrl: string): string {
  if (actions.length === 0) return "";

  const cards = actions
    .map((action) => {
      const url = `${appUrl}/${action.applicationId}`;
      const nudge = NUDGE_TEMPLATES[action.category](action.daysSinceActivity);
      const linkText = LINK_TEXT[action.category];
      const dotColor = DOT_COLORS[action.category];

      return `
      <div style="padding: 14px 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 10px;">
        <p style="font-size: 15px; font-weight: 600; color: #0f172a; margin: 0;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${dotColor}; margin-right: 8px; vertical-align: middle;"></span>${escapeHtml(action.companyName)}
        </p>
        <p style="font-size: 13px; color: #64748b; margin: 2px 0 0 0;">${escapeHtml(action.position)}</p>
        <p style="font-size: 14px; color: #475569; margin: 8px 0 0 0; line-height: 1.4;">${escapeHtml(nudge)}</p>
        <a href="${escapeHtml(url)}" style="display: inline-block; font-size: 13px; color: #2563eb; text-decoration: none; font-weight: 500; margin-top: 6px;">${linkText} &rarr;</a>
      </div>`;
    })
    .join("");

  return `
    <h2 style="font-size: 15px; font-weight: 600; color: #0f172a; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.03em;">Needs your attention</h2>
    ${cards}`;
}

function buildCtaHtml(totalActionCount: number, appUrl: string): string {
  if (totalActionCount <= 3) return "";

  return `
    <div style="text-align: center; margin-top: 20px;">
      <a href="${escapeHtml(appUrl)}" style="display: inline-block; padding: 10px 24px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">View all applications &rarr;</a>
    </div>`;
}

export function buildDigestEmailHtml(data: DigestEmailData): string {
  const greetingText = GREETING_TEXT[data.greeting];
  const statsSection = buildStatsHtml(data.stats);
  const actionsSection = buildActionsHtml(data.actions, data.appUrl);
  const ctaSection = buildCtaHtml(data.totalActionCount, data.appUrl);

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

      <h1 style="font-size: 20px; font-weight: 600; color: #0f172a; margin: 0 0 6px 0;">
        ${escapeHtml(greetingText)}
      </h1>
      <p style="font-size: 15px; color: #475569; margin: 0 0 24px 0; line-height: 1.5;">
        ${escapeHtml(data.summaryLine)}
      </p>

      ${statsSection}
      ${actionsSection}
      ${ctaSection}

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />

      <!-- TODO: add Resend-managed unsubscribe link via Audiences API -->
      <p style="font-size: 12px; color: #94a3b8; margin: 0; text-align: center;">
        You're receiving this because you have an active job search on OpenApply.
      </p>

    </div>
  </div>
</body>
</html>`;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

export function buildDigestEmailText(data: DigestEmailData): string {
  const greetingText = GREETING_TEXT[data.greeting];

  const parts: string[] = [
    greetingText,
    "",
    data.summaryLine,
    "",
    `This week: ${pluralize(data.stats.newApps, "new app", "new apps")}, ${pluralize(data.stats.interviews, "interview", "interviews")}, ${pluralize(data.stats.offers, "offer", "offers")}`,
    "",
  ];

  if (data.actions.length > 0) {
    parts.push("NEEDS YOUR ATTENTION", "");
    data.actions.forEach((action, i) => {
      const nudge = NUDGE_TEMPLATES[action.category](action.daysSinceActivity);
      parts.push(`${i + 1}. ${action.companyName} (${action.position})`);
      parts.push(`   ${nudge}`);
      parts.push(`   ${data.appUrl}/${action.applicationId}`);
      parts.push("");
    });
  }

  if (data.totalActionCount > 3) {
    parts.push(`View all applications: ${data.appUrl}`);
    parts.push("");
  }

  // TODO: add Resend-managed unsubscribe link via Audiences API
  parts.push("---");

  return parts.join("\n");
}
