import type { Contact, Interview, JobApplication, JobApplicationNote } from "@/types";
import { CLOSED_REASON_LABELS, closedReason } from "@/lib/stages";
import { toJsDate } from "@/lib/jobDates";

// One history per job: notes, interviews, contacts and stage changes, which
// used to be three separate cards. Upcoming interviews sit on top.
export type TimelineEntry =
  | { kind: "note"; id: string; date: Date; title: string; note: JobApplicationNote; upcoming: false }
  | { kind: "interview"; id: string; date: Date; title: string; interview: Interview; upcoming: boolean }
  | { kind: "contact"; id: string; date: Date; title: string; contact: Contact; upcoming: false }
  | { kind: "stage"; id: string; date: Date; title: string; upcoming: false };

type TimelineSources = {
  job: JobApplication;
  notes: JobApplicationNote[];
  interviews: Interview[];
  contacts: Contact[];
};

const STAGE_EVENTS: { field: keyof JobApplication; title: string }[] = [
  { field: "createdAt", title: "Saved" },
  { field: "appliedAt", title: "Applied" },
  { field: "interviewedAt", title: "Moved to Interviewing" },
  { field: "offeredAt", title: "Offer" },
  { field: "hiredAt", title: "Hired" },
  { field: "archivedAt", title: "Archived" },
];

export function buildTimeline({ job, notes, interviews, contacts }: TimelineSources, now: Date): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const { field, title } of STAGE_EVENTS) {
    const date = toJsDate(job[field]);
    if (date) entries.push({ kind: "stage", id: `stage-${field}`, date, title, upcoming: false });
  }

  // Rejected and withdrew have no date field of their own: use the last update
  const reason = closedReason(job.status);
  if (reason === "rejected" || reason === "withdrew") {
    const date = toJsDate(job.updatedAt) ?? now;
    entries.push({ kind: "stage", id: "stage-closed", date, title: `Closed as ${CLOSED_REASON_LABELS[reason]}`, upcoming: false });
  }

  // A note just written has no server timestamp yet: treat it as now
  for (const note of notes) {
    entries.push({ kind: "note", id: note.id, date: toJsDate(note.createdAt) ?? now, title: "Note", note, upcoming: false });
  }

  for (const interview of interviews) {
    const date = toJsDate(interview.conductedAt) ?? now;
    entries.push({ kind: "interview", id: interview.id, date, title: interview.name, interview, upcoming: date > now });
  }

  for (const contact of contacts) {
    const name = `${contact.firstName} ${contact.lastName}`.trim() || contact.email || "Contact";
    entries.push({ kind: "contact", id: contact.id, date: toJsDate(contact.createdAt) ?? now, title: name, contact, upcoming: false });
  }

  const upcoming = entries.filter((entry) => entry.upcoming).sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = entries.filter((entry) => !entry.upcoming).sort((a, b) => b.date.getTime() - a.date.getTime());
  return [...upcoming, ...past];
}
