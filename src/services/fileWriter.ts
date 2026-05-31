import { Capacitor, registerPlugin } from "@capacitor/core";

interface FileWriterPlugin {
  writeBase64(options: { fileName: string; data: string }): Promise<{ path: string }>;
  getPath(options: { fileName: string }): Promise<{ path: string | null; exists: boolean }>;
  saveAlarmPrefs(options: {
    soundEnabled: boolean;
    vibrationMode: string;
    ringtoneType: string;
    ringtoneName: string;
    ringtoneFilePath: string;
  }): Promise<{ ok: boolean }>;
}

export const saveAlarmPrefsNative = async (prefs: {
  soundEnabled: boolean;
  vibrationMode: string;
  ringtoneType: string;
  ringtoneName: string;
  ringtoneFilePath?: string | null;
}): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await FileWriter.saveAlarmPrefs({
      soundEnabled: prefs.soundEnabled,
      vibrationMode: prefs.vibrationMode,
      ringtoneType: prefs.ringtoneType,
      ringtoneName: prefs.ringtoneName,
      ringtoneFilePath: prefs.ringtoneFilePath ?? "",
    });
  } catch { /* ignore */ }
};

const FileWriter = registerPlugin<FileWriterPlugin>("FileWriter");

export const saveCustomRingtone = async (base64DataUrl: string): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const result = await FileWriter.writeBase64({
      fileName: "custom_ringtone.mp3",
      data: base64DataUrl,
    });
    
    // Simpan path ke localStorage
    localStorage.setItem("secureSense:customRingtonePath", result.path);
    return result.path;
  } catch {
    return null;
  }
};

export const getCustomRingtonePath = async (): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const result = await FileWriter.getPath({ fileName: "custom_ringtone.mp3" });
    if (result.exists && result.path) {
      localStorage.setItem("secureSense:customRingtonePath", result.path);
      return result.path;
    }
    return null;
  } catch {
    return null;
  }
};