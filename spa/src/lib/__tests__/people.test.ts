import { describe, expect, it } from "vitest";
import type { Contact, JobApplication } from "@/types";
import { groupContactsByPerson } from "../people";

const ts = (date: Date) => ({ toDate: () => date });

type ContactFields = {
  id: string;
  jobApplicationId: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  email?: string;
  createdAt?: ReturnType<typeof ts>;
};

const contact = (fields: ContactFields) =>
  ({
    firstName: "Dana",
    lastName: "Ruiz",
    position: "Engineering Manager",
    email: "dana@example.com",
    linkedInUrl: "",
    createdAt: ts(new Date(2026, 8, 20)),
    userId: "u1",
    ...fields,
  }) as unknown as Contact;

const jobsById = {
  j1: { id: "j1", companyName: "Northwind Labs", position: "Backend Engineer" } as JobApplication,
  j2: { id: "j2", companyName: "Acme Corp", position: "Staff Engineer" } as JobApplication,
  j3: { id: "j3", companyName: "Northwind Labs", position: "Platform Engineer" } as JobApplication,
};

describe("groupContactsByPerson", () => {
  it("groups contacts with the same email across different jobs into one person", () => {
    const groups = groupContactsByPerson(
      [
        contact({ id: "c1", jobApplicationId: "j1", email: "dana@example.com" }),
        contact({ id: "c2", jobApplicationId: "j2", email: "Dana@Example.com  " }),
      ],
      jobsById,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].jobs.map((j) => j.jobApplicationId).sort()).toEqual(["j1", "j2"]);
  });

  it("falls back to name + company when email is missing", () => {
    const groups = groupContactsByPerson(
      [
        contact({ id: "c1", jobApplicationId: "j1", email: "", firstName: "Sam", lastName: "Lee" }),
        contact({ id: "c2", jobApplicationId: "j3", email: "", firstName: "  sam", lastName: "lee " }),
      ],
      jobsById,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].jobs.map((j) => j.jobApplicationId).sort()).toEqual(["j1", "j3"]);
  });

  it("keeps two different people at the same company separate when neither has an email", () => {
    const groups = groupContactsByPerson(
      [
        contact({ id: "c1", jobApplicationId: "j1", email: "", firstName: "Sam", lastName: "Lee" }),
        contact({ id: "c2", jobApplicationId: "j1", email: "", firstName: "Alex", lastName: "Kim" }),
      ],
      jobsById,
    );

    expect(groups).toHaveLength(2);
  });

  it("keeps the same name at different companies separate when there is no email", () => {
    const groups = groupContactsByPerson(
      [
        contact({ id: "c1", jobApplicationId: "j1", email: "", firstName: "Sam", lastName: "Lee" }),
        contact({ id: "c2", jobApplicationId: "j2", email: "", firstName: "Sam", lastName: "Lee" }),
      ],
      jobsById,
    );

    expect(groups).toHaveLength(2);
  });

  it("reports the most recent contact record as the last interaction date", () => {
    const groups = groupContactsByPerson(
      [
        contact({ id: "c1", jobApplicationId: "j1", createdAt: ts(new Date(2026, 8, 1)) }),
        contact({ id: "c2", jobApplicationId: "j2", createdAt: ts(new Date(2026, 8, 15)) }),
      ],
      jobsById,
    );

    expect(groups[0].lastInteractionAt).toEqual(new Date(2026, 8, 15));
  });

  it("lists each linked job once with its company and job title", () => {
    const groups = groupContactsByPerson([contact({ id: "c1", jobApplicationId: "j1" })], jobsById);

    expect(groups[0].jobs).toEqual([
      { jobApplicationId: "j1", companyName: "Northwind Labs", position: "Backend Engineer" },
    ]);
  });

  it("does not duplicate a job link when the same person has two contact records for it", () => {
    const groups = groupContactsByPerson(
      [
        contact({ id: "c1", jobApplicationId: "j1", createdAt: ts(new Date(2026, 8, 1)) }),
        contact({ id: "c2", jobApplicationId: "j1", createdAt: ts(new Date(2026, 8, 2)) }),
      ],
      jobsById,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].jobs).toHaveLength(1);
  });

  it("still groups a contact whose job was deleted, using an empty company for the name fallback", () => {
    const groups = groupContactsByPerson(
      [contact({ id: "c1", jobApplicationId: "missing-job", email: "" })],
      jobsById,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].jobs).toEqual([]);
  });

  it("sorts people by most recent interaction first", () => {
    const groups = groupContactsByPerson(
      [
        contact({ id: "c1", jobApplicationId: "j1", email: "older@example.com", createdAt: ts(new Date(2026, 8, 1)) }),
        contact({ id: "c2", jobApplicationId: "j2", email: "newer@example.com", createdAt: ts(new Date(2026, 8, 20)) }),
      ],
      jobsById,
    );

    expect(groups.map((g) => g.email)).toEqual(["newer@example.com", "older@example.com"]);
  });

  it("returns no groups for an empty contact list", () => {
    expect(groupContactsByPerson([], jobsById)).toEqual([]);
  });
});
