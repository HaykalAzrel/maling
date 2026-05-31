import { Capacitor, registerPlugin } from "@capacitor/core";

interface AlarmLauncherPlugin {
  open(options: { 
    deviceName: string; 
    time: string;
    soundEnabled: boolean;
    vibrationMode: string;
    ringtoneType: string;
    ringtoneName: string;
    ringtoneFilePath: string;
  }): Promise<{ ok: boolean }>;
}

const AlarmLauncher = registerPlugin<AlarmLauncherPlugin>("AlarmLauncher");

export const openAlarmFullscreen = async (
  deviceName: string,
  time: string,
): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  // Baca preferences dari localStorage
  let soundEnabled = true;
  let vibrationMode = "long";
  let ringtoneType = "preset";
  let ringtoneName = "default";

  try {
    const raw = localStorage.getItem("secureSense:alarmPrefs");
    if (raw) {
      const prefs = JSON.parse(raw) as {
        soundEnabled?: boolean;
        vibrationMode?: string;
        ringtoneType?: string;
        ringtoneName?: string;
      };
      soundEnabled = prefs.soundEnabled ?? true;
      vibrationMode = prefs.vibrationMode ?? "long";
      ringtoneType = prefs.ringtoneType ?? "preset";
      ringtoneName = prefs.ringtoneName ?? "default";
    }
  } catch { /* ignore */ }

  // Baca dari localStorage
  let customRingtonePath: string | null = null;
    try {
      customRingtonePath = localStorage.getItem("secureSense:customRingtonePath");
  } catch { /* ignore */ }

  await AlarmLauncher.open({ 
    deviceName, 
    time,
    soundEnabled,
    vibrationMode,
    ringtoneType,
    ringtoneName,
    ringtoneFilePath: customRingtonePath ?? "",
  });
};