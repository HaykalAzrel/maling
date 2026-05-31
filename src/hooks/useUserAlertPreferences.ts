import { useCallback, useEffect, useRef, useState } from "react";
import { useFirebaseAuth } from "./useFirebaseAuth";
import {
  AlertPreferences,
  defaultAlertPreferences,
  subscribeUserAlertPreferences,
  updateUserAlertPreferences,
} from "../services/userPreferencesService";
import { saveCustomRingtone } from "../services/fileWriter";

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
            if (Date.now() < suppressUntilRef.current) {
                setLoading(false);
                return;
            }
            setPreferences(next);
            setLoading(false);

            // Sync ke localStorage setiap kali Firebase emit
            try {
                localStorage.setItem("secureSense:alarmPrefs", JSON.stringify({
                    soundEnabled: next.soundEnabled,
                    vibrationMode: next.vibrationMode,
                    ringtoneType: next.ringtone?.type ?? "preset",
                    ringtoneUrl: next.ringtone?.customDataUrl ?? null,
                    ringtoneName: next.ringtone?.name ?? "default",
                }));
            } catch { /* ignore */ }

            // Kalau ada custom ringtone, simpan ke file
            if (next.ringtone?.type === "custom" && next.ringtone?.customDataUrl) {
                void saveCustomRingtone(next.ringtone.customDataUrl);
            }
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
        const merged = { ...previous, ...next };
        setPreferences(merged);

        // Simpan custom ringtone ke file jika ada
        let customRingtonePath: string | null = null;
        if (merged.ringtone?.type === "custom" && merged.ringtone?.customDataUrl) {
            customRingtonePath = await saveCustomRingtone(merged.ringtone.customDataUrl);
        }

        // Simpan ke localStorage
        try {
            localStorage.setItem("secureSense:alarmPrefs", JSON.stringify({
                soundEnabled: merged.soundEnabled,
                vibrationMode: merged.vibrationMode,
                ringtoneType: merged.ringtone?.type ?? "preset",
                ringtoneUrl: customRingtonePath ?? null,
                ringtoneName: merged.ringtone?.name ?? "default",
            }));
        } catch { /* ignore */ }

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
