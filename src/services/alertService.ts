import {
    ref,
    onValue,
    set,
    update,
    remove,
    push,
    get,
} from "firebase/database";

import { database } from "../firebase/config";

import { Alert } from "../types/alert";

import { SensorData } from "../types/sensor";

const alertCooldownMap = new Map<string, number>();

const ALERT_COOLDOWN_MS = 10_000;

const normalizePossibleTimezoneShift = (timestampMs: number): number => {
    const now = Date.now();
    const toleranceMs = 5 * 60 * 1000;

    if (timestampMs <= now + toleranceMs) {
        return timestampMs;
    }

    const offsetMs = new Date(timestampMs).getTimezoneOffset() * 60 * 1000;
    const corrected = timestampMs + offsetMs;

    return corrected <= now + toleranceMs ? corrected : timestampMs;
};

const toTimestampMillis = (value: unknown): number | undefined => {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return undefined;
    }

    const timestampMs =
        value < 1_000_000_000_000
            ? value * 1000
            : value;

    return normalizePossibleTimezoneShift(timestampMs);
};

export const clearAlertsForDevices = async (deviceIds: string[]): Promise<void> => {
    if (!database || deviceIds.length === 0) return;

    const updates: Record<string, null> = {};

    for (const deviceId of deviceIds) {
        updates[`devices/${deviceId}/alerts`] = null;
    }

    await update(ref(database), updates);
};

const isAlertLikeRecord = (
    value: Record<string, unknown>
) =>
    "timestamp" in value ||
    "created_at" in value ||
    "status" in value ||
    "nomor" in value ||
    "deviceId" in value;

const normalizeAlertEntry = (
    value: unknown,
    fallbackKey: string,
    parentDeviceId?: string
): Alert | null => {

    if (!value || typeof value !== "object") {
        return null;
    }

    const record =
        value as Record<string, unknown>;

    if (!isAlertLikeRecord(record)) {
        return null;
    }

    const createdAt =
        toTimestampMillis(record.created_at);

    const timestamp =
        toTimestampMillis(record.timestamp) ??
        createdAt ??
        Date.now();

    const deviceId =
        typeof parentDeviceId === "string" && parentDeviceId
            ? parentDeviceId
            : typeof record.deviceId === "string" && record.deviceId
            ? record.deviceId
            : fallbackKey;

    const deviceName =
        typeof record.deviceName === "string" &&
        record.deviceName
            ? record.deviceName
            : `Sensor ${deviceId}`;

    const rawStatus =
        typeof record.status === "string"
            ? record.status.toUpperCase()
            : "";

    const resolvedStatus =
        rawStatus === "READ"
            ? "read"
            : rawStatus === "RESOLVED"
            ? "resolved"
            : "new";

    return {
        deviceId,
        deviceName,
        distance:
            typeof record.distance === "number"
                ? record.distance
                : 0,
        location:
            typeof record.location === "string"
                ? record.location
                : "Unknown",
        pirTriggered: Boolean(
            record.pirTriggered
        ),
        ultraSonicTriggered: Boolean(
            record.ultraSonicTriggered
        ),
        status: resolvedStatus,
        timestamp,
        type: "intruder_detected",
    };
};

const normalizeAlertTree = (
    value: unknown,
    parentDeviceId?: string
): Record<string, Alert> => {

    if (!value || typeof value !== "object") {
        return {};
    }

    return Object.entries(
        value as Record<string, unknown>
    ).reduce<Record<string, Alert>>(
        (accumulator, [alertId, entry]) => {

            const normalized =
                normalizeAlertEntry(
                    entry,
                    alertId,
                    parentDeviceId
                );

            if (normalized) {
                accumulator[alertId] =
                    normalized;
            }

            return accumulator;

        },
        {}
    );
};

const buildBlockedAlert = (
    deviceId: string,
    sensor: SensorData
): Alert => {

    const timestamp =
        sensor.updated_at ??
        sensor.timestamp ??
        Date.now();

    return {
        deviceId,
        deviceName: `Sensor ${deviceId}`,
        distance:
            typeof sensor.distance === "number"
                ? sensor.distance
                : 0,
        location: "Unknown",
        pirTriggered: Boolean(
            sensor.pir ?? sensor.motion
        ),
        ultraSonicTriggered:
            typeof sensor.distance === "number",
        status: "new",
        timestamp,
        type: "intruder_detected",
    };
};

