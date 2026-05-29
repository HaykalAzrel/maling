import { Capacitor, registerPlugin } from "@capacitor/core";

type LogLevel = "d" | "i" | "w" | "e";

interface SecuroLoggerPlugin {
  log(options: { message: string; level?: LogLevel }): Promise<{ ok: boolean }>;
}

const SecuroLogger = registerPlugin<SecuroLoggerPlugin>("SecuroLogger");

export const nativeLog = async (
  message: string,
  level: LogLevel = "d"
): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await SecuroLogger.log({ message, level });
  } catch {
    // ignore
  }
};
