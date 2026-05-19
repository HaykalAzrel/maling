import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { AlertTriangle, Bell, CircleCheckBig, ShieldAlert, X } from "lucide-react";
import { Haptics } from "@capacitor/haptics";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "./pages/SplashScreen";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { Dashboard } from "./pages/Dashboard";
import { DevicesPage } from "./pages/DevicesPage";
import { AddDevicePage } from "./pages/AddDevicePage";
import { DeviceDetailPage } from "./pages/DeviceDetailPage";
import { ActivityPage } from "./pages/ActivityPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RingtonePage } from "./pages/RingtonePage";
import { VibrationPage } from "./pages/VibrationPage";
import { BottomNav } from "./components/BottomNav";
import { Toaster } from "./components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { useFirebaseAuth } from "../hooks/useFirebaseAuth";
import { useFirebaseDevices } from "../hooks/useFirebaseDevices";
import { useFirebaseActivity } from "../hooks/useFirebaseActivity";
import type { ActivityItem } from "../hooks/useFirebaseActivity";
import { requestNotificationPermission, showAlarmNotification } from "../services/notificationService";
import { registerFCMToken, setupForegroundMessaging } from "../services/fcmService";
import { useUserAlertPreferences } from "../hooks/useUserAlertPreferences";

const suppressAlertKey = "secureSense:suppressAlertsUntil";

type AlarmState = {
  id: string;
  title: string;
  device: string;
  deviceId?: string;
  notificationsEnabled: boolean;
  time: string;
  severity: ActivityItem["severity"];
  description: string;
};

// Tambahkan fungsi ini di luar komponen AlarmToastBridge

const playPresetLoop = (
  id: "default" | "beacon" | "siren",
  ctxRef: React.MutableRefObject<AudioContext | null>
) => {
  const ctx = new AudioContext();
  ctxRef.current = ctx;

  const scheduleBeep = (time: number) => {
    if (id === "default") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, time);
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
      osc.start(time);
      osc.stop(time + 0.4);
      return 1.2; // interval ke beep berikutnya (detik)

    } else if (id === "beacon") {
      [0, 0.25].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(660, time + offset);
        gain.gain.setValueAtTime(0.2, time + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.2);
        osc.start(time + offset);
        osc.stop(time + offset + 0.2);
      });
      return 1.5;

    } else {
      // siren
      [0, 0.35, 0.7].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(400, time + offset);
        osc.frequency.linearRampToValueAtTime(1200, time + offset + 0.3);
        gain.gain.setValueAtTime(0.3, time + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.3);
        osc.start(time + offset);
        osc.stop(time + offset + 0.3);
      });
      return 2.0;
    }
  };

  // Loop dengan scheduling
  let nextTime = ctx.currentTime;
  const loop = () => {
    if (ctxRef.current !== ctx) return; // sudah di-stop
    const interval = scheduleBeep(nextTime);
    nextTime += interval;
    setTimeout(loop, (nextTime - ctx.currentTime - 0.1) * 1000);
  };

  loop();
};

