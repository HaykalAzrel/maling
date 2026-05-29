importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey:            "AIzaSyBNt7TakKVGS1VZTz4ya9kf2-gkAUzXq5k",
    authDomain:        "webdashboardptapt.firebaseapp.com",
    databaseURL:       "https://webdashboardptapt-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId:         "webdashboardptapt",
    storageBucket:     "webdashboardptapt.firebasestorage.app",
    messagingSenderId: "383764904540",
    appId:             "1:383764904540:web:5caf9cbb688519e8e20499",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? "🚨 ALARM";
    const body  = payload.notification?.body  ?? "Laser sensor terblocked!";

    self.registration.showNotification(title, {
        body,
        icon:               "/icons/icon-192x192.png",
        badge:              "/icons/icon-72x72.png",
        tag:                "alarm-notification",
        requireInteraction: true,
        vibrate:            [200, 100, 200, 100, 400],
        data:               payload.data ?? {},
        actions: [
            { action: "acknowledge", title: "✓ Acknowledge" },
            { action: "dismiss",     title: "✕ Dismiss" },
        ],
    });
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    // ✅ Dismiss — tidak navigate
    if (event.action === "dismiss") return;

    const deviceId  = event.notification.data?.deviceId;
    const targetUrl = deviceId ? `/devices/${deviceId}` : "/dashboard";

    event.waitUntil(
        clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((windowClients) => {
                const existing = windowClients.find(
                    (c) => c.visibilityState === "visible"
                );
                if (existing) {
                    existing.focus();
                    if (deviceId) {
                        existing.postMessage({ type: "NAVIGATE", url: targetUrl });
                    }
                } else {
                    clients.openWindow(targetUrl);
                }
            })
    );
});