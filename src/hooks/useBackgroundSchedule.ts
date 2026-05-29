import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Device } from "../types/device";


// Ambil dari firebase config
const FIREBASE_URL = "https://webdashboardptapt-default-rtdb.firebaseio.com";

export function useBackgroundSchedule(_devices: Device[]) {
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        // Hanya device yang punya schedule aktif
        const scheduledDevices = _devices
            .filter((d) => d.schedule?.enabled || d.config?.schedule?.enabled)
            .map((d) => ({
                id:         d.id,
                monitoring: d.monitoring,
                laser_on:   d.laserOn ?? d.laser_on,
                schedule:   d.schedule ?? d.config?.schedule,
                config:     d.config,
            }));

        if (scheduledDevices.length === 0) return;

    }, [_devices]);
}