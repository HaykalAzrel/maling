import { ref, set, get, update } from "firebase/database";
import { database } from "../firebase/config";

const ACTIVITY_HISTORY_KEY = "secureSense:activity-history";
const ACTIVITY_HISTORY_EVENT = "secureSense-activity-history-changed";

export type ActivitySeverity = "critical" | "warning" | "success" | "info";

export type StoredActivityEntry = {
    id: string;
    type: "user";
    title: string;
    device: string;
    severity: ActivitySeverity;
    timestamp: number;
    detail?: string;
};

// Simpan clearedAt ke setiap device yang dihapus
export const saveClearedAt = async (deviceIds: string[]): Promise<void> => {
  if (!database || deviceIds.length === 0) return;
  const db = database!; // ← tambah ini
  const now = Date.now();
  const updates: Record<string, number> = {};
  deviceIds.forEach((deviceId) => {
    updates[`devices/${deviceId}/clearedAt`] = now;
  });
  await update(ref(db), updates);
};

export const getClearedAt = async (deviceIds: string[]): Promise<number> => {
  if (!database || deviceIds.length === 0) return 0;
  const db = database!; // ← tambah ini
  const snapshots = await Promise.all(
    deviceIds.map((deviceId) => get(ref(db, `devices/${deviceId}/clearedAt`)))
  );
  const timestamps = snapshots.map((snap) => (snap.val() as number | null) ?? 0);
  return Math.max(0, ...timestamps);
};

const getWindowObject = () => (typeof window === "undefined" ? null : window);

const readStoredActivities = (): StoredActivityEntry[] => {
    const windowObject = getWindowObject();

    if (!windowObject) {
        return [];
    }

    try {
        const rawValue = windowObject.localStorage.getItem(ACTIVITY_HISTORY_KEY);
        const parsedValue = rawValue ? (JSON.parse(rawValue) as unknown) : [];

        if (!Array.isArray(parsedValue)) {
            return [];
        }

        return parsedValue.filter((entry): entry is StoredActivityEntry => {
            return Boolean(
                entry &&
                    typeof entry === "object" &&
                    typeof entry.id === "string" &&
                    entry.type === "user" &&
                    typeof entry.title === "string" &&
                    typeof entry.device === "string" &&
                    typeof entry.severity === "string" &&
                    typeof entry.timestamp === "number"
            );
        });
    } catch {
        return [];
    }
};

const writeStoredActivities = (activities: StoredActivityEntry[]) => {
    const windowObject = getWindowObject();

    if (!windowObject) {
        return;
    }

    windowObject.localStorage.setItem(ACTIVITY_HISTORY_KEY, JSON.stringify(activities.slice(-200)));
    windowObject.dispatchEvent(new Event(ACTIVITY_HISTORY_EVENT));
};

export const getStoredUserActivities = () => readStoredActivities();

export const recordUserActivity = (
    activity: Omit<StoredActivityEntry, "id" | "timestamp" | "type"> & { timestamp?: number }
) => {
    const currentActivities = readStoredActivities();
    const timestamp = activity.timestamp ?? Date.now();
    const id = `${timestamp}-${activity.title}-${activity.device}`;

    const nextActivity: StoredActivityEntry = {
        id,
        type: "user",
        title: activity.title,
        device: activity.device,
        severity: activity.severity,
        timestamp,
        detail: activity.detail,
    };

    writeStoredActivities([nextActivity, ...currentActivities]);
};

export const clearStoredUserActivities = () => {
  writeStoredActivities([]);
};

export const subscribeUserActivities = (callback: (activities: StoredActivityEntry[]) => void) => {
    const windowObject = getWindowObject();

    if (!windowObject) {
        callback([]);
        return () => undefined;
    }

    const emit = () => callback(readStoredActivities());
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === ACTIVITY_HISTORY_KEY) {
            emit();
        }
    };

    windowObject.addEventListener(ACTIVITY_HISTORY_EVENT, emit);
    windowObject.addEventListener("storage", handleStorageChange);

    emit();

    return () => {
        windowObject.removeEventListener(ACTIVITY_HISTORY_EVENT, emit);
        windowObject.removeEventListener("storage", handleStorageChange);
    };
};