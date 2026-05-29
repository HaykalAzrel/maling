"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestFcm = exports.onNewAlert = exports.checkDeviceSchedules = void 0;
const database_1 = require("firebase-functions/v2/database");
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const database_2 = require("firebase-admin/database");
const messaging_1 = require("firebase-admin/messaging");
var scheduleRunner_1 = require("./scheduleRunner");
Object.defineProperty(exports, "checkDeviceSchedules", { enumerable: true, get: function () { return scheduleRunner_1.checkDeviceSchedules; } });
(0, app_1.initializeApp)();
exports.onNewAlert = (0, database_1.onValueCreated)({
    ref: "/devices/{deviceId}/alerts/{alertId}",
    instance: "webdashboardptapt-default-rtdb",
    region: "asia-southeast1",
    secrets: ["ONESIGNAL_API_KEY", "ONESIGNAL_APP_ID"],
}, async (event) => {
    const { deviceId, alertId } = event.params;
    console.log("onNewAlert triggered:", { deviceId, alertId });
    const alert = event.data.val();
    if (!alert) {
        console.log("No alert data");
        return;
    }
    const db = (0, database_2.getDatabase)();
    // ✅ Cek suppressAlertsUntil
    const suppressSnap = await db
        .ref(`/devices/${deviceId}/config/suppressAlertsUntil`)
        .get();
    const suppressUntil = suppressSnap.val() ?? 0;
    console.log("suppressUntil:", suppressUntil, "now:", Date.now());
    if (Date.now() < suppressUntil)
        return;
    // Ambil data device
    const deviceSnap = await db.ref(`/devices/${deviceId}`).get();
    const device = deviceSnap.val();
    if (!device) {
        console.log("No device data");
        return;
    }
    // ✅ Cek laser_on — skip kalau laser dimatikan user
    const laserOn = device.laser_on ??
        device.config?.laser_on;
    console.log("laserOn:", laserOn);
    if (!laserOn) {
        console.log("Laser is off, skipping");
        return;
    }
    const ownerId = (device.ownerId ?? device.owner);
    console.log("ownerId:", ownerId);
    if (!ownerId) {
        console.log("No ownerId");
        return;
    }
    // ✅ Cek notifikasi diaktifkan untuk device ini
    const notifSnap = await db
        .ref(`/devices/${deviceId}/config/notifications/enabled`)
        .get();
    const notificationsEnabled = notifSnap.val() !== false;
    console.log("notificationsEnabled:", notificationsEnabled);
    if (!notificationsEnabled) {
        console.log("Notifications disabled");
        return;
    }
    // Ambil FCM tokens
    const tokensSnap = await db.ref(`users/${ownerId}/fcmTokens`).get();
    const tokensData = tokensSnap.val();
    console.log("tokensData:", tokensData);
    if (!tokensData) {
        console.log("No FCM tokens");
        return;
    }
    // ✅ Deduplikasi token
    const tokens = [
        ...new Set(Object.values(tokensData).filter(Boolean)),
    ];
    if (tokens.length === 0)
        return;
    const deviceName = device.name ?? `Sensor ${deviceId}`;
    // ✅ Normalize timestamp detik → milidetik
    const rawTimestamp = alert.timestamp ??
        alert.created_at ??
        Date.now();
    const timestamp = rawTimestamp < 1000000000000
        ? rawTimestamp * 1000
        : rawTimestamp;
    const timeStr = new Date(timestamp).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
    });
    const messaging = (0, messaging_1.getMessaging)();
    try {
        console.log("Sending FCM:", tokens);
        const response = await messaging.sendEachForMulticast({
            tokens,
            data: {
                deviceId,
                alertId,
                deviceName,
                type: "alarm",
                timestamp: String(timestamp),
                timeStr,
            },
            android: {
                priority: "high",
                ttl: 30000,
            },
            apns: {
                headers: { "apns-priority": "10" },
                payload: {
                    aps: {
                        contentAvailable: true,
                    },
                },
            },
        });
        console.log("FCM success:", response.successCount);
        console.log("FCM fail:", response.failureCount);
        console.log("FCM response:", JSON.stringify(response.responses.map(r => ({
            success: r.success,
            error: r.error?.code,
        }))));
        // Hapus token tidak valid
        const tokenKeys = Object.keys(tokensData);
        const staleKeys = response.responses
            .map((resp, idx) => {
            const code = resp.error?.code;
            const isStale = code === "messaging/registration-token-not-registered" ||
                code === "messaging/invalid-registration-token";
            if (!isStale)
                return null;
            const tokenValue = tokens[idx];
            const originalKey = tokenKeys.find((k) => tokensData[k] === tokenValue);
            return originalKey ?? null;
        })
            .filter((k) => k !== null);
        if (staleKeys.length > 0) {
            await Promise.all(staleKeys.map((key) => db.ref(`/users/${ownerId}/fcmTokens/${key}`).remove()));
        }
    }
    catch (err) {
        console.error("FCM sendEachForMulticast error:", err);
    }
});
exports.sendTestFcm = (0, https_1.onRequest)({
    region: "asia-southeast1",
}, async (req, res) => {
    try {
        const token = req.body?.token ??
            req.query?.token;
        if (!token) {
            res.status(400).json({ ok: false, error: "Missing token" });
            return;
        }
        const messaging = (0, messaging_1.getMessaging)();
        const response = await messaging.send({
            token,
            data: {
                type: "alarm",
                deviceId: "DETEKSI-8A2EEC",
                deviceName: "Pintu",
                timeStr: new Date().toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
            },
            android: {
                priority: "high",
                ttl: 30000,
            },
        });
        res.json({ ok: true, messageId: response });
    }
    catch (err) {
        const message = err.message ?? String(err);
        res.status(500).json({ ok: false, error: message });
    }
});
//# sourceMappingURL=index.js.map