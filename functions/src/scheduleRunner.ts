/**
 * scheduleRunner.ts — Firebase Scheduled Cloud Function
 *
 * Pengganti Capacitor BackgroundRunner.
 * Berjalan setiap menit, membaca config.schedule dari tiap device di RTDB,
 * lalu menyalakan/mematikan device sesuai jadwal yang sudah diset user.
 *
 * Deploy: firebase deploy --only functions:checkDeviceSchedules
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getDatabase } from "firebase-admin/database";
import { initializeApp, getApps } from "firebase-admin/app";
import { logger } from "firebase-functions/v2";

if (getApps().length === 0) {
    initializeApp();
}

// ── Types (sesuai struktur RTDB dari export) ───────────────────────────────

interface ScheduleConfig {
    enabled: boolean;
    start: string;   // "HH:MM"
    stop: string;    // "HH:MM"
    days: boolean[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat] — index JS
}

interface DeviceConfig {
    laser_on: boolean;
    monitoring: boolean;
    schedule?: ScheduleConfig;
    notifications?: { enabled: boolean };
    suppressAlertsUntil?: number;
    threshold?: number;
}

interface Device {
    id: string;
    name: string;
    owner?: string;
    ownerId?: string;
    monitoring: boolean;
    laser_on: boolean;
    config?: DeviceConfig;
    online?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseTimeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Evaluasi apakah jadwal aktif saat ini.
 * Mendukung window lintas tengah malam (misal 22:00–06:00).
 * Menggunakan timezone Asia/Jakarta (WIB, UTC+7).
 */
function isScheduleActive(schedule: ScheduleConfig): boolean {
    // Cloud Functions berjalan di UTC — konversi ke WIB (UTC+7)
    const nowUtc = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const nowWib = new Date(nowUtc.getTime() + wibOffset);

    const currentMinutes = nowWib.getUTCHours() * 60 + nowWib.getUTCMinutes();
    const currentDay = nowWib.getUTCDay();           // 0=Sun … 6=Sat (sama dengan JS)
    const previousDay = (currentDay + 6) % 7;

    const startMinutes = parseTimeToMinutes(schedule.start ?? "00:00");
    const stopMinutes = parseTimeToMinutes(schedule.stop ?? "00:00");
    const days = schedule.days ?? new Array(7).fill(true);

    const sameDayWindow = startMinutes <= stopMinutes;

    if (sameDayWindow) {
        return (
            days[currentDay] === true &&
            currentMinutes >= startMinutes &&
            currentMinutes < stopMinutes
        );
    }

    // Window melewati tengah malam
    return (
        (days[currentDay] === true && currentMinutes >= startMinutes) ||
        (days[previousDay] === true && currentMinutes < stopMinutes)
    );
}

// ── Cloud Function ─────────────────────────────────────────────────────────

export const checkDeviceSchedules = onSchedule(
    {
        schedule: "every 1 minutes",
        timeZone: "Asia/Jakarta",
        region: "asia-southeast1", // Singapore — paling dekat dengan Indonesia
        memory: "256MiB",
        timeoutSeconds: 30,
    },
    async () => {
        const db = getDatabase();
        const devicesSnap = await db.ref("devices").get();

        if (!devicesSnap.exists()) {
            logger.info("No devices found.");
            return;
        }

        const devices = devicesSnap.val() as Record<string, Device>;
        const updates: Record<string, boolean> = {};
        let checkedCount = 0;
        let changedCount = 0;

        for (const [deviceId, device] of Object.entries(devices)) {
            const schedule = device.config?.schedule;

            // Skip device yang tidak punya jadwal atau jadwal dimatikan
            if (!schedule?.enabled) continue;

            checkedCount++;

            const shouldBeActive = isScheduleActive(schedule);

            // Baca state saat ini dari root field (bukan config)
            const currentlyOn =
                device.monitoring !== false && device.laser_on !== false;

            // Skip jika state sudah benar
            if (currentlyOn === shouldBeActive) continue;

            // Catat update yang perlu dilakukan
            updates[`devices/${deviceId}/monitoring`] = shouldBeActive;
            updates[`devices/${deviceId}/laser_on`] = shouldBeActive;

            // Sinkron juga ke config agar React app terbaca konsisten
            updates[`devices/${deviceId}/config/monitoring`] = shouldBeActive;
            updates[`devices/${deviceId}/config/laser_on`] = shouldBeActive;

            changedCount++;
            logger.info(
                `Schedule → device=${deviceId} name="${device.name}" ` +
                `state=${shouldBeActive ? "ON" : "OFF"}`
            );
        }

        // Tulis semua update sekaligus (atomic multi-path update)
        if (changedCount > 0) {
            await db.ref().update(updates);
        }

        logger.info(
            `Schedule check done. checked=${checkedCount} changed=${changedCount}`
        );
    }
);