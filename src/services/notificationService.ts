import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export const requestNotificationPermission = async () => {
  if (!Capacitor.isNativePlatform()) return;
  const permission = await LocalNotifications.requestPermissions();
  return permission.display === 'granted';
};

export const showAlarmNotification = async (title: string, body: string) => {
  if (!Capacitor.isNativePlatform()) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.floor(Date.now() / 1000),
        title: `🚨 ${title}`,
        body,
        sound: 'default',
        actionTypeId: 'ALARM_ACTION',
        channelId: 'alarm-channel',
        ongoing: true,
        autoCancel: false,
        largeIcon: 'ic_launcher',
        smallIcon: 'ic_launcher',
        iconColor: '#ef4444',
        extra: {
          type: 'alarm'
        }
      }
    ]
  });
};

export const cancelAllNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel(pending);
  }
};