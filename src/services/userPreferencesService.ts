import { onValue, ref, update } from "firebase/database";
import { database } from "../firebase/config";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFirebaseAuth } from "../hooks/useFirebaseAuth";
import { saveCustomRingtone, saveAlarmPrefsNative } from "../services/fileWriter";

export type RingtonePreference = {
  type: "default" | "preset" | "custom";
  name: string;
  customDataUrl?: string;
};

export type AlertPreferences = {
  pushNotifications: boolean;
  soundEnabled: boolean;
  ringtone: RingtonePreference;
  vibrationMode: "short" | "long" | "continuous";
};

export const defaultAlertPreferences: AlertPreferences = {
  pushNotifications: true,
  soundEnabled: true,
  ringtone: {
    type: "default",
    name: "Default",
  },
  vibrationMode: "short",
};

const normalizePreferences = (value: unknown): AlertPreferences => {
  if (!value || typeof value !== "object") {
    return defaultAlertPreferences;
  }

  const record = value as Partial<AlertPreferences>;
  const ringtone = record.ringtone ?? defaultAlertPreferences.ringtone;

  return {
    pushNotifications: record.pushNotifications ?? defaultAlertPreferences.pushNotifications,
    soundEnabled: record.soundEnabled ?? defaultAlertPreferences.soundEnabled,
    ringtone: {
      type: ringtone.type ?? defaultAlertPreferences.ringtone.type,
      name: ringtone.name ?? defaultAlertPreferences.ringtone.name,
      customDataUrl: ringtone.customDataUrl,
    },
    vibrationMode: record.vibrationMode ?? defaultAlertPreferences.vibrationMode,
  };
};

export const subscribeUserAlertPreferences = (
  userId: string,
  onChange: (preferences: AlertPreferences) => void,
  onError?: (error: unknown) => void
) => {
  if (!database) {
    onChange(defaultAlertPreferences);
    return () => undefined;
  }

  const preferencesRef = ref(database, `users/${userId}/alertPreferences`);
  return onValue(
    preferencesRef,
    (snapshot) => {
      onChange(normalizePreferences(snapshot.val()));
    },
    (error) => {
      onChange(defaultAlertPreferences);
      if (onError) {
        onError(error);
      }
    }
  );
};

export const updateUserAlertPreferences = async (
  userId: string,
  next: Partial<AlertPreferences>
) => {
  if (!database) return;

  const preferencesRef = ref(database, `users/${userId}/alertPreferences`);

  // ✅ Flatten nested ringtone object agar Firebase update benar
  const payload: Record<string, unknown> = {};

  if (next.ringtone !== undefined) {
    payload["ringtone/type"] = next.ringtone.type;
    payload["ringtone/name"] = next.ringtone.name;
    payload["ringtone/customDataUrl"] = next.ringtone.customDataUrl ?? null;
  }

  if (next.pushNotifications !== undefined) payload["pushNotifications"] = next.pushNotifications;
  if (next.soundEnabled !== undefined) payload["soundEnabled"] = next.soundEnabled;
  if (next.vibrationMode !== undefined) payload["vibrationMode"] = next.vibrationMode;

  await update(preferencesRef, payload);
};

export function useUserAlertPreferences() {
  const { user } = useFirebaseAuth();
  const [preferences, setPreferences] = useState<AlertPreferences>(defaultAlertPreferences);
  const [loading, setLoading] = useState(Boolean(user));
  const preferencesRef = useRef(preferences);
  const suppressUntilRef = useRef<number>(0); // ✅ tambah

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

        // Sync ke localStorage
        try {
          localStorage.setItem("secureSense:alarmPrefs", JSON.stringify({
            soundEnabled: next.soundEnabled,
            vibrationMode: next.vibrationMode,
            ringtoneType: next.ringtone?.type ?? "preset",
            ringtoneUrl: next.ringtone?.customDataUrl ?? null,
            ringtoneName: next.ringtone?.name ?? "default",
        }));
        } catch { /* ignore */ }

        const ringtonePath = localStorage.getItem("secureSense:customRingtonePath");
        void saveAlarmPrefsNative({
          soundEnabled: next.soundEnabled,
          vibrationMode: next.vibrationMode,
          ringtoneType: next.ringtone?.type ?? "preset",
          ringtoneName: next.ringtone?.name ?? "default",
          ringtoneFilePath: ringtonePath,
        });

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
      setPreferences({ ...previous, ...next });

      // ✅ Suppress Firebase emit selama 2 detik
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

  return { preferences, updatePreferences, loading };
}
