import {
    ref,
    onValue,
    set,
    update,
    remove,
    push,
} from "firebase/database";

import { database } from "../firebase/config";

import { Alert } from "../types/alert";

import { SensorData } from "../types/sensor";

import { subscribeDevice } from "./deviceService";

const alertCooldownMap = new Map<string, number>();

const ALERT_COOLDOWN_MS = 10_000;

const toTimestampMillis = (
    value: unknown
): number | undefined => {

    if (
        typeof value !== "number" ||
        Number.isNaN(value)
    ) {
        return undefined;
    }

    return value < 1_000_000_000_000
        ? value * 1000
        : value;
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
    fallbackKey: string
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
        typeof record.deviceId === "string" &&
        record.deviceId
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
    value: unknown
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
                    alertId
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
        sensor: SensorData
    ) => {

        if (!database) {
            return;
        }

        if (sensor.laser !== "BLOCKED") {
            return;
        }

        const now = Date.now();

        const lastAlert =
            alertCooldownMap.get(deviceId) || 0;

        if (
            now - lastAlert <
            ALERT_COOLDOWN_MS
        ) {
            return;
        }

        alertCooldownMap.set(
            deviceId,
            now
        );

        const alert = buildBlockedAlert(
            deviceId,
            sensor
        );

        const alertsRef = ref(
            database,
            `devices/${deviceId}/alerts`
        );

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
                    snapshot.val()
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

                    Object.entries(
                        alertsForDevice
                    ).forEach(
                        ([alertId, alert]) => {

                            currentAlerts[
                                alertId
                            ] = alert;

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