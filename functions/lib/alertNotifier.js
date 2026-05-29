"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAlertNotification = void 0;
const database_1 = require("firebase-functions/v2/database");
const database_2 = require("firebase-admin/database");
const messaging_1 = require("firebase-admin/messaging");
const app_1 = require("firebase-admin/app");
const v2_1 = require("firebase-functions/v2");
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
exports.sendAlertNotification = (0, database_1.onValueCreated)({
    ref: "devices/{deviceId}/alerts/{alertId}",
    region: "asia-southeast1",
    memory: "256MiB",
}, async (event) => {
    const { deviceId } = event.params;
    const alert = event.data.val();
    if (!alert || alert.status !== "TERDETEKSI")
        return;
    const db = (0, database_2.getDatabase)();
    // Ambil info device
    const deviceSnap = await db.ref(`devices/${deviceId}`).get();
    if (!deviceSnap.exists())
        return;
    const device = deviceSnap.val();
    // Cek apakah notifikasi diaktifkan untuk device ini
    if (device.config?.notifications?.enabled === false)
        return;
    const ownerId = device.owner ?? device.ownerId;
    if (!ownerId)
        return;
    // Ambil semua FCM token milik owner
    const tokensSnap = await db.ref(`users/${ownerId}/fcmTokens`).get();
    if (!tokensSnap.exists())
        return;
    const tokensRaw = tokensSnap.val();
    // Ambil unique values — toleran terhadap format key manapun
    // (bug lama: ada key = raw token, ada key = android_xxxxx)
    const tokens = [...new Set(Object.values(tokensRaw))].filter(Boolean);
    if (tokens.length === 0)
        return;
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
            priority: "high",
            ttl: 30000,
        },
    };
    // Kirim ke semua token, kumpulkan yang gagal untuk dibersihkan
    v2_1.logger.info(`sendAlertNotification: sending data-only FCM to ${tokens.length} token(s)`);
    const results = await Promise.allSettled(tokens.map((token) => (0, messaging_1.getMessaging)().send({ ...message, token })));
    const invalidTokens = [];
    results.forEach((result, i) => {
        if (result.status === "rejected") {
            const errCode = result.reason.code ?? "";
            // Token tidak valid / tidak terdaftar → hapus dari RTDB
            if (errCode.includes("registration-token-not-registered") ||
                errCode.includes("invalid-registration-token")) {
                invalidTokens.push(tokens[i]);
            }
            v2_1.logger.warn(`FCM send failed token[${i}]:`, errCode);
        }
    });
    // Bersihkan token yang tidak valid dari RTDB
    if (invalidTokens.length > 0) {
        const allTokensRaw = tokensRaw;
        const cleanupUpdates = {};
        for (const [key, value] of Object.entries(allTokensRaw)) {
            if (invalidTokens.includes(value)) {
                cleanupUpdates[`users/${ownerId}/fcmTokens/${key}`] = null;
            }
        }
        await db.ref().update(cleanupUpdates);
        v2_1.logger.info(`Cleaned ${invalidTokens.length} invalid FCM token(s) for user=${ownerId}`);
    }
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    v2_1.logger.info(`Alert sent: device=${deviceId} tokens=${tokens.length} success=${successCount}`);
});
//# sourceMappingURL=alertNotifier.js.map