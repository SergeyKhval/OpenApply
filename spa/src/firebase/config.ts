import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator, type FirebaseStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app: FirebaseApp = initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app);

// Connect to emulators in development
if (import.meta.env.DEV && !import.meta.env.VITE_USE_PRODUCTION_FIREBASE) {
  // Check if emulators have already been initialized to avoid errors
  const isEmulatorInitialized = (
    (auth as any).emulatorConfig ||
    (db as any)._settings?.host?.includes('localhost') ||
    (storage as any)._host?.includes('localhost') ||
    (functions as any).emulatorOrigin
  );

  if (!isEmulatorInitialized) {
    try {
      // Connect to Auth emulator
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      console.log('🔧 Connected to Auth emulator');

      // Connect to Firestore emulator
      connectFirestoreEmulator(db, 'localhost', 8080);
      console.log('🔧 Connected to Firestore emulator');

      // Connect to Storage emulator
      connectStorageEmulator(storage, 'localhost', 9199);
      console.log('🔧 Connected to Storage emulator');

      // Connect to Functions emulator
      connectFunctionsEmulator(functions, 'localhost', 5001);
      console.log('🔧 Connected to Functions emulator');
    } catch (error) {
      console.warn('Failed to connect to Firebase emulators:', error);
    }
  }
}

export default app;
