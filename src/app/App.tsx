import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { toast } from "sonner";
import { AlertTriangle, Bell, CircleCheckBig, ShieldAlert, X } from "lucide-react";
import { Haptics } from "@capacitor/haptics";
import { SplashScreen } from "./pages/SplashScreen";
import { OnboardingScreen } from "./pages/OnboardingScreen";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { Dashboard } from "./pages/Dashboard";
import { DevicesPage } from "./pages/DevicesPage";
import { AddDevicePage } from "./pages/AddDevicePage";
import { DeviceDetailPage } from "./pages/DeviceDetailPage";
import { ActivityPage } from "./pages/ActivityPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage } from "./pages/ProfilePage";
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

const preferenceStorageKey = "secureSense:preferences";

const loadPreferences = () => {
  if (typeof window === "undefined") {
    return { sound: true, vibration: true, pushNotifications: true };
  }

  try {
    const raw = window.localStorage.getItem(preferenceStorageKey);
    if (!raw) {
      return { sound: true, vibration: true, pushNotifications: true };
    }
    const parsed = JSON.parse(raw) as Partial<{
      sound: boolean;
      vibration: boolean;
      pushNotifications: boolean;
    }>;
    return {
      sound: parsed.sound ?? true,
      vibration: parsed.vibration ?? true,
      pushNotifications: parsed.pushNotifications ?? true,
    };
  } catch {
    return { sound: true, vibration: true, pushNotifications: true };
  }
};

type AlarmState = {
  id: string;
  title: string;
  device: string;
  time: string;
  severity: ActivityItem["severity"];
  description: string;
};

function AlarmToastBridge() {
  const { devices } = useFirebaseDevices();
  const { activities } = useFirebaseActivity(devices);
  const seenActivityIds = useRef<Set<string>>(new Set());
  const notificationReady = useRef<boolean>(false);
  const [activeAlarm, setActiveAlarm] = useState<AlarmState | null>(null);

  const blockedAlarm = useMemo(() => {
    const blockedActivities = activities.filter((activity) => {
      const isBlockedSensor = activity.type === "sensor" && activity.title.toLowerCase().includes("blocked");
      const isCriticalAlert = activity.type === "alert" && activity.severity === "critical";

      return isBlockedSensor || isCriticalAlert;
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

    void ensurePermission();
  }, []);

  useEffect(() => {
    const nextSeenIds = new Set(seenActivityIds.current);

    activities.forEach((activity) => {
      const isBlockedSensor = activity.type === "sensor" && activity.title.toLowerCase().includes("blocked");
      const isCriticalAlert = activity.type === "alert" && activity.severity === "critical";

      if (!isBlockedSensor && !isCriticalAlert) {
        return;
      }

      if (nextSeenIds.has(activity.id)) {
        return;
      }

      nextSeenIds.add(activity.id);

      toast.error(activity.title, {
        description: `${activity.device} • ${activity.time}`,
      });

      const preferences = loadPreferences();
      if (preferences.pushNotifications) {
        void showAlarmNotification(activity.title, `${activity.device} • ${activity.time}`, {
          sound: preferences.sound,
        });
      }

      if (preferences.vibration) {
        void Haptics.vibrate({ duration: 300 });
      }

      setActiveAlarm((currentAlarm) => {
        if (currentAlarm?.id === activity.id) {
          return currentAlarm;
        }

        return {
          id: activity.id,
          title: activity.title,
          device: activity.device,
          time: activity.time,
          severity: activity.severity,
          description:
            activity.type === "sensor"
              ? "Laser sensor was blocked. Immediate attention is required."
              : "Critical intrusion alert was received from Firebase.",
        };
      });
    });

    seenActivityIds.current = nextSeenIds;
  }, [activities]);

  useEffect(() => {
    if (!blockedAlarm) {
      return;
    }

    if (seenActivityIds.current.has(blockedAlarm.id)) {
      return;
    }

    setActiveAlarm((currentAlarm) => {
      if (currentAlarm?.id === blockedAlarm.id) {
        return currentAlarm;
      }

      return {
        id: blockedAlarm.id,
        title: blockedAlarm.title,
        device: blockedAlarm.device,
        time: blockedAlarm.time,
        severity: blockedAlarm.severity,
        description:
          blockedAlarm.type === "sensor"
            ? "Laser sensor was blocked. Immediate attention is required."
            : "Critical intrusion alert was received from Firebase.",
      };
    });
  }, [blockedAlarm]);

  const dismissAlarm = () => {
    if (activeAlarm) {
      seenActivityIds.current.add(activeAlarm.id);
    }

    setActiveAlarm(null);
  };

  return (
    <Dialog open={Boolean(activeAlarm)} onOpenChange={(open) => !open && dismissAlarm()}>
      <DialogContent className="h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 bg-[#09090b] text-white overflow-hidden">
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

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useFirebaseAuth();

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Checking Firebase auth...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <AlarmToastBridge />
      {children}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster richColors position="top-center" />
      <div className="size-full min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/" element={<SplashScreen />} />
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><><Dashboard /><BottomNav /></></ProtectedRoute>} />
          <Route path="/devices" element={<ProtectedRoute><><DevicesPage /><BottomNav /></></ProtectedRoute>} />
          <Route path="/devices/add" element={<ProtectedRoute><AddDevicePage /></ProtectedRoute>} />
          <Route path="/devices/:id" element={<ProtectedRoute><DeviceDetailPage /></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><><ActivityPage /><BottomNav /></></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><><ProfilePage /><BottomNav /></></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}