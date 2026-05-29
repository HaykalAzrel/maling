import { useEffect, useRef } from "react";
import { Device } from "../types/device";
import { setDevicePowered } from "../services/deviceService";
import { recordUserActivity } from "../services/activityHistoryService";
import { isDeviceAlive } from "./useDeviceAlive";

const parseTimeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
};

export function useScheduleAutomation(devices: Device[]) {
    const lastApplied = useRef<Record<string, boolean | undefined>>({});

    useEffect(() => {
        const check = () => {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const currentDay = now.getDay();
            const previousDay = (currentDay + 6) % 7;

            devices.forEach((device) => {
                // Baca schedule dari config (sesuai struktur Firebase)
                const schedule = device.schedule ?? device.config?.schedule;

                // Skip kalau schedule tidak aktif
                if (!schedule?.enabled) {
                    delete lastApplied.current[device.id];
                    return;
                }

                // Skip kalau device mati (hardware tidak merespons)
                if (!isDeviceAlive(device)) return;

                const startMinutes = parseTimeToMinutes(schedule.start ?? "00:00");
                const stopMinutes  = parseTimeToMinutes(schedule.stop  ?? "00:00");
                const days         = schedule.days ?? [true,true,true,true,true,false,false];
                const sameDayWindow = startMinutes <= stopMinutes;

                const isActive = sameDayWindow
                    ? days[currentDay] &&
                      currentMinutes >= startMinutes &&
                      currentMinutes < stopMinutes
                    : (days[currentDay] && currentMinutes >= startMinutes) ||
                      (days[previousDay] && currentMinutes < stopMinutes);

                // Skip kalau state tidak berubah dari terakhir kali apply
                if (lastApplied.current[device.id] === isActive) return;

                // Skip kalau Firebase sudah di state yang benar
                const currentlyOn =
                    device.monitoring !== false &&
                    device.laserOn    !== false;

                if (currentlyOn === isActive) {
                    lastApplied.current[device.id] = isActive;
                    return;
                }

                // Apply ke Firebase
                lastApplied.current[device.id] = isActive;

                setDevicePowered(device.id, isActive)
                    .then(() => {
                        recordUserActivity({
                            title: isActive
                                ? "Schedule turned on device"
                                : "Schedule turned off device",
                            device: device.name,
                            severity: isActive ? "success" : "warning",
                        });
                    })
                    .catch(console.error);
            });
        };

        check(); // jalankan langsung saat mount
        const interval = setInterval(check, 60_000); // cek tiap menit
        return () => clearInterval(interval);
    }, [devices]);
}