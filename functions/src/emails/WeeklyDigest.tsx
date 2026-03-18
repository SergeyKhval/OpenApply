import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
  Row,
  Column,
  Tailwind,
} from "@react-email/components";
import { render } from "@react-email/render";
import type { ActionItem, DigestStats, GreetingTier } from "../lib/digest.js";

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

function StatsWidget({ stats }: { stats: DigestStats }) {
  const cells = [
    { value: stats.newApps, label: "New Apps" },
    { value: stats.interviews, label: "Interviews" },
    { value: stats.offers, label: "Offers" },
  ];

  return (
    <Row className="bg-[#f8fafc] rounded-lg border border-solid border-[#e2e8f0] mb-7 overflow-hidden">
      {cells.map((cell, i) => (
        <Column key={cell.label} className={`text-center py-4 px-2 ${i > 0 ? "border-l border-solid border-[#e2e8f0]" : ""}`}>
          <Text className="text-2xl font-bold text-[#0f172a] m-0">{cell.value}</Text>
          <Text className="text-xs text-[#64748b] uppercase tracking-wide mt-0.5 m-0">{cell.label}</Text>
        </Column>
      ))}
    </Row>
  );
}

function ActionCard({ action, appUrl }: { action: ActionItem; appUrl: string }) {
  const url = `${appUrl}/${action.applicationId}`;
  const nudge = NUDGE_TEMPLATES[action.category](action.daysSinceActivity);
  const linkText = LINK_TEXT[action.category];
  const dotColor = DOT_COLORS[action.category];

  return (
    <Section className="p-3.5 px-4 bg-white border border-solid border-[#e2e8f0] rounded-lg mb-2.5">
      <Text className="text-[15px] font-semibold text-[#0f172a] m-0">
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: dotColor,
            marginRight: "8px",
            verticalAlign: "middle",
          }}
        />
        {action.companyName}
      </Text>
      <Text className="text-[13px] text-[#64748b] mt-0.5 m-0">{action.position}</Text>
      <Text className="text-sm text-[#475569] mt-2 m-0 leading-snug">{nudge}</Text>
      <Button href={url} className="text-[13px] text-[#2563eb] no-underline font-medium mt-1.5">
        {linkText} &rarr;
      </Button>
    </Section>
  );
}

export default function WeeklyDigest({
  greeting,
  summaryLine,
  stats,
  actions,
  totalActionCount,
  appUrl,
}: DigestEmailData) {
  const greetingText = GREETING_TEXT[greeting];

  return (
    <Html lang="en">
      <Head />
      <Tailwind>
        <Body className="m-0 p-0 bg-[#f8fafc] font-sans">
          <Container className="max-w-[600px] mx-auto py-8 px-4">
            <Section className="bg-white rounded-lg p-8 shadow-sm">
              <Heading className="text-xl font-semibold text-[#0f172a] m-0 mb-1.5">
                {greetingText}
              </Heading>
              <Text className="text-[15px] text-[#475569] m-0 mb-6 leading-normal">
                {summaryLine}
              </Text>

              <StatsWidget stats={stats} />

              {actions.length > 0 && (
                <>
                  <Heading as="h2" className="text-[15px] font-semibold text-[#0f172a] m-0 mb-4 uppercase tracking-wide">
                    Needs your attention
                  </Heading>
                  {actions.map((action) => (
                    <ActionCard key={action.applicationId} action={action} appUrl={appUrl} />
                  ))}
                </>
              )}

              {totalActionCount > 3 && (
                <Section className="text-center mt-5">
                  <Button
                    href={appUrl}
                    className="inline-block py-2.5 px-6 bg-[#0f172a] text-white no-underline rounded-md text-sm font-medium"
                  >
                    View all applications &rarr;
                  </Button>
                </Section>
              )}

              <Hr className="border-[#e2e8f0] my-7" />

              {/* TODO: add Resend-managed unsubscribe link via Audiences API */}
              <Text className="text-xs text-[#94a3b8] m-0 text-center">
                You're receiving this because you have an active job search on OpenApply.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

WeeklyDigest.PreviewProps = {
  greeting: "great-week",
  summaryLine:
    "You received 1 offer and submitted 1 new application this week. Here's a quick look at your job search this week.",
  stats: { newApps: 1, interviews: 0, offers: 1 },
  actions: [
    { applicationId: "id-1", companyName: "OldCorp", position: "Designer", category: "decision-needed", daysSinceActivity: 4 },
    { applicationId: "id-2", companyName: "SlowInc", position: "Engineer", category: "follow-up", daysSinceActivity: 12 },
  ],
  totalActionCount: 2,
  appUrl: "https://openapply.app/app/dashboard/applications",
} satisfies DigestEmailData;

// --- Public render API ---

export async function renderWeeklyDigest(
  data: DigestEmailData,
): Promise<string> {
  return render(<WeeklyDigest {...data} />);
}
