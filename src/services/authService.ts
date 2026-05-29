import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { auth, database } from "../firebase/config";
import { recordUserActivity } from "./activityHistoryService";
import { ref, set, update } from "firebase/database";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const requireAuth = () => {
  if (!auth) {
    throw new Error("Firebase Auth is not configured. Check your VITE_FIREBASE_* env values.");
  }

  return auth;
};

export const resendVerificationEmail = async () => {
  const firebaseAuth = requireAuth();
  const user = firebaseAuth.currentUser;
  if (user && !user.emailVerified) {
    await sendEmailVerification(user);
  }
};

// Edit signInWithEmail — blokir kalau belum verifikasi
export const signInWithEmail = async (email: string, password: string) => {
  const firebaseAuth = requireAuth();
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);

  // ← tambah ini
  if (!credential.user.emailVerified) {
    await signOut(firebaseAuth); // paksa logout dulu
    const error = new Error("EMAIL_NOT_VERIFIED");
    (error as { code?: string }).code = "auth/email-not-verified";
    throw error;
  }

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

  // ← Tambahan: simpan data user ke Realtime Database
  if (database) {
    await set(ref(database, `users/${credential.user.uid}`), {
      uid: credential.user.uid,
      email: credential.user.email,
      displayName: fullName || null,
      createdAt: Date.now(),
    });
  }

  await sendEmailVerification(credential.user);

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

  // ← Tambahan: simpan/update data user ke Realtime Database
  // Pakai update bukan set, agar tidak overwrite data lama jika sudah ada
  if (database) {
    await update(ref(database, `users/${credential.user.uid}`), {
      uid: credential.user.uid,
      email: credential.user.email,
      displayName: credential.user.displayName || null,
      lastLoginAt: Date.now(),
    });
  }

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