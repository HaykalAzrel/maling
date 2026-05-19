import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { ref, set, remove } from "firebase/database";
import { firebaseApp, database } from "../firebase/config";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

// Sanitize FCM token to use as Firebase key (tokens contain chars that are invalid in DB keys)
const tokenToKey = (token: string) =>
  token.replace(/[.#$[\]/]/g, "_").slice(0, 768);

export const registerFCMToken = async (userId: string): Promise<void> => {
  if (!database) return;

  try {
    if (Capacitor.isNativePlatform()) {
      await registerNativePush(userId);
    } else {
      await registerWebPush(userId);
    }
  } catch (error) {
    console.warn("FCM token registration failed:", error);
  }
};

const registerWebPush = async (userId: string): Promise<void> => {
  if (!firebaseApp || !VAPID_KEY) return;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

  if (Notification.permission === "denied") return;

  // Register service worker (must be at root scope for Firebase Messaging)
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

  await set(ref(database!, `users/${userId}/fcmTokens/${tokenToKey(token)}`), token);
};

const registerNativePush = async (userId: string): Promise<void> => {
  const permResult = await PushNotifications.requestPermissions();
  if (permResult.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    if (!database) return;
    await set(
      ref(database, `users/${userId}/fcmTokens/${tokenToKey(token.value)}`),
      token.value
    );
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.warn("Native push registration error:", err);
  });

  // Handle notification tap when app is backgrounded/killed
  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification.data as Record<string, string> | undefined;
    if (data?.deviceId) {
      window.location.href = `/devices/${data.deviceId}`;
    }
  });
};

export const removeFCMToken = async (userId: string, token: string): Promise<void> => {
  if (!database) return;
  await remove(ref(database, `users/${userId}/fcmTokens/${tokenToKey(token)}`));
};

// Handle foreground FCM messages on web (native handles via OS)
export const setupForegroundMessaging = (): (() => void) | undefined => {
  if (!firebaseApp || Capacitor.isNativePlatform()) return undefined;

  try {
    const messaging = getMessaging(firebaseApp);
    const unsubscribe = onMessage(messaging, (payload) => {
      // When the app is in foreground, the alarm dialog and toast already handle alerts.
      // Log for debugging; the real-time DB listener triggers the in-app alarm.
      console.debug("FCM foreground message:", payload.notification?.title);
    });
    return unsubscribe;
  } catch {
    return undefined;
  }
};
