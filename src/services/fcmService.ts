import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { ref, set, remove, get } from "firebase/database";
import { firebaseApp, database } from "../firebase/config";
import { nativeLog } from "./nativeLogger";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const tokenToKey = (token: string) =>
    token.replace(/[.#$[\]/]/g, "_").slice(0, 768);

export const registerFCMToken = async (userId: string): Promise<void> => {
    if (!database) return;

    try {
        console.debug("Securo FCM register start:", { userId });
        void nativeLog(`FCM register start user=${userId}`);
        if (Capacitor.isNativePlatform()) {
            await registerNativePush(userId);
        } else {
            await registerWebPush(userId);
        }
    } catch (error: unknown) {
        const code = (error as { code?: string }).code ?? "";
        if (code.startsWith("messaging/permission")) return;
        console.warn("FCM token registration failed:", error);
    }
};

const registerWebPush = async (userId: string): Promise<void> => {
    if (!firebaseApp || !VAPID_KEY) return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    if (Notification.permission === "denied") return;

    const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/" }
    );

    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
    });

    if (!token) return;

    // Cek duplikat sebelum simpan
    const existing = await get(ref(database!, `users/${userId}/fcmTokens`));
    const tokens = existing.val() as Record<string, string> | null;
    const alreadyExists = tokens && Object.values(tokens).includes(token);
    if (alreadyExists) return;

    await set(
        ref(database!, `users/${userId}/fcmTokens/${tokenToKey(token)}`),
        token
    );
};

const registerNativePush = async (userId: string): Promise<void> => {
    const permResult = await PushNotifications.requestPermissions();
    console.debug("Securo FCM permissions:", permResult.receive);
    void nativeLog(`FCM permissions: ${permResult.receive}`);
    if (permResult.receive !== "granted") return;

    // ✅ Pasang semua listener dulu sebelum register
    await PushNotifications.removeAllListeners();

    console.debug("Securo FCM listeners setup starting");
    void nativeLog("FCM listeners setup starting");

    await PushNotifications.addListener("registration", async (token) => {
        if (!database) return;

        console.debug("Securo FCM token received:", token.value);
        void nativeLog(`FCM token received ${token.value}`);

        // ✅ Cek duplikat sebelum simpan
        const existing = await get(ref(database, `users/${userId}/fcmTokens`));
        const tokens = existing.val() as Record<string, string> | null;
        const alreadyExists = tokens && Object.values(tokens).includes(token.value);
        if (alreadyExists) return;

        await set(
            ref(database, `users/${userId}/fcmTokens/${tokenToKey(token.value)}`),
            token.value
        );

        console.debug("Securo FCM token saved:", token.value);
        void nativeLog(`FCM token saved ${token.value}`);
    });

    await PushNotifications.addListener("registrationError", (err) => {
        console.warn("Securo FCM registration error:", err);
        void nativeLog(`FCM registration error ${String(err)}`, "w");
    });

    // ✅ Handle notifikasi saat app terbuka
    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
        const data = notification.data as Record<string, string> | undefined;
        if (data?.type === "alarm" && data?.deviceId) {
            window.dispatchEvent(new CustomEvent("fcm-alert", { detail: data }));
        }
    });

    // Handle tap notifikasi
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const data = action.notification.data as Record<string, string> | undefined;
        if (data?.deviceId) {
            window.location.href = `/devices/${data.deviceId}`;
        } else {
            window.location.href = "/activity";
        }
    });

    console.debug("Securo FCM register() calling");
    void nativeLog("FCM register() calling");
    await PushNotifications.register(); // ✅ Register terakhir
    console.debug("Securo FCM register() done");
    void nativeLog("FCM register() done");
};

export const removeFCMToken = async (userId: string, token: string): Promise<void> => {
    if (!database) return;
    await remove(ref(database, `users/${userId}/fcmTokens/${tokenToKey(token)}`));
};

export const setupForegroundMessaging = (): (() => void) | undefined => {
    if (!firebaseApp || Capacitor.isNativePlatform()) return undefined;

    try {
        const messaging = getMessaging(firebaseApp);
        const unsubscribe = onMessage(messaging, (payload) => {
            // Dispatch event supaya komponen lain bisa react
            if (payload.data?.type === "alarm") {
                window.dispatchEvent(
                    new CustomEvent("fcm-alert", { detail: payload.data })
                );
            }
            console.debug("FCM foreground message:", payload.notification?.title);
        });
        return unsubscribe;
    } catch {
        return undefined;
    }
};
