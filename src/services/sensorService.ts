import { ref, onValue } from "firebase/database";
import { database } from "../firebase/config";
import { SensorData } from "../types/sensor";
import { persistBlockedSensorAlert } from "./alertService";

export const subscribeSensorData = (
    deviceId: string,
    callback: (data: SensorData | null) => void,
    onError?: (error: unknown) => void
) => {
    const firebaseDatabase = database;

    if (!firebaseDatabase) {
        callback(null);
        return () => undefined;
    }

    const currentValues: Record<string, SensorData | null> = {
        nested: null,
        device: null,
    };

    const emitCurrentValue = () => {
        callback(currentValues.nested ?? currentValues.device ?? null);
    };

    const subscribe = (path: string, key: keyof typeof currentValues, transform?: (value: any) => SensorData | null) =>
        onValue(
            ref(firebaseDatabase, path),
            (snapshot) => {
                const rawValue = snapshot.val();
                const nextValue = transform ? transform(rawValue) : rawValue || null;
                currentValues[key] = nextValue;

                if (nextValue?.laser === "BLOCKED") {
                    void persistBlockedSensorAlert(deviceId, nextValue);
                }

                emitCurrentValue();
            },
            (error) => {
                onError?.(error);
                emitCurrentValue();
            }
        );

    const unsubscribers = [
        subscribe(`devices/${deviceId}/sensor`, "nested"),
        subscribe(`devices/${deviceId}`, "device", (value) => value?.sensor ?? null),
    ];

    return () => {
        unsubscribers.forEach((unsubscribe) => {
            if (typeof unsubscribe === "function") {
                unsubscribe();
            }
        });
    };
};