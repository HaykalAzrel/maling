import { useCallback, useEffect, useRef, useState } from "react";
import { useFirebaseAuth } from "./useFirebaseAuth";
import {
  AlertPreferences,
  defaultAlertPreferences,
  subscribeUserAlertPreferences,
  updateUserAlertPreferences,
} from "../services/userPreferencesService";

export function useUserAlertPreferences() {
  const { user } = useFirebaseAuth();
  const [preferences, setPreferences] = useState<AlertPreferences>(defaultAlertPreferences);
  const [loading, setLoading] = useState(Boolean(user));
  const preferencesRef = useRef(preferences);
  const suppressUntilRef = useRef<number>(0); // ✅ tambah ini

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    if (!user?.uid) {
      setPreferences(defaultAlertPreferences);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeUserAlertPreferences(
      user.uid,
      (next) => {
        // ✅ Skip emit dari Firebase jika masih dalam window suppress
        if (Date.now() < suppressUntilRef.current) {
          setLoading(false);
          return;
        }
        setPreferences(next);
        setLoading(false);
      },
      () => {
        setPreferences(defaultAlertPreferences);
        setLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [user?.uid]);

  const updatePreferences = useCallback(
    async (next: Partial<AlertPreferences>) => {
      if (!user?.uid) return;

      const previous = preferencesRef.current;
      setPreferences({ ...previous, ...next });

      // ✅ Suppress Firebase emit selama 2 detik setelah update
      suppressUntilRef.current = Date.now() + 2000;

      try {
        await updateUserAlertPreferences(user.uid, next);
      } catch (error) {
        suppressUntilRef.current = 0;
        setPreferences(previous);
        throw error;
      }
    },
    [user?.uid]
  );

  return {
    preferences,
    updatePreferences,
    loading,
  };
}