function AlarmToastBridge() {
  const { devices } = useFirebaseDevices();
  const { activities } = useFirebaseActivity(devices);
  const { preferences } = useUserAlertPreferences();
  const deviceById = useMemo(
    () => devices.reduce<Record<string, typeof devices[number]>>((accumulator, device) => {
      accumulator[device.id] = device;
      return accumulator;
    }, {}),
    [devices]
  );
  const seenActivityIds = useRef<Set<string>>(new Set());
  const notificationReady = useRef<boolean>(false);
  const sessionStart = useRef(Date.now());
  const vibrationTimer = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeAlarm, setActiveAlarm] = useState<AlarmState | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null); // ✅ tambah ini

  const stopAudio = useCallback(() => {
    // ✅ Stop custom audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // ✅ Stop preset audio
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  const blockedAlarm = useMemo(() => {
    const blockedActivities = activities.filter((activity) => {
      const isBlockedSensor = activity.type === "sensor" && activity.title.toLowerCase().includes("blocked");
      const isCriticalAlert = activity.type === "alert" && activity.severity === "critical";
      const isRecent = activity.timestamp >= sessionStart.current;

      return (isBlockedSensor || isCriticalAlert) && isRecent;
    });

    return blockedActivities[0] ?? null;
  }, [activities]);

  useEffect(() => {
    const ensurePermission = async () => {
      if (notificationReady.current) {
        return;
      }

      try {
        const granted = await requestNotificationPermission();
        notificationReady.current = Boolean(granted);
      } catch {
        notificationReady.current = false;
      }
    };

    if (preferences.pushNotifications) {
      void ensurePermission();
    }
  }, [preferences.pushNotifications]);

  const stopVibration = useCallback(() => {
    if (vibrationTimer.current) {
      window.clearInterval(vibrationTimer.current);
      vibrationTimer.current = null;
    }
  }, []);

  const startVibration = useCallback((mode: "short" | "long" | "continuous") => {
    stopVibration();

    const duration = mode === "short" ? 120 : mode === "long" ? 350 : 600;
    const interval = mode === "short" ? 500 : mode === "long" ? 900 : 700;

    const doVibrate = () => {
      if (Capacitor.isNativePlatform()) {
        void Haptics.vibrate({ duration });
      } else if ("vibrate" in navigator) {
        navigator.vibrate(duration);
      }
    };

    doVibrate();
    vibrationTimer.current = window.setInterval(doVibrate, interval);
  }, [stopVibration]);

  useEffect(() => {
    const nextSeenIds = new Set(seenActivityIds.current);

    let suppressUntil = 0;
    try {
      suppressUntil = Number(window.localStorage.getItem(suppressAlertKey)) || 0;
    } catch {
      suppressUntil = 0;
    }

    activities.forEach((activity) => {
  const isBlockedSensor = activity.type === "sensor" && activity.title.toLowerCase().includes("blocked");
  const isCriticalAlert = activity.type === "alert" && activity.severity === "critical";
  const isRecent = activity.timestamp >= sessionStart.current;

  if ((!isBlockedSensor && !isCriticalAlert) || !isRecent) return;
  if (nextSeenIds.has(activity.id)) return;

  // ✅ Deklarasi deviceConfig di atas sebelum dipakai
  const deviceConfig = activity.deviceId ? deviceById[activity.deviceId]?.config : undefined;
  const suppressUntilFromDevice = deviceConfig?.suppressAlertsUntil ?? 0;
  const notificationsEnabled = deviceConfig?.notifications?.enabled !== false;

  // ✅ Baca localStorage fresh di dalam loop
  let suppressUntil = 0;
  try {
    suppressUntil = Number(window.localStorage.getItem(suppressAlertKey)) || 0;
  } catch { suppressUntil = 0; }

  // ✅ Tandai seen lalu cek suppress sebelum trigger apapun
  nextSeenIds.add(activity.id);

  if (Date.now() < suppressUntil || Date.now() < suppressUntilFromDevice) return;

  toast.error(activity.title, {
    description: `${activity.device} • ${activity.time}`,
  });

  if (preferences.pushNotifications && notificationsEnabled) {
    void showAlarmNotification(activity.title, `${activity.device} • ${activity.time}`, {
      sound: preferences.soundEnabled,
    });
  }

    setActiveAlarm((currentAlarm) => {
      if (currentAlarm?.id === activity.id) return currentAlarm;
      return {
        id: activity.id,
        title: activity.title,
        device: activity.device,
        deviceId: activity.deviceId,
      notificationsEnabled,
      time: activity.time,
      severity: activity.severity,
      description:
        activity.type === "sensor"
          ? "Laser sensor was blocked. Immediate attention is required."
          : "Critical intrusion alert was received from this device.",
      };
    });
  });

  seenActivityIds.current = nextSeenIds;
  }, [activities, deviceById, preferences]);

  useEffect(() => {
    stopVibration();
    stopAudio();

    if (!activeAlarm) return;

    if (preferences.vibrationMode && activeAlarm.notificationsEnabled) {
      startVibration(preferences.vibrationMode);
    }

    if (preferences.soundEnabled && activeAlarm.notificationsEnabled) {
      const ringtone = preferences.ringtone;

      if (ringtone.type === "custom" && ringtone.customDataUrl) {
        // Custom upload
        const audio = new Audio(ringtone.customDataUrl);
        audio.loop = true;
        audioRef.current = audio;
        void audio.play().catch(() => undefined);

      } else if (ringtone.type === "preset" || ringtone.type === "default") {
        // ✅ Preset via Web Audio API
        const presetId =
          ringtone.name === "Siren" ? "siren"
          : ringtone.name === "Beacon" ? "beacon"
          : "default";
        playPresetLoop(presetId, audioCtxRef);
      }
    }

    return () => {
      stopVibration();
      stopAudio();
    };
  }, [activeAlarm, preferences.ringtone, preferences.soundEnabled, preferences.vibrationMode, startVibration, stopAudio, stopVibration]);

  useEffect(() => {
    if (!blockedAlarm) {
      return;
    }

    if (seenActivityIds.current.has(blockedAlarm.id)) {
      return;
    }

    let suppressUntil = 0;
    try {
      suppressUntil = Number(window.localStorage.getItem(suppressAlertKey)) || 0;
    } catch {
      suppressUntil = 0;
    }

    if (Date.now() < suppressUntil) {
      seenActivityIds.current.add(blockedAlarm.id);
      return;
    }

    setActiveAlarm((currentAlarm) => {
      if (currentAlarm?.id === blockedAlarm.id) {
        return currentAlarm;
      }

      const deviceConfig = blockedAlarm.deviceId ? deviceById[blockedAlarm.deviceId]?.config : undefined;
      const suppressUntilFromDevice = deviceConfig?.suppressAlertsUntil ?? 0;
      const notificationsEnabled = deviceConfig?.notifications?.enabled !== false;

      if (Date.now() < suppressUntilFromDevice) {
        seenActivityIds.current.add(blockedAlarm.id);
        return currentAlarm ?? null;
      }

      return {
        id: blockedAlarm.id,
        title: blockedAlarm.title,
        device: blockedAlarm.device,
        deviceId: blockedAlarm.deviceId,
        notificationsEnabled,
        time: blockedAlarm.time,
        severity: blockedAlarm.severity,
        description:
          blockedAlarm.type === "sensor"
            ? "Laser sensor was blocked. Immediate attention is required."
            : "Critical intrusion alert was received from this device.",
      };
    });
  }, [blockedAlarm, deviceById]);

  const dismissAlarm = () => {
    if (activeAlarm) {
      seenActivityIds.current.add(activeAlarm.id);
    }

    stopVibration();
    stopAudio();

    setActiveAlarm(null);
  };

  return (
    <Dialog open={Boolean(activeAlarm)} onOpenChange={(open) => !open && dismissAlarm()}>
      <DialogContent className="inset-0 top-0 left-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 bg-[#09090b] text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.38),transparent_45%),linear-gradient(180deg,rgba(127,29,29,0.92),rgba(9,9,11,0.98))]" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center p-6 sm:p-10 text-center gap-8">
          <DialogHeader className="text-center max-w-2xl space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_0_50px_rgba(239,68,68,0.35)] backdrop-blur">
              <ShieldAlert className="h-8 w-8 text-red-300" />
            </div>
            <div className="space-y-3">
              <DialogTitle className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
                ALARM LASER TERBLOCKED
              </DialogTitle>
              <DialogDescription className="text-base sm:text-xl text-white/80 max-w-xl">
                {activeAlarm?.description ?? "Laser sensor was blocked. Immediate attention is required."}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-3 max-w-4xl w-full">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2">Device</p>
              <p className="text-lg font-medium">{activeAlarm?.device ?? "Unknown device"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2">Event</p>
              <p className="text-lg font-medium flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-300" />
                {activeAlarm?.title ?? "Blocked"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2">Time</p>
              <p className="text-lg font-medium">{activeAlarm?.time ?? "Just now"}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:items-center">
            <div className="flex items-center gap-3 text-white/80 justify-center">
              <Bell className="h-5 w-5 text-red-300" />
              <span>Toast, notification, and full-screen alarm are active.</span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row justify-center">
              <button
                onClick={dismissAlarm}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/15"
              >
                <CircleCheckBig className="h-5 w-5" />
                Acknowledge
              </button>
              <button
                onClick={dismissAlarm}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 font-medium text-white transition hover:bg-red-400"
              >
                <X className="h-5 w-5" />
                Close
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FCMRegistrar() {
  const { user } = useFirebaseAuth();

  useEffect(() => {
    if (!user?.uid) return;
    void registerFCMToken(user.uid);
    const unsubscribe = setupForegroundMessaging();
    return () => { unsubscribe?.(); };
  }, [user?.uid]);

  return null;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useFirebaseAuth();

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Checking auth...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <AlarmToastBridge />
      <FCMRegistrar />
      {children}
    </>
  );
}

function HardwareBackHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let listener: { remove: () => Promise<void> } | null = null;

    void CapacitorApp.addListener("backButton", () => {
      if (location.pathname === "/login") {
        CapacitorApp.exitApp();
        return;
      }

      if (location.pathname === "/register") {
        navigate("/login", { replace: true });
        return;
      }

      if (location.pathname === "/dashboard") {
        CapacitorApp.exitApp();
        return;
      }

      navigate("/dashboard", { replace: true });
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      if (listener) {
        void listener.remove();
      }
    };
  }, [location.pathname, navigate]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <HardwareBackHandler />
      <Toaster richColors position="top-center" />
      <div className="size-full min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/" element={<SplashScreen />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><><Dashboard /><BottomNav /></></ProtectedRoute>} />
          <Route path="/devices" element={<ProtectedRoute><><DevicesPage /><BottomNav /></></ProtectedRoute>} />
          <Route path="/devices/add" element={<ProtectedRoute><AddDevicePage /></ProtectedRoute>} />
          <Route path="/devices/:id" element={<ProtectedRoute><DeviceDetailPage /></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><><ActivityPage /><BottomNav /></></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/settings/ringtone" element={<ProtectedRoute><RingtonePage /></ProtectedRoute>} />
          <Route path="/settings/vibration" element={<ProtectedRoute><VibrationPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><><ProfilePage /><BottomNav /></></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}