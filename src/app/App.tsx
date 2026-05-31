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
import { 
    requestNotificationPermission, 
    showAlarmNotification, 
    setupNotificationChannels, 
    cancelAllNotifications 
} from "../services/notificationService";
import { 
    registerFCMToken, 
    setupForegroundMessaging 
} from "../services/fcmService";
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

let globalAudio: HTMLAudioElement | null = null;
let globalAudioCtx: AudioContext | null = null;

const stopGlobalAudio = () => {
  if (globalAudio) {
    globalAudio.pause();
    globalAudio.currentTime = 0;
    globalAudio = null;
  }
  if (globalAudioCtx) {
    void globalAudioCtx.close();
    globalAudioCtx = null;
  }
};

function AlarmToastBridge() {
  const { devices } = useFirebaseDevices();
  const { activities } = useFirebaseActivity(devices);
  const { preferences, loading: preferencesLoading } = useUserAlertPreferences();
  const deviceById = useMemo(
    () => devices.reduce<Record<string, typeof devices[number]>>((accumulator, device) => {
      accumulator[device.id] = device;
      return accumulator;
    }, {}),
    [devices]
  );

  const seenActivityIds = useRef<Set<string>>(new Set());
  const isDismissed = useRef<Set<string>>(new Set());
  const notificationReady = useRef<boolean>(false);
  const sessionStart = useRef(Date.now());
  const vibrationTimer = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeAlarmRef = useRef<AlarmState | null>(null);
  const isAlarmActive = useRef<boolean>(false);
  const [activeAlarm, setActiveAlarm] = useState<AlarmState | null>(null);

  // ── Sync ref dengan state ──────────────────────────────────────────────
  useEffect(() => {
    activeAlarmRef.current = activeAlarm;
  }, [activeAlarm]);

  // ── triggerAlarm ───────────────────────────────────────────────────────
  const triggerAlarm = useCallback((alarm: AlarmState) => {
    if (activeAlarmRef.current?.deviceId === alarm.deviceId) {
      seenActivityIds.current.add(alarm.id);
      isDismissed.current.add(alarm.id);
      return;
    }
    if (isDismissed.current.has(alarm.id)) return;
    setActiveAlarm(alarm);
  }, []);

  // ── stopAudio ──────────────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  // ── stopVibration ──────────────────────────────────────────────────────
  const stopVibration = useCallback(() => {
    if (vibrationTimer.current) {
      window.clearInterval(vibrationTimer.current);
      vibrationTimer.current = null;
    }
  }, []);

  // ── startVibration ─────────────────────────────────────────────────────
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

  // ── blockedAlarm ───────────────────────────────────────────────────────
  const blockedAlarm = useMemo(() => {
    const blockedActivities = activities.filter((activity) => {
      const isBlockedSensor = activity.type === "sensor" && activity.title.toLowerCase().includes("blocked");
      const isCriticalAlert = activity.type === "alert" && activity.severity === "critical";
      const isRecent = activity.timestamp >= sessionStart.current;
      return (isBlockedSensor || isCriticalAlert) && isRecent;
    });
    return blockedActivities[0] ?? null;
  }, [activities]);

  // ── useEffect 1: permission ────────────────────────────────────────────
  useEffect(() => {
    const ensurePermission = async () => {
      if (notificationReady.current) return;
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

  // ── useEffect 2: activities ────────────────────────────────────────────
  useEffect(() => {
    const nextSeenIds = new Set(seenActivityIds.current);

    activities.forEach((activity) => {
      const isBlockedSensor = activity.type === "sensor" && activity.title.toLowerCase().includes("blocked");
      const isCriticalAlert = activity.type === "alert" && activity.severity === "critical";
      const isRecent = activity.timestamp >= sessionStart.current;

      if ((!isBlockedSensor && !isCriticalAlert) || !isRecent) return;
      if (nextSeenIds.has(activity.id)) return;
      if (isDismissed.current.has(activity.id)) return;

      nextSeenIds.add(activity.id);

      const deviceConfig = activity.deviceId ? deviceById[activity.deviceId]?.config : undefined;
      const suppressUntilFromDevice = deviceConfig?.suppressAlertsUntil ?? 0;
      const notificationsEnabled = deviceConfig?.notifications?.enabled !== false;

      let suppressUntil = 0;
      try {
        suppressUntil = Number(window.localStorage.getItem(suppressAlertKey)) || 0;
      } catch { suppressUntil = 0; }

      if (Date.now() < suppressUntil || Date.now() < suppressUntilFromDevice) return;

      toast.error(activity.title, {
        description: `${activity.device} • ${activity.time}`,
      });

      //if (preferences.pushNotifications && notificationsEnabled) {
        //void showAlarmNotification(activity.title, `${activity.device} • ${activity.time}`, {
          //sound: preferences.soundEnabled,
        //});
      //}

      triggerAlarm({
        id: activity.id,
        title: activity.title,
        device: activity.device,
        deviceId: activity.deviceId,
        notificationsEnabled,
        time: activity.time,
        severity: activity.severity,
        description: activity.type === "sensor"
          ? "Laser sensor was blocked. Immediate attention is required."
          : "Critical intrusion alert was received from this device.",
      });
    });

    seenActivityIds.current = nextSeenIds;
  }, [activities, deviceById, preferences, triggerAlarm]);

  // ── useEffect 3: blockedAlarm ──────────────────────────────────────────
  useEffect(() => {
    if (!blockedAlarm) return;
    if (isDismissed.current.has(blockedAlarm.id)) return;
    if (seenActivityIds.current.has(blockedAlarm.id)) return;

    let suppressUntil = 0;
    try {
      suppressUntil = Number(window.localStorage.getItem(suppressAlertKey)) || 0;
    } catch { suppressUntil = 0; }

    if (Date.now() < suppressUntil) {
      seenActivityIds.current.add(blockedAlarm.id);
      return;
    }

    const deviceConfig = blockedAlarm.deviceId ? deviceById[blockedAlarm.deviceId]?.config : undefined;
    const suppressUntilFromDevice = deviceConfig?.suppressAlertsUntil ?? 0;
    const notificationsEnabled = deviceConfig?.notifications?.enabled !== false;

    if (Date.now() < suppressUntilFromDevice) {
      seenActivityIds.current.add(blockedAlarm.id);
      return;
    }

    triggerAlarm({
      id: blockedAlarm.id,
      title: blockedAlarm.title,
      device: blockedAlarm.device,
      deviceId: blockedAlarm.deviceId,
      notificationsEnabled,
      time: blockedAlarm.time,
      severity: blockedAlarm.severity,
      description: blockedAlarm.type === "sensor"
        ? "Laser sensor was blocked. Immediate attention is required."
        : "Critical intrusion alert was received from this device.",
    });
  }, [blockedAlarm, deviceById, triggerAlarm]);

  // ── useEffect 4: audio ─────────────────────────────────────────────────
  useEffect(() => {
    stopVibration();
    stopGlobalAudio();

    if (!activeAlarm || preferencesLoading) {
      isAlarmActive.current = false;
      return;
    }

    isAlarmActive.current = true;

    if (preferences.vibrationMode && activeAlarm.notificationsEnabled) {
      startVibration(preferences.vibrationMode);
    }

    if (preferences.soundEnabled && activeAlarm.notificationsEnabled) {
      const ringtone = preferences.ringtone;

      if (ringtone.type === "custom" && ringtone.customDataUrl) {
        const audio = new Audio(ringtone.customDataUrl);
        audio.loop = true;
        globalAudio = audio;
        void audio.play().then(() => {
          if (!isAlarmActive.current) stopGlobalAudio();
        }).catch(() => undefined);

      } else {
        const presetId =
          ringtone.name === "Siren" ? "siren"
          : ringtone.name === "Beacon" ? "beacon"
          : "default";

        const audio = new Audio(`/sounds/${presetId}.mp3`);
        audio.loop = true;
        globalAudio = audio;
        void audio.play().then(() => {
          if (!isAlarmActive.current) stopGlobalAudio();
        }).catch(() => {
          globalAudio = null;
          if (isAlarmActive.current) {
            const ctx = new AudioContext();
            globalAudioCtx = ctx;
            playPresetLoop(presetId, { current: ctx });
          }
        });
      }
    }

    return () => {
      isAlarmActive.current = false;
      stopVibration();
      stopGlobalAudio();
    };
  }, [activeAlarm, preferencesLoading, preferences.ringtone, preferences.soundEnabled, preferences.vibrationMode, startVibration, stopVibration]);

  // ── dismissAlarm ───────────────────────────────────────────────────────
  const dismissAlarm = () => {
    isAlarmActive.current = false;
    stopGlobalAudio();

    if (activeAlarm) {
      seenActivityIds.current.add(activeAlarm.id);
      isDismissed.current.add(activeAlarm.id);
      activities.forEach((activity) => {
        if (activity.deviceId === activeAlarm.deviceId) {
          isDismissed.current.add(activity.id);
          seenActivityIds.current.add(activity.id);
        }
      });
      try {
        const suppressUntil = Date.now() + 30_000;
        window.localStorage.setItem(suppressAlertKey, String(suppressUntil));
      } catch { /* ignore */ }
    }

    stopVibration();
    void cancelAllNotifications();
    setActiveAlarm(null);
  };

  // ── JSX ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={Boolean(activeAlarm)} onOpenChange={(open) => !open && dismissAlarm()}>
      <DialogContent className="inset-0 top-0 left-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 bg-[#09090b] text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.38),transparent_45%),linear-gradient(180deg,rgba(127,29,29,0.92),rgba(9,9,11,0.98))]" />
        <div
          className="relative z-10 flex h-full flex-col items-center justify-between p-6 sm:p-10 text-center overflow-y-auto"
          style={{
            paddingTop: "max(env(safe-area-inset-top, 0px), 2.5rem)",
            paddingBottom: "max(env(safe-area-inset-bottom, 0px), 2.5rem)",
          }}
        >
          <div className="flex-1" />
          <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
            <DialogHeader className="text-center space-y-4 w-full">
              <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_0_50px_rgba(239,68,68,0.35)] backdrop-blur mx-auto">
                <ShieldAlert className="h-7 w-7 sm:h-8 sm:w-8 text-red-300" />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <DialogTitle className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
                  ALARM LASER TERBLOCKED
                </DialogTitle>
                <DialogDescription className="text-sm sm:text-lg text-white/80 max-w-xl mx-auto">
                  {activeAlarm?.description ?? "Laser sensor was blocked. Immediate attention is required."}
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full">
              <div className="rounded-2xl border border-white/10 bg-white/8 p-3 sm:p-5 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 sm:mb-2">Device</p>
                <p className="text-sm sm:text-lg font-medium truncate">{activeAlarm?.device ?? "Unknown"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 p-3 sm:p-5 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 sm:mb-2">Event</p>
                <p className="text-sm sm:text-lg font-medium flex items-center justify-center gap-1 sm:gap-2">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-300 shrink-0" />
                  <span className="truncate">{activeAlarm?.title ?? "Blocked"}</span>
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 p-3 sm:p-5 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 sm:mb-2">Time</p>
                <p className="text-sm sm:text-lg font-medium">{activeAlarm?.time ?? "Just now"}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:gap-4 w-full items-center">
              <div className="flex items-center gap-2 text-white/80 justify-center text-sm sm:text-base">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-red-300 shrink-0" />
                <span>Toast, notification, and full-screen alarm are active.</span>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={dismissAlarm}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 sm:px-5 py-3 font-medium text-white transition hover:bg-red-400 text-sm sm:text-base"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  Close
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FCMRegistrar() {
    const { user } = useFirebaseAuth();

    useEffect(() => {
        void setupNotificationChannels();
    }, []);

    useEffect(() => {
        if (!user?.uid) return;
        if (!Capacitor.isNativePlatform()) return;

        let subscription: Awaited<ReturnType<typeof CapacitorApp.addListener>> | null = null;

        const setupListener = async () => {
            subscription = await CapacitorApp.addListener("appStateChange", async ({ isActive }) => {
                if (!isActive) return;
                try {
                    const granted = await requestNotificationPermission();
                    if (granted) {
                        void registerFCMToken(user.uid);
                    }
                } catch (error) {
                    console.debug("Securo notification permission recheck failed:", error);
                }
            });
        };

        void setupListener();

        return () => {
            if (subscription) {
                void subscription.remove();
            }
        };
    }, [user?.uid]);

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
        CapacitorApp.minimizeApp();
        return;
      }

      if (location.pathname === "/register") {
        navigate("/login", { replace: true });
        return;
      }

      if (location.pathname === "/dashboard") {
        CapacitorApp.minimizeApp();
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

function SWNavigateHandler() {
    const navigate = useNavigate();

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === "NAVIGATE" && event.data?.url) {
                navigate(event.data.url);
            }
        };
        navigator.serviceWorker?.addEventListener("message", handleMessage);
        return () => navigator.serviceWorker?.removeEventListener("message", handleMessage);
    }, [navigate]);

    return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <HardwareBackHandler />
      <SWNavigateHandler />
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
