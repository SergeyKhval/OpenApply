// "Found via" on the job page, read from the posting link's host: known job
// boards and ATSs by name, anything else as its bare domain. No link, no label.
const KNOWN_SOURCES: [host: string, label: string][] = [
  ["linkedin.com", "LinkedIn"],
  ["indeed.com", "Indeed"],
  ["glassdoor.com", "Glassdoor"],
  ["wellfound.com", "Wellfound"],
  ["angel.co", "Wellfound"],
  ["ycombinator.com", "Y Combinator"],
  ["weworkremotely.com", "We Work Remotely"],
  ["remoteok.com", "Remote OK"],
  ["otta.com", "Welcome to the Jungle"],
  ["welcometothejungle.com", "Welcome to the Jungle"],
  ["stepstone.de", "StepStone"],
  ["xing.com", "XING"],
  ["greenhouse.io", "Greenhouse"],
  ["lever.co", "Lever"],
  ["ashbyhq.com", "Ashby"],
  ["workable.com", "Workable"],
  ["smartrecruiters.com", "SmartRecruiters"],
  ["myworkdayjobs.com", "Workday"],
  ["personio.de", "Personio"],
  ["personio.com", "Personio"],
  ["recruitee.com", "Recruitee"],
  ["teamtailor.com", "Teamtailor"],
  ["bamboohr.com", "BambooHR"],
];

export function foundViaLabel(link: string | undefined | null): string {
  if (!link) return "";
  let host: string;
  try {
    host = new URL(link).hostname.toLowerCase();
  } catch {
    return "";
  }
  const known = KNOWN_SOURCES.find(([source]) => host === source || host.endsWith(`.${source}`));
  if (known) return known[1];
  return host.replace(/^(www|jobs|careers|boards|apply)\./, "");
}
