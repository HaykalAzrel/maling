import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase/config";
import { recordUserActivity } from "./activityHistoryService";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const requireAuth = () => {
  if (!auth) {
    throw new Error("Firebase Auth is not configured. Check your VITE_FIREBASE_* env values.");
  }

  return auth;
};

export const signInWithEmail = async (email: string, password: string) => {
  const firebaseAuth = requireAuth();
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);

  recordUserActivity({
    title: "Signed in",
    device: credential.user.displayName || credential.user.email || "You",
    severity: "success",
  });

  return credential;
};

export const signUpWithEmail = async (email: string, password: string, fullName?: string) => {
  const firebaseAuth = requireAuth();
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);

  if (fullName) {
    await updateProfile(credential.user, { displayName: fullName });
  }

  recordUserActivity({
    title: "Created account",
    device: fullName || credential.user.email || "You",
    severity: "success",
  });

  return credential;
};

export const signInWithGoogle = async () => {
  const firebaseAuth = requireAuth();
  const credential = await signInWithPopup(firebaseAuth, googleProvider);

  recordUserActivity({
    title: "Signed in with Google",
    device: credential.user.displayName || credential.user.email || "You",
    severity: "success",
  });

  return credential;
};

export const signOutCurrentUser = async () => {
  const firebaseAuth = requireAuth();
  const currentUser = firebaseAuth.currentUser;

  recordUserActivity({
    title: "Signed out",
    device: currentUser?.displayName || currentUser?.email || "You",
    severity: "info",
  });

  return signOut(firebaseAuth);
};