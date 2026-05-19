import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

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

export const showAlarmNotification = async (
  title: string,
  body: string,
  options?: { sound?: boolean }
) => {
  if (Capacitor.isNativePlatform()) {
    const sound = options?.sound === false ? undefined : "default";

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() / 1000),
          title: `🚨 ${title}`,
          body,
          sound,
          actionTypeId: 'ALARM_ACTION',
          channelId: 'alarm-channel',
          ongoing: true,
          autoCancel: false,
          largeIcon: 'ic_launcher',
          smallIcon: 'ic_launcher',
          iconColor: '#ef4444',
          extra: { type: 'alarm' },
        },
      ],
    });
    return;
  }

  // Web: use browser Notification API for foreground notifications
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notification = new Notification(`🚨 ${title}`, {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'alarm-notification',
    requireInteraction: true,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};

export const cancelAllNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel(pending);
  }
};
