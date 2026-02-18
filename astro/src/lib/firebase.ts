import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { Functions } from "firebase/functions";

const isDev = import.meta.env.DEV;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let functions: Functions | null = null;

export async function getApp(): Promise<FirebaseApp> {
  if (app) return app;

  const { initializeApp } = await import("firebase/app");

  app = initializeApp({
    apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
    authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  });

  return app;
}

export async function getFirebaseAuth(): Promise<Auth> {
  if (auth) {
    if (!auth.currentUser) {
      const { signInAnonymously } = await import("firebase/auth");
      await signInAnonymously(auth);
    }
    return auth;
  }

  const firebaseApp = await getApp();
  const { getAuth, connectAuthEmulator, signInAnonymously } = await import(
    "firebase/auth"
  );

  auth = getAuth(firebaseApp);

  if (isDev) {
    connectAuthEmulator(auth, "http://localhost:9099", {
      disableWarnings: true,
    });
    console.log("🔧 Connected to Auth emulator");
  }

  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  return auth;
}

export async function getFirebaseFirestore(): Promise<Firestore> {
  if (firestore) return firestore;

  const firebaseApp = await getApp();
  const { getFirestore, connectFirestoreEmulator } = await import(
    "firebase/firestore"
  );

  firestore = getFirestore(firebaseApp);

  if (isDev) {
    connectFirestoreEmulator(firestore, "localhost", 8080);
    console.log("🔧 Connected to Firestore emulator");
  }

  return firestore;
}

export async function getFirebaseFunctions(): Promise<Functions> {
  if (functions) return functions;

  const firebaseApp = await getApp();
  const { getFunctions, connectFunctionsEmulator } = await import(
    "firebase/functions"
  );

  functions = getFunctions(firebaseApp);

  if (isDev) {
    connectFunctionsEmulator(functions, "localhost", 5001);
    console.log("🔧 Connected to Functions emulator");
  }

  return functions;
}
