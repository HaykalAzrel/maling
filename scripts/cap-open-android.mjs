#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const printPathOnly = process.argv.includes("--print-path");

function resolveFromPath() {
  if (process.platform === "win32") {
    const result = spawnSync("where", ["android-studio"], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.split(/\r?\n/).find(Boolean)?.trim() ?? null : null;
  }

  const result = spawnSync(
    "sh",
    ["-lc", "command -v android-studio || command -v studio || command -v studio.sh || true"],
    { encoding: "utf8" }
  );

  return result.stdout.trim() || null;
}

function resolveAndroidStudioPath() {
  const home = process.env.HOME ?? "";
  const explicitPath = process.env.CAPACITOR_ANDROID_STUDIO_PATH;
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  const localAppData = process.env.LOCALAPPDATA;
  const candidates = [
    explicitPath,
    process.platform === "win32" && programFiles
      ? `${programFiles}\\Android\\Android Studio\\bin\\studio64.exe`
      : null,
    process.platform === "win32" && programFiles
      ? `${programFiles}\\Android\\Android Studio\\bin\\studio.exe`
      : null,
    process.platform === "win32" && programFilesX86
      ? `${programFilesX86}\\Android\\Android Studio\\bin\\studio64.exe`
      : null,
    process.platform === "win32" && programFilesX86
      ? `${programFilesX86}\\Android\\Android Studio\\bin\\studio.exe`
      : null,
    process.platform === "win32" && localAppData
      ? `${localAppData}\\Programs\\Android Studio\\bin\\studio64.exe`
      : null,
    process.platform === "win32" && localAppData
      ? `${localAppData}\\Programs\\Android Studio\\bin\\studio.exe`
      : null,
    process.platform === "linux" ? "/snap/bin/android-studio" : null,
    process.platform === "linux" ? "/usr/local/android-studio/bin/studio.sh" : null,
    process.platform === "linux" ? "/opt/android-studio/bin/studio.sh" : null,
    process.platform === "linux" && home ? `${home}/android-studio/bin/studio.sh` : null,
    process.platform === "darwin" ? "/Applications/Android Studio.app/Contents/MacOS/studio" : null,
    process.platform === "darwin" && home ? `${home}/Applications/Android Studio.app/Contents/MacOS/studio` : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return resolveFromPath();
}

const androidStudioPath = resolveAndroidStudioPath();

if (!androidStudioPath) {
  console.error("Unable to locate Android Studio.");
  console.error("Set CAPACITOR_ANDROID_STUDIO_PATH to your launcher path and try again.");
  process.exit(1);
}

if (printPathOnly) {
  console.log(androidStudioPath);
  process.exit(0);
}

const result = spawnSync("bunx", ["cap", "open", "android"], {
  stdio: "inherit",
  env: {
    ...process.env,
    CAPACITOR_ANDROID_STUDIO_PATH: androidStudioPath,
  },
});

process.exit(result.status ?? 1);
