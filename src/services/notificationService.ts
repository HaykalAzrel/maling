import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { ref, update, remove } from 'firebase/database';
import { database } from '../firebase/config';

const ALARM_NOTIFICATION_ID = 1001;

// ✅ Unique key per device untuk FCM token
const getDeviceTokenKey = (): string => {
  const platform = Capacitor.getPlatform();
  let deviceKey = localStorage.getItem('secureSense:deviceKey');
  if (!deviceKey) {
    deviceKey = `${platform}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('secureSense:deviceKey', deviceKey);
  }
  return deviceKey;
};

// ── Notification Channel ──────────────────────────────────────────────────
export const setupNotificationChannels = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: 'alarm-channel',
      name: 'Alarm',
      description: 'Notifikasi darurat sensor laser terblocked',
      importance: 5,   // IMPORTANCE_HIGH
      vibration: true,
      sound: 'default',
      visibility: 1,   // VISIBILITY_PUBLIC
    });
  } catch {
    // channel might already exist — ignore
  }
};

// ── Permission ────────────────────────────────────────────────────────────
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    const permission = await LocalNotifications.requestPermissions();
    return permission.display === 'granted';
  }

  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
};

// ── FCM Token Registration ─────────────────────────────────────────────────
export const registerFCMToken = async (userId: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  if (!database) return;

  const db = database;

  try {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;

    await PushNotifications.register();

    // ✅ Simpan token ke Firebase saat didapat
    await PushNotifications.addListener('registration', async (token) => {
      console.log('FCM Token:', token.value);
      const deviceKey = getDeviceTokenKey();
      await update(ref(db, `users/${userId}/fcmTokens`), {
        [deviceKey]: token.value,
      });
    });

    // ✅ Foreground push — sudah ada AlarmToastBridge, cukup log saja
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('FCM foreground:', notification);
    });

    // ✅ Saat user tap notifikasi dari background/closed
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('FCM tapped:', action.notification.data);
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('FCM registration error:', error);
    });

  } catch (error) {
    console.error('registerFCMToken failed:', error);
  }
};

// ✅ Hapus token saat logout agar notif tidak dikirim ke device yang sudah logout
export const unregisterFCMToken = async (userId: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  if (!database) return;

  const db = database;

  try {
    const deviceKey = getDeviceTokenKey();
    await remove(ref(db, `users/${userId}/fcmTokens/${deviceKey}`));
    await PushNotifications.removeAllListeners();
  } catch (error) {
    console.error('unregisterFCMToken failed:', error);
  }
};

// ── Local Notification (foreground alarm) ─────────────────────────────────
export const showAlarmNotification = async (
  title: string,
  body: string,
  options?: { sound?: boolean }
): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    const sound = options?.sound === false ? undefined : 'default';

    // Cancel notifikasi sebelumnya agar tidak duplikat
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: ALARM_NOTIFICATION_ID }],
      });
    } catch { /* ignore */ }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: ALARM_NOTIFICATION_ID,
          title: `🚨 ${title}`,
          body,
          sound,
          actionTypeId: 'ALARM_ACTION',
          channelId: 'alarm-channel',
          ongoing: false,
          autoCancel: true,
          largeIcon: 'ic_launcher',
          smallIcon: 'ic_launcher',
          iconColor: '#ef4444',
          extra: { type: 'alarm' },
        },
      ],
    });
    return;
  }

  // Web fallback
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notification = new Notification(`🚨 ${title}`, {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'alarm-notification',
    requireInteraction: false,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};

// ── Cancel Notifications ──────────────────────────────────────────────────
export const cancelAllNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: ALARM_NOTIFICATION_ID }],
    });
  } catch { /* ignore */ }

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }
  } catch { /* ignore */ }
};