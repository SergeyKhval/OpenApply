import { Timestamp } from "firebase/firestore";
import { CalendarDate, ZonedDateTime } from "@internationalized/date";

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

export type CreateJobApplicationInput = Omit<
  JobApplication,
  "id" | "createdAt" | "userId" | "status"
>;

export type Resume = {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  url: string;
  status: "uploaded" | "parsed" | "parse-failed";
  storagePath: string;
  createdAt: Timestamp;
};

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
