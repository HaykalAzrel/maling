import { initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { GoogleAuthProvider } from "firebase/auth";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const googleProvider = new GoogleAuthProvider();

const isFirebaseConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

let firebaseApp: FirebaseApp | null = null;
let database: ReturnType<typeof getDatabase> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

if (isFirebaseConfigured) {
  firebaseApp = initializeApp(firebaseConfig);
  database = getDatabase(firebaseApp);
  auth = getAuth(firebaseApp);
  void setPersistence(auth, browserLocalPersistence);
}

export { firebaseApp, database, auth, isFirebaseConfigured };