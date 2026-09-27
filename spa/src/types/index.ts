import { Timestamp } from "firebase/firestore";
import { CalendarDate, ZonedDateTime } from "@internationalized/date";
import type { JobPosting } from "../../../shared/jobPosting";
import type { StructuredResume } from "@/lib/builtResume";
import type { SourceLine as TailoredSourceLine, VerifiedOp as TailoredOp } from "@/lib/tailoredResume";

export type JobStatus =
  | "draft"
  | "applied"
  | "interviewing"
  | "offered"
  | "hired"
  | "rejected"
  | "withdrew"
  | "archived";

export type JobApplication = {
  id: string;
  companyName: string;
  companyLogoUrl?: string;
  position: string;
  jobDescription: string;
  jobDescriptionLink?: string;
  technologies: string[];
  employmentType?: "full-time" | "part-time";
  remotePolicy?: "remote" | "in-office" | "hybrid";
  salary?: string;
  jobId?: string;
  resumeId?: string | null;
  coverLetterId?: string;
  status: JobStatus;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  appliedAt?: CalendarDate;
  interviewedAt?: CalendarDate;
  offeredAt?: CalendarDate;
  hiredAt?: CalendarDate;
  archivedAt?: Timestamp;
  // When to follow up on this job (set by "I applied"); null once done
  followUpAt?: Timestamp | null;
  userId: string;
  toolMatch?: ToolMatch;
  // When the posting says it was posted, read by the browser extension
  posting?: JobPosting;
  // Id of the public jobSignals doc for this posting, set by the jobSignals function
  jobKeyHash?: string;
};

// Result of the free resume match tool on the landing page, saved with the
// application the tool creates after signup
export type ToolMatch = {
  matchScore: number;
  verdict: string;
  parseCheck: { status: "clean" | "issues" | "scrambled"; note: string };
  requirements: {
    requirement: string;
    status: "matched" | "partial" | "missing";
    importance: "must-have" | "nice-to-have";
    evidence: string;
  }[];
  missingKeywords: string[];
  fixes: { gap: string; where: string; action: string }[];
  checkedAt: string;
};

export type JobApplicationNote = {
  id: string;
  text: string;
  jobApplicationId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  linkedInUrl: string;
  createdAt: Timestamp;
  userId: string;
  jobApplicationId: string;
};

export type ContactFormContact = {
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  linkedInUrl: string;
};

export type Interview = {
  id: string;
  name: string;
  conductedAt: Timestamp;
  status: "pending" | "passed" | "failed";
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type InterviewFormInterview = {
  name: string;
  conductedAt: ZonedDateTime;
};

// Static, non-AI message templates offered from a job's page: a follow-up
// after applying, a post-interview thank-you, or a reply to an offer.
export type FollowUpTemplateType = "follow_up" | "thank_you" | "offer_response";

export type CreateJobApplicationInput = Omit<
  JobApplication,
  "id" | "createdAt" | "userId" | "status"
>;

type ResumeBase = {
  id: string;
  userId: string;
  status: "uploaded" | "parsed" | "parse-failed";
  text?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
};

// A PDF the user uploaded; parseResume creates the doc. Docs from before
// resumes could be built have no `kind`.
export type UploadedResume = ResumeBase & {
  kind?: "upload";
  fileName: string;
  fileSize: number;
  url?: string;
  storagePath: string;
};

// A resume made in the app's editor: `text` is derived from `structured`
// (lib/builtResume.ts) on every save
export type BuiltResume = ResumeBase & {
  kind: "built";
  title: string;
  template: "classic" | "compact";
  structured: StructuredResume;
  importedFrom?: {
    source: "resume" | "linkedin_pdf" | "linkedin_paste";
    resumeId?: string;
    flaggedFields: string[];
    // Source lines the import couldn't place under a job, or didn't use
    unsorted?: string[];
    notImported?: string[];
    fallback?: boolean;
  };
  completedAt?: Timestamp;
};

export type Resume = UploadedResume | BuiltResume;

export type CoverLetter = {
  id: string;
  userId: string;
  jobApplication: {
    id: string;
    companyName: string;
    companyLogoUrl?: string;
    position: string;
  };
  resumeId: string;
  body: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  style?: { length: "short" | "standard"; tone: "plain" | "warm" };
  modelMetadata?: {
    model: string;
    prompt: string;
    temperature?: number;
  };
};

type ScoredSkill = {
  evidence?: string;
  skill: string;
  status: "matched";
};

export type ResumeJobMatch = {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  jobApplicationId: string;
  resumeId: string;
  userId: string;
  // Raw engine output, stored since the shared match engine (older matches
  // don't have it). The tailored resume reads requirements and gaps from it.
  analysis?: {
    matchScore: number;
    requirements: { requirement: string; status: "matched" | "partial" | "missing"; importance: string; evidence: string }[];
    missingKeywords: string[];
    // How the resume's text reads to a parser; the tailor refuses "scrambled"
    parseCheck?: { status: "clean" | "issues" | "scrambled"; note: string };
  };
  matchResult: {
    match_summary: {
      overall_match_percent: number;
      summary: string;
    };
    recommendations: {
      improvement_areas?: string[];
      potential_match_boost?: string;
    };
    skills_comparison: {
      matched_skills?: ScoredSkill[];
      missing_skills?: ScoredSkill[];
      partially_matched_skills?: ScoredSkill[];
    };
  };
};

// A tailored version of a resume for one job (createTailoredResume). Only the
// user's switched-off edits (excludedOpIds) are theirs to change.
export type TailoredResume = {
  id: string;
  userId: string;
  resumeId: string;
  jobApplicationId: string;
  matchId: string;
  resume: { id: string; fileName: string | null };
  jobApplication: { id: string; companyName: string | null; position: string | null };
  lines: TailoredSourceLine[];
  sectionOrder: string[];
  ops: TailoredOp[];
  excludedOpIds: number[];
  stats: { proposed: number; applied: number; reverted: number };
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
