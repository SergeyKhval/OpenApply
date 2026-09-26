import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";

const RULES_PATH = resolve(import.meta.dirname, "../../firestore.rules");

function emulatorHostPort() {
  const raw = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const [host, port] = raw.split(":");
  return { host, port: Number(port) };
}

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const { host, port } = emulatorHostPort();
  testEnv = await initializeTestEnvironment({
    projectId: "openapply-rules-test",
    firestore: { rules: readFileSync(RULES_PATH, "utf8"), host, port },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// Writes with the Admin SDK context, which bypasses rules entirely, the way
// Cloud Functions (the only writer of these collections) actually do it.
async function seed(fn: (db: Firestore) => Promise<void>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}

describe("jobs collection", () => {
  const JOB_ID = "job123";
  const job = { jobDescriptionLink: "https://example.com/posting", status: "parsed" };

  beforeEach(async () => {
    await seed(async (db) => setDoc(doc(db, "jobs", JOB_ID), job));
  });

  it("lets a signed-in user get a cached job by id", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(alice, "jobs", JOB_ID)));
  });

  it("denies a signed-out client getting a job by id", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "jobs", JOB_ID)));
  });

  it("denies a signed-in user listing the whole jobs collection", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDocs(collection(alice, "jobs")));
  });

  it("denies a signed-in user creating a job doc directly (cache poisoning)", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    // Setting userId to their own uid would satisfy the old canCreateOwn() check.
    await assertFails(setDoc(doc(alice, "jobs", "poisoned"), { ...job, userId: "alice" }));
  });

  it("denies a signed-in user updating a cached job doc", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertFails(updateDoc(doc(alice, "jobs", JOB_ID), { status: "tampered" }));
  });

  it("denies a signed-in user deleting a cached job doc", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertFails(deleteDoc(doc(alice, "jobs", JOB_ID)));
  });
});

describe("jobSignals collection (already get-only; locking it in)", () => {
  const KEY_HASH = "sha256hash";

  beforeEach(async () => {
    await seed(async (db) => setDoc(doc(db, "jobSignals", KEY_HASH), { closedSince: null }));
  });

  it("lets anyone get a signal by id, even signed out", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, "jobSignals", KEY_HASH)));
  });

  it("denies listing jobSignals", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDocs(collection(alice, "jobSignals")));
  });

  it("denies writing jobSignals from a client", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(alice, "jobSignals", "new"), { closedSince: null }));
  });
});

// These three have no explicit match block; they rely on the deny-all catch-all
// at the bottom of the file. Cloud Functions are their only reader/writer, via
// the Admin SDK, which bypasses rules entirely.
describe.each([
  ["jobSignalsPrivate", "sha256hash"],
  ["jobRateLimits", "2026-09-25T10"],
  ["signInCodes", "user-at-example.com"],
])("%s collection (no client access; deny-all catch-all)", (collectionName, docId) => {
  beforeEach(async () => {
    await seed(async (db) => setDoc(doc(db, collectionName, docId), { seeded: true }));
  });

  it("denies a signed-in user reading it", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(alice, collectionName, docId)));
  });

  it("denies a signed-out client reading it", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, collectionName, docId)));
  });

  it("denies a signed-in user writing it", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(alice, collectionName, docId), { tampered: true }));
  });
});

describe("jobApplications collection (existing owner-scoped rule; sanity check)", () => {
  const APP_ID = "app1";

  beforeEach(async () => {
    await seed(async (db) => setDoc(doc(db, "jobApplications", APP_ID), { userId: "alice", status: "applied" }));
  });

  it("lets the owner read their own application", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(alice, "jobApplications", APP_ID)));
  });

  it("denies a different signed-in user reading someone else's application", async () => {
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(bob, "jobApplications", APP_ID)));
  });
});

describe("tailoredResumes collection", () => {
  const ID = "tailored1";
  const tailored = {
    userId: "alice",
    resumeId: "resume1",
    jobApplicationId: "app1",
    ops: [{ kind: "rephrase", status: "applied", text: "Built the invoice API in Go." }],
    excludedOpIds: [],
    updatedAt: 1,
  };

  beforeEach(async () => {
    await seed(async (db) => setDoc(doc(db, "tailoredResumes", ID), tailored));
  });

  it("lets the owner read it, and nobody else", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(getDoc(doc(alice, "tailoredResumes", ID)));
    await assertFails(getDoc(doc(bob, "tailoredResumes", ID)));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "tailoredResumes", ID)));
  });

  it("lets only the function create one, never a client", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(alice, "tailoredResumes", "forged"), tailored));
  });

  it("lets the owner switch edits off and on", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(updateDoc(doc(alice, "tailoredResumes", ID), { excludedOpIds: [0, 2], updatedAt: 2 }));
  });

  it("never lets the owner rewrite the edits themselves", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertFails(updateDoc(doc(alice, "tailoredResumes", ID), { ops: [{ kind: "rephrase", status: "applied", text: "Led the platform team." }] }));
    await assertFails(updateDoc(doc(alice, "tailoredResumes", ID), { excludedOpIds: [0], userId: "bob" }));
    await assertFails(updateDoc(doc(alice, "tailoredResumes", ID), { excludedOpIds: "all" }));
  });

  it("denies another user's toggles and lets the owner delete", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertFails(updateDoc(doc(bob, "tailoredResumes", ID), { excludedOpIds: [1] }));
    await assertFails(deleteDoc(doc(bob, "tailoredResumes", ID)));
    await assertSucceeds(deleteDoc(doc(alice, "tailoredResumes", ID)));
  });
});
