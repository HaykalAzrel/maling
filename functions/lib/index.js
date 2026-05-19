"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onNewAlert = void 0;
const database_1 = require("firebase-functions/v2/database");
const app_1 = require("firebase-admin/app");
const database_2 = require("firebase-admin/database");
const messaging_1 = require("firebase-admin/messaging");
(0, app_1.initializeApp)();
// Triggered when a new alert is written to /devices/{deviceId}/alerts/{alertId}
exports.onNewAlert = (0, database_1.onValueCreated)({
    ref: "/devices/{deviceId}/alerts/{alertId}",
    instance: "webdashboardptapt-default-rtdb",
    region: "asia-southeast1",
}, async (event) => {
    const { deviceId, alertId } = event.params;
    const alert = event.data.val();
    if (!alert)
        return;
    const db = (0, database_2.getDatabase)();
    // Get device info to find the owner
    const deviceSnap = await db.ref(`/devices/${deviceId}`).get();
    const device = deviceSnap.val();
    if (!device)
        return;
    const ownerId = (device.ownerId ?? device.owner);
    if (!ownerId)
        return;
    // Get all registered FCM tokens for this user
    const tokensSnap = await db.ref(`/users/${ownerId}/fcmTokens`).get();
    const tokensData = tokensSnap.val();
    if (!tokensData)
        return;
    const tokens = Object.values(tokensData).filter(Boolean);
    if (tokens.length === 0)
        return;
    const deviceName = device.name ?? `Sensor ${deviceId}`;
    const timestamp = alert.timestamp ?? Date.now();
    const timeStr = new Date(timestamp).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
    });
    const messaging = (0, messaging_1.getMessaging)();
    const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
            title: "🚨 ALARM LASER TERBLOCKED",
            body: `${deviceName} • ${timeStr}`,
        },
        data: {
            deviceId,
            alertId,
            type: "alarm",
            timestamp: String(timestamp),
        },
        android: {
            priority: "high",
            notification: {
                channelId: "alarm-channel",
                priority: "max",
                sound: "default",
                defaultVibrateTimings: false,
                vibrateTimingsMillis: [0, 200, 100, 200, 100, 400],
                color: "#ef4444",
            },
        },
        apns: {
            headers: { "apns-priority": "10" },
            payload: {
                aps: {
                    sound: "default",
                    badge: 1,
                    contentAvailable: true,
                },
            },
        },
        webpush: {
            headers: { Urgency: "high" },
            notification: {
                requireInteraction: true,
                icon: "/icons/icon-192x192.png",
                badge: "/icons/icon-72x72.png",
                vibrate: [200, 100, 200, 100, 400],
            },
        },
    });
    // Clean up stale / invalid tokens
    const tokenKeys = Object.keys(tokensData);
    const staleKeys = response.responses
        .map((resp, idx) => !resp.success &&
        (resp.error?.code === "messaging/registration-token-not-registered" ||
            resp.error?.code === "messaging/invalid-registration-token")
        ? tokenKeys[idx]
        : null)
        .filter((k) => k !== null);
    await Promise.all(staleKeys.map((key) => db.ref(`/users/${ownerId}/fcmTokens/${key}`).remove()));
});
//# sourceMappingURL=index.js.map