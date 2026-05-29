import { onValueCreated } from "firebase-functions/v2/database";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";

export { checkDeviceSchedules } from "./scheduleRunner";

initializeApp();

export const onNewAlert = onValueCreated(
    {
        ref: "/devices/{deviceId}/alerts/{alertId}",
        instance: "webdashboardptapt-default-rtdb",
        region: "asia-southeast1",
        secrets: ["ONESIGNAL_API_KEY", "ONESIGNAL_APP_ID"],
    },
    async (event) => {
        const { deviceId, alertId } = event.params;
        console.log("onNewAlert triggered:", { deviceId, alertId });

        const alert = event.data.val() as Record<string, unknown> | null;
        if (!alert) { console.log("No alert data"); return; }

        const db = getDatabase();

        // ✅ Cek suppressAlertsUntil
        const suppressSnap = await db
            .ref(`/devices/${deviceId}/config/suppressAlertsUntil`)
            .get();
        const suppressUntil = (suppressSnap.val() as number | null) ?? 0;
        console.log("suppressUntil:", suppressUntil, "now:", Date.now());
        if (Date.now() < suppressUntil) return;

        // Ambil data device
        const deviceSnap = await db.ref(`/devices/${deviceId}`).get();
        const device = deviceSnap.val() as Record<string, unknown> | null;
        if (!device) { console.log("No device data"); return; }

        // ✅ Cek laser_on — skip kalau laser dimatikan user
        const laserOn =
            (device.laser_on as boolean | undefined) ??
            ((device.config as Record<string, unknown> | undefined)?.laser_on as boolean | undefined);
            console.log("laserOn:", laserOn);

         if (!laserOn) { console.log("Laser is off, skipping"); return; }

        const ownerId = (device.ownerId ?? device.owner) as string | undefined;
        console.log("ownerId:", ownerId);

        if (!ownerId) { console.log("No ownerId"); return; }

        // ✅ Cek notifikasi diaktifkan untuk device ini
        const notifSnap = await db
            .ref(`/devices/${deviceId}/config/notifications/enabled`)
            .get();
        const notificationsEnabled = notifSnap.val() !== false;
        console.log("notificationsEnabled:", notificationsEnabled);
        if (!notificationsEnabled) { console.log("Notifications disabled"); return; }

        // Ambil FCM tokens
        const tokensSnap = await db.ref(`users/${ownerId}/fcmTokens`).get();
        const tokensData = tokensSnap.val() as Record<string, string> | null;
        console.log("tokensData:", tokensData);

        if (!tokensData) { console.log("No FCM tokens"); return; }

        // ✅ Deduplikasi token
        const tokens: string[] = [
            ...new Set(Object.values(tokensData).filter(Boolean)),
        ];
        if (tokens.length === 0) return;

        const deviceName =
            (device.name as string | undefined) ?? `Sensor ${deviceId}`;

        // ✅ Normalize timestamp detik → milidetik
        const rawTimestamp =
            (alert.timestamp as number | undefined) ??
            (alert.created_at as number | undefined) ??
            Date.now();
        const timestamp =
            rawTimestamp < 1_000_000_000_000
                ? rawTimestamp * 1000
                : rawTimestamp;

        const timeStr = new Date(timestamp).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
        });

        const messaging = getMessaging();

try {
    console.log(
    "Sending FCM:",
    tokens
    );
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

    console.log(
        "FCM success:",
        response.successCount
    );

    console.log(
        "FCM fail:",
        response.failureCount
    );

    console.log("FCM response:", JSON.stringify(response.responses.map(r => ({
        success: r.success,
        error: r.error?.code,
    }))));

    // Hapus token tidak valid
    const tokenKeys = Object.keys(tokensData);
    const staleKeys = response.responses
        .map((resp, idx) => {
            const code = resp.error?.code;
            const isStale =
                code === "messaging/registration-token-not-registered" ||
                code === "messaging/invalid-registration-token";
            if (!isStale) return null;
            const tokenValue = tokens[idx];
            const originalKey = tokenKeys.find((k) => tokensData[k] === tokenValue);
            return originalKey ?? null;
        })
        .filter((k): k is string => k !== null);

    if (staleKeys.length > 0) {
        await Promise.all(
            staleKeys.map((key) =>
                db.ref(`/users/${ownerId}/fcmTokens/${key}`).remove()
            )
        );
    }
} catch (err) {
    console.error("FCM sendEachForMulticast error:", err);
}

    }
);

export const sendTestFcm = onRequest(
    {
        region: "asia-southeast1",
    },
    async (req, res) => {
        try {
            const token =
                (req.body?.token as string | undefined) ??
                (req.query?.token as string | undefined);

            if (!token) {
                res.status(400).json({ ok: false, error: "Missing token" });
                return;
            }

            const messaging = getMessaging();
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
                    ttl: 30_000,
                },
            });

            res.json({ ok: true, messageId: response });
        } catch (err) {
            const message = (err as Error).message ?? String(err);
            res.status(500).json({ ok: false, error: message });
        }
    }
);
