import { onValueCreated } from "firebase-functions/v2/database";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";

initializeApp();

export const onNewAlert = onValueCreated(
  {
    ref: "/devices/{deviceId}/alerts/{alertId}",
    instance: "webdashboardptapt-default-rtdb",
    region: "asia-southeast1",
  },
  async (event) => {
    const { deviceId, alertId } = event.params;
    const alert = event.data.val() as Record<string, unknown> | null;

    if (!alert) return;

    const db = getDatabase();

    // ✅ Cek suppressAlertsUntil — skip jika power toggle baru saja dilakukan
    const suppressSnap = await db
      .ref(`/devices/${deviceId}/config/suppressAlertsUntil`)
      .get();
    const suppressUntil = (suppressSnap.val() as number | null) ?? 0;
    if (Date.now() < suppressUntil) return;

    // Ambil info device untuk cari owner
    const deviceSnap = await db.ref(`/devices/${deviceId}`).get();
    const device = deviceSnap.val() as Record<string, unknown> | null;
    if (!device) return;

    const ownerId = (device.ownerId ?? device.owner) as string | undefined;
    if (!ownerId) return;

    // ✅ Cek notifikasi diaktifkan untuk device ini
    const notifSnap = await db
      .ref(`/devices/${deviceId}/config/notifications/enabled`)
      .get();
    const notificationsEnabled = notifSnap.val() !== false; // default true
    if (!notificationsEnabled) return;

    // Ambil semua FCM tokens milik user
    const tokensSnap = await db.ref(`/users/${ownerId}/fcmTokens`).get();
    const tokensData = tokensSnap.val() as Record<string, string> | null;
    if (!tokensData) return;

    const tokens: string[] = Object.values(tokensData).filter(Boolean);
    if (tokens.length === 0) return;

    const deviceName = (device.name as string | undefined) ?? `Sensor ${deviceId}`;
    const timestamp = (alert.timestamp as number | undefined) ?? Date.now();
    const timeStr = new Date(timestamp).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const messaging = getMessaging();
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

    // ✅ Hapus token yang sudah tidak valid
    const tokenKeys = Object.keys(tokensData);
    const staleKeys = response.responses
      .map((resp, idx) =>
        !resp.success &&
        (resp.error?.code === "messaging/registration-token-not-registered" ||
          resp.error?.code === "messaging/invalid-registration-token")
          ? tokenKeys[idx]
          : null
      )
      .filter((k): k is string => k !== null);

    await Promise.all(
      staleKeys.map((key) =>
        db.ref(`/users/${ownerId}/fcmTokens/${key}`).remove()
      )
    );
  }
);