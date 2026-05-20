import { useEffect, useMemo, useState } from "react";
import { Home, Shield, Activity, User, Power } from "lucide-react";
import { NavLink } from "react-router";
import { useFirebaseDevices } from "../../hooks/useFirebaseDevices";
import { setAllDevicesPowered } from "../../services/deviceService";
import { recordUserActivity } from "../../services/activityHistoryService";
import { OFFLINE_TIMEOUT_MS } from "../../hooks/useDeviceAlive";

const suppressAlertKey = "secureSense:suppressAlertsUntil";
const suppressAlertWindowMs = 6000;

const navItems = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: Shield, label: "Devices", path: "/devices" },
  { icon: Activity, label: "Activity", path: "/activity" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function BottomNav() {
  const { devices } = useFirebaseDevices();
  const [isUpdatingPower, setIsUpdatingPower] = useState(false);

  // ── Ticker 1 detik untuk re-evaluasi lastSeen ──────────────────────────
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // ── Apakah semua device masih kirim heartbeat dalam 30 detik? ──────────
  const hasDeadDevice = useMemo(
    () => devices.some((d) => now - (d.lastSeen ?? 0) >= OFFLINE_TIMEOUT_MS),
    [devices, now]
  );

  // ── Status power (hanya dari config Firebase, bukan lastSeen) ──────────
  const isPowerEnabled = useMemo(
    () =>
      devices.length > 0 &&
      devices.every((d) => d.monitoring !== false && d.laserOn !== false),
    [devices]
  );

  const toggleAllDevices = async () => {
  if (devices.length === 0 || isUpdatingPower || hasDeadDevice) return;
  setIsUpdatingPower(true);

    try {
      // ✅ Set suppress DULU sebelum Firebase update
      try {
        window.localStorage.setItem(
          suppressAlertKey,
          String(Date.now() + suppressAlertWindowMs)
        );
      } catch { /* ignore */ }

      await setAllDevicesPowered(!isPowerEnabled, devices);

      recordUserActivity({
        title: isPowerEnabled ? "Turned devices off" : "Turned devices on",
        device: "All devices",
        severity: isPowerEnabled ? "warning" : "success",
      });
    } finally {
      setIsUpdatingPower(false);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-md mx-auto px-6 pb-4 pt-3 relative pointer-events-auto">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[8%] z-10">
          <button
            onClick={toggleAllDevices}
            disabled={isUpdatingPower || hasDeadDevice}
            className={`w-14 h-14 rounded-full border shadow-lg flex items-center justify-center transition-all ${
              isPowerEnabled
                ? "bg-primary text-primary-foreground border-primary/40 shadow-primary/30"
                : "bg-card text-foreground border-border shadow-muted/20"
            } ${isUpdatingPower ? "scale-95 opacity-80" : "hover:scale-105"}`}
            aria-label="Toggle all devices"
          >
            <Power className={`w-6 h-6 ${isUpdatingPower ? "animate-pulse" : ""}`} />
          </button>
        </div>

        <div className="bg-card/85 backdrop-blur-xl border border-border/80 rounded-[1.75rem] px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all flex-1 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`relative ${isActive ? "scale-110" : ""}`}>
                    <item.icon className="w-6 h-6" />
                    {isActive && (
                      <div className="absolute inset-0 bg-primary/30 blur-lg rounded-full" />
                    )}
                  </div>
                  <span className="text-xs">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