export const persistBlockedSensorAlert =
    async (
        deviceId: string,
        sensor: SensorData,
        laserOn: boolean,
        suppressAlertsUntil?: number
    ) => {

        if (!database) return;
        if (sensor.laser !== "BLOCKED") return;

        // ← Baca laser_on langsung dari Firebase, jangan percaya parameter
        const deviceSnap = await get(ref(database, `devices/${deviceId}`));
        const deviceData = deviceSnap.val() as Record<string, unknown> | null;
        const freshLaserOn =
            (deviceData?.laser_on as boolean | undefined) ??
            ((deviceData?.config as Record<string, unknown> | undefined)?.laser_on as boolean | undefined) ??
            laserOn; // fallback ke parameter kalau Firebase tidak ada

        if (!freshLaserOn) return;

        // ← Baca suppressAlertsUntil langsung dari Firebase juga
        const suppressSnap = await get(ref(database, `devices/${deviceId}/config/suppressAlertsUntil`));
        const freshSuppress = (suppressSnap.val() as number | null) ?? suppressAlertsUntil ?? 0;
        if (Date.now() < freshSuppress) return;

        const now = Date.now();
        const lastAlert = alertCooldownMap.get(deviceId) || 0;
        if (now - lastAlert < ALERT_COOLDOWN_MS) return;

        alertCooldownMap.set(deviceId, now);

        const alert = buildBlockedAlert(deviceId, sensor);
        const alertsRef = ref(database, `devices/${deviceId}/alerts`);
        const newAlertRef = push(alertsRef);
        await set(newAlertRef, alert);
    };

export const updateAlertStatus =
    async (
        deviceId: string,
        alertId: string,
        status:
            | "new"
            | "read"
            | "resolved"
    ) => {

        if (!database) {
            return;
        }

        await update(
            ref(
                database,
                `devices/${deviceId}/alerts/${alertId}`
            ),
            {
                status,
            }
        );
    };

export const deleteAlert = async (
    deviceId: string,
    alertId: string
) => {

    if (!database) {
        return;
    }

    await remove(
        ref(
            database,
            `devices/${deviceId}/alerts/${alertId}`
        )
    );
};

export const subscribeAlert = (
    deviceId: string,
    callback: (
        alert: Record<string, Alert>
    ) => void,
    onError?: (error: unknown) => void
) => {

    if (!database) {
        callback({});
        return () => undefined;
    }

    const alertRef = ref(
        database,
        `devices/${deviceId}/alerts`
    );

    return onValue(
        alertRef,
        (snapshot) => {
            callback(
                normalizeAlertTree(
                    snapshot.val(),
                    deviceId
                )
            );
        },
        (error) => {
            onError?.(error);
            callback({});
        }
    );
};

export const subscribeAlertsForDevices = (
    deviceIds: string[],
    callback: (
        alert: Record<string, Alert>
    ) => void,
    onError?: (error: unknown) => void
) => {

    if (
        !database ||
        deviceIds.length === 0
    ) {
        callback({});
        return () => undefined;
    }

    const currentAlerts:
        Record<string, Alert> = {};

    const emit = () => {
        callback({ ...currentAlerts });
    };

    const unsubscribers = deviceIds.map(
    (deviceId) =>
        subscribeAlert(
            deviceId,
            (alertsForDevice) => {
                // ← Hapus dulu semua alert lama untuk device ini
                Object.keys(currentAlerts).forEach((alertId) => {
                    if (currentAlerts[alertId].deviceId === deviceId) {
                        delete currentAlerts[alertId];
                    }
                });

                // ← Baru tambahkan alert terbaru dari Firebase
                Object.entries(alertsForDevice).forEach(
                    ([alertId, alert]) => {
                        currentAlerts[alertId] = alert;
                    }
                );

                emit();
            },
            onError
        )
    );

    return () => {

        unsubscribers.forEach(
            (unsubscribe) => {

                if (
                    typeof unsubscribe ===
                    "function"
                ) {
                    unsubscribe();
                }

            }
        );

    };
};
