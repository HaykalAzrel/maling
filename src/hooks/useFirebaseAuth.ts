import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, database } from "../firebase/config";
import { ref, update } from "firebase/database";

export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [loading, setLoading] = useState(Boolean(auth));

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setLoading(false);

      // Simpan/update data user ke /users saat login
      if (nextUser && database) {
        await update(
          ref(
            database,
            `users/${nextUser.uid}`
          ),
          {
            uid: nextUser.uid,
            email: nextUser.email,
            displayName:
              nextUser.displayName ?? null,
          }
        );

      }
    });

    return unsubscribe;
  }, []);

  return { user, loading, isAuthenticated: Boolean(user) };
}
