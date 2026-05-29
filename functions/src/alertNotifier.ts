/**
 * alertNotifier.ts — Firebase Cloud Function
 *
 * Mengirim FCM push notification ke semua token milik owner device
 * ketika sensor baru masuk ke RTDB (alerts/{pushId} baru).
 *
 * Trigger: onChildAdded di devices/{deviceId}/alerts/{alertId}
 *
 * Ini juga memperbaiki bug duplicate FCM token key di RTDB:
 * user mdENT4lhJwhVXJlFUn9gZXnI8Ad2 menyimpan raw token sebagai key
 * karena konflik lama antara notificationService.ts dan fcmService.ts.
 * Fungsi ini toleran terhadap format key apapun — yang penting value-nya valid.
 */

import { onValueCreated } from "firebase-functions/v2/database";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";
import { initializeApp, getApps } from "firebase-admin/app";
import { logger } from "firebase-functions/v2";

if (getApps().length === 0) {
    initializeApp();
}

interface AlertData {
    status: string;
    waktu: string;
    created_at: number;
}

export const sendAlertNotification = onValueCreated(
    {
        ref: "devices/{deviceId}/alerts/{alertId}",
        region: "asia-southeast1",
        memory: "256MiB",
    },
    async (event) => {
        const { deviceId } = event.params;
        const alert = event.data.val() as AlertData;

        if (!alert || alert.status !== "TERDETEKSI") return;

        const db = getDatabase();

        // Ambil info device
        const deviceSnap = await db.ref(`devices/${deviceId}`).get();
        if (!deviceSnap.exists()) return;

        const device = deviceSnap.val() as {
            name: string;
            owner?: string;
            ownerId?: string;
            config?: { notifications?: { enabled: boolean } };
        };

        // Cek apakah notifikasi diaktifkan untuk device ini
        if (device.config?.notifications?.enabled === false) return;

        const ownerId = device.owner ?? device.ownerId;
        if (!ownerId) return;

        // Ambil semua FCM token milik owner
        const tokensSnap = await db.ref(`users/${ownerId}/fcmTokens`).get();
        if (!tokensSnap.exists()) return;

        const tokensRaw = tokensSnap.val() as Record<string, string>;

        // Ambil unique values — toleran terhadap format key manapun
        // (bug lama: ada key = raw token, ada key = android_xxxxx)
        const tokens = [...new Set(Object.values(tokensRaw))].filter(Boolean);

        if (tokens.length === 0) return;

        const deviceName = device.name ?? deviceId;
        const message = {
            data: {
                type: "alarm",
                deviceId,
                deviceName,
                waktu: alert.waktu ?? "",
                timeStr: alert.waktu ?? "",
            },
            android: {
                priority: "high" as const,
                ttl: 30_000,
            },
        };

        // Kirim ke semua token, kumpulkan yang gagal untuk dibersihkan
        logger.info(`sendAlertNotification: sending data-only FCM to ${tokens.length} token(s)`);
        const results = await Promise.allSettled(
            tokens.map((token) =>
                getMessaging().send({ ...message, token })
            )
        );

        const invalidTokens: string[] = [];

        results.forEach((result, i) => {
            if (result.status === "rejected") {
                const errCode = (result.reason as { code?: string }).code ?? "";
                // Token tidak valid / tidak terdaftar → hapus dari RTDB
                if (
                    errCode.includes("registration-token-not-registered") ||
                    errCode.includes("invalid-registration-token")
                ) {
                    invalidTokens.push(tokens[i]!);
                }
                logger.warn(`FCM send failed token[${i}]:`, errCode);
            }
        });

        // Bersihkan token yang tidak valid dari RTDB
        if (invalidTokens.length > 0) {
            const allTokensRaw = tokensRaw;
            const cleanupUpdates: Record<string, null> = {};

            for (const [key, value] of Object.entries(allTokensRaw)) {
                if (invalidTokens.includes(value)) {
                    cleanupUpdates[`users/${ownerId}/fcmTokens/${key}`] = null;
                }
            }

            await db.ref().update(cleanupUpdates);
            logger.info(`Cleaned ${invalidTokens.length} invalid FCM token(s) for user=${ownerId}`);
        }

        const successCount = results.filter((r) => r.status === "fulfilled").length;
        logger.info(
            `Alert sent: device=${deviceId} tokens=${tokens.length} success=${successCount}`
        );
    }
);
