import type { Contact, JobApplication } from "@/types";
import { toJsDate } from "@/lib/jobDates";

export type PersonJob = { jobApplicationId: string; companyName: string; position: string };

export type PersonGroup = {
  key: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  jobs: PersonJob[];
  lastInteractionAt: Date | null;
};

type JobsById = Record<string, Pick<JobApplication, "id" | "companyName" | "position"> | undefined>;

const norm = (value: string) => value.trim().toLowerCase();

// Same person if the email matches; otherwise same (trimmed, case-insensitive)
// full name at the same company, since two different people can share a name
// at different companies, and a lone name with no company is too weak to merge.
function personKey(contact: Contact, companyName: string): string {
  const email = norm(contact.email ?? "");
  if (email) return `email:${email}`;
  const name = `${norm(contact.firstName ?? "")}|${norm(contact.lastName ?? "")}`;
  return `name:${name}|${norm(companyName)}`;
}

// Cross-job directory of people, grouped from the same per-job `contacts`
// records the timeline already reads (no new collection or field). "Last
// interaction" is the newest contact record's own createdAt: the cheapest
// signal available without pulling in notes/interviews across every job.
export function groupContactsByPerson(contacts: Contact[], jobsById: JobsById): PersonGroup[] {
  const groups = new Map<
    string,
    PersonGroup & { jobIds: Set<string> }
  >();

  for (const contact of contacts) {
    const job = jobsById[contact.jobApplicationId];
    const key = personKey(contact, job?.companyName ?? "");
    const contactDate = toJsDate(contact.createdAt);

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        firstName: contact.firstName ?? "",
        lastName: contact.lastName ?? "",
        email: contact.email ?? "",
        position: contact.position ?? "",
        jobs: [],
        lastInteractionAt: null,
        jobIds: new Set(),
      };
      groups.set(key, group);
    }

    if (!group.email && contact.email) group.email = contact.email;
    if (!group.position && contact.position) group.position = contact.position;

    if (job && !group.jobIds.has(job.id)) {
      group.jobIds.add(job.id);
      group.jobs.push({ jobApplicationId: job.id, companyName: job.companyName, position: job.position });
    }

    if (contactDate && (!group.lastInteractionAt || contactDate > group.lastInteractionAt)) {
      group.lastInteractionAt = contactDate;
    }
  }

  return Array.from(groups.values())
    .map(({ jobIds: _jobIds, ...group }) => group)
    .sort((a, b) => (b.lastInteractionAt?.getTime() ?? 0) - (a.lastInteractionAt?.getTime() ?? 0));
}
