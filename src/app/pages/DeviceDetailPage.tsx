import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Clock, Trash2, Shield, Wifi, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { useFirebaseDevices } from "../../hooks/useFirebaseDevices";
import { removeDevice, setDevicePowered } from "../../services/deviceService";
import { recordUserActivity } from "../../services/activityHistoryService";
import { usePullToRefresh, PullIndicator, SafeTopSpacer } from "../../hooks/usePullToRefresh";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parseTimeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// ── Reusable toggle ────────────────────────────────────────────────────────
function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${
        value ? "bg-primary" : "bg-muted"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      role="switch"
      aria-checked={value}
    >
      <motion.div
        animate={{ x: value ? 24 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow-md ${
          disabled ? "animate-pulse" : ""
        }`}
      />
    </button>
  );
}

export function DeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deviceMap, loading } = useFirebaseDevices();

  const [pushNotification, setPushNotification] = useState(true);
  const [silentMode, setSilentMode] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [startTime, setStartTime] = useState("22:00");
  const [stopTime, setStopTime] = useState("06:00");
  const [selectedDays, setSelectedDays] = useState([
    true, true, true, true, true, false, false,
  ]);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isRemoving, setIsRemoving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isTogglingPower, setIsTogglingPower] = useState(false);

  // ── Clock tick ────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setInterval(
      () => setCurrentTime(new Date()),
      60_000
    );
    return () => window.clearInterval(timer);
  }, []);

  const device = id ? deviceMap[id] : undefined;
  const isMonitoringEnabled =
    device?.monitoring !== false && device?.laserOn !== false;

  // ── Pull-to-refresh ────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    await new Promise((res) => setTimeout(res, 800));
  }, []);

  const { refreshing, pullDistance, threshold, touchHandlers } =
    usePullToRefresh(handleRefresh);

  // ── Toggle monitoring ─────────────────────────────────────────────────
  const handleToggleMonitoring = async () => {
    if (!device || isTogglingPower || scheduleEnabled) return;
    setIsTogglingPower(true);
    try {
      const next = !isMonitoringEnabled;
      await setDevicePowered(device.id, next);
      recordUserActivity({
        title: next ? "Device turned on" : "Device turned off",
        device: device.name,
        severity: next ? "success" : "warning",
      });
    } catch (error) {
      console.error("Failed to toggle monitoring:", error);
    } finally {
      setIsTogglingPower(false);
    }
  };

  // ── Remove device ─────────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!device) return;
    setIsRemoving(true);
    try {
      await removeDevice(device.id);
      navigate("/devices");
    } catch (error) {
      console.error("Failed to remove device:", error);
    } finally {
      setIsRemoving(false);
      setShowConfirm(false);
    }
  };

  // ── Schedule logic ────────────────────────────────────────────────────
  const currentMinutes =
    currentTime.getHours() * 60 + currentTime.getMinutes();
  const currentDay = currentTime.getDay();
  const previousDay = (currentDay + 6) % 7;
  const startMinutes = parseTimeToMinutes(startTime);
  const stopMinutes = parseTimeToMinutes(stopTime);
  const sameDayWindow = startMinutes <= stopMinutes;
  const scheduleDaySelected =
    selectedDays[currentDay] || selectedDays[previousDay];
  const isScheduleActive = scheduleEnabled
    ? sameDayWindow
      ? selectedDays[currentDay] &&
        currentMinutes >= startMinutes &&
        currentMinutes < stopMinutes
      : (selectedDays[currentDay] && currentMinutes >= startMinutes) ||
        (selectedDays[previousDay] && currentMinutes < stopMinutes)
    : false;
  const effectiveMonitoringEnabled = scheduleEnabled
    ? isScheduleActive
    : isMonitoringEnabled;
  const scheduleStatusLabel = !scheduleEnabled
    ? "Manual mode"
    : isScheduleActive
    ? "Active now"
    : scheduleDaySelected
    ? "Waiting for time window"
    : "Waiting for selected day";

  // ── Loading / not found ───────────────────────────────────────────────
  if (loading && !device) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center text-muted-foreground">
        Connecting to Firebase...
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center text-muted-foreground">
        Device not found in Firebase.
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh bg-background pb-28 sm:pb-32"
      {...touchHandlers}
    >
      {/* Status bar spacer */}
      <SafeTopSpacer />

      <PullIndicator
        pullDistance={pullDistance}
        refreshing={refreshing}
        threshold={threshold}
      />

      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="pt-4 pb-6 space-y-6 lg:space-y-8">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <button
              onClick={() => navigate("/devices")}
              className="p-2 hover:bg-accent rounded-xl transition-colors self-start"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl truncate">{device.name}</h1>
              <p className="text-sm text-muted-foreground break-words">
                {device.location}
              </p>
            </div>
            <div
              className={`px-3 py-1.5 rounded-lg text-sm self-start shrink-0 ${
                device.status === "offline"
                  ? "bg-status-offline/20 text-status-offline"
                  : "bg-status-safe/20 text-status-safe"
              }`}
            >
              {device.status === "online" ? (
                <div className="flex items-center gap-1.5">
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-status-safe"
                  />
                  ONLINE
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <WifiOff className="w-4 h-4" />
                  OFFLINE
                </div>
              )}
            </div>
          </div>

          {/* ── Device Status Card ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-4 sm:p-6 ${
              device.status === "offline"
                ? "bg-status-warning/10 border-status-warning/30"
                : effectiveMonitoringEnabled
                ? "bg-status-safe/5 border-status-safe/30"
                : "bg-card border-border"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                  device.status === "offline"
                    ? "bg-status-offline/20"
                    : effectiveMonitoringEnabled
                    ? "bg-status-safe/20"
                    : "bg-muted"
                }`}
              >
                {device.status === "offline" ? (
                  <WifiOff className="w-7 h-7 text-status-offline" />
                ) : (
                  <Shield
                    className={`w-7 h-7 ${
                      effectiveMonitoringEnabled
                        ? "text-status-safe"
                        : "text-muted-foreground"
                    }`}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-medium">
                  {device.status === "offline"
                    ? "Device Offline"
                    : effectiveMonitoringEnabled
                    ? "Monitoring Active"
                    : "Monitoring Inactive"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {device.info?.device_type ?? device.deviceType ?? device.name}
                </p>
              </div>
              {device.status === "online" && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                  <Wifi className="w-4 h-4 text-status-safe" />
                  <span>
                    {Math.max(0, Math.min(100, 100 + (device.rssi ?? -90)))}%
                  </span>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Device Controls ────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
            <h3 className="text-lg mb-4">Device Controls</h3>
            <div className="space-y-5">
              {/* Monitoring */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p>Monitoring</p>
                  <p className="text-sm text-muted-foreground">
                    {scheduleEnabled
                      ? "Controlled by schedule"
                      : isTogglingPower
                      ? "Updating Firebase..."
                      : effectiveMonitoringEnabled
                      ? "Laser & detection active"
                      : "Laser & detection off"}
                  </p>
                </div>
                <Toggle
                  value={effectiveMonitoringEnabled}
                  onChange={handleToggleMonitoring}
                  disabled={scheduleEnabled || isTogglingPower}
                />
              </div>

              <div className="h-px bg-border" />

              {/* Push Notification */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p>Push Notification</p>
                  <p className="text-sm text-muted-foreground">
                    Get alerts on your phone
                  </p>
                </div>
                <Toggle
                  value={pushNotification}
                  onChange={() => setPushNotification((v) => !v)}
                />
              </div>

              <div className="h-px bg-border" />

              {/* Silent Mode */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p>Silent Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Disable sound alerts
                  </p>
                </div>
                <Toggle
                  value={silentMode}
                  onChange={() => setSilentMode((v) => !v)}
                />
              </div>
            </div>
          </div>

          {/* ── Schedule Automation ────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="text-lg">Schedule Automation</h3>
              </div>
              <Toggle
                value={scheduleEnabled}
                onChange={() => setScheduleEnabled((v) => !v)}
              />
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Set when monitoring should run and pause automatically.
            </p>

            <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3 mb-4 gap-4">
              <span className="text-sm text-muted-foreground">
                Automation status
              </span>
              <span
                className={`text-sm text-right ${
                  isScheduleActive ? "text-status-safe" : "text-muted-foreground"
                }`}
              >
                {scheduleStatusLabel}
              </span>
            </div>

            {scheduleEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-4 pt-4 border-t border-border overflow-hidden"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground block">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-background/80 text-foreground border border-border rounded-xl px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground block">
                      Stop Time
                    </label>
                    <input
                      type="time"
                      value={stopTime}
                      onChange={(e) => setStopTime(e.target.value)}
                      className="w-full bg-background/80 text-foreground border border-border rounded-xl px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-3 block">
                    Repeat Days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {dayLabels.map((day, index) => (
                      <button
                        key={`${day}-${index}`}
                        type="button"
                        onClick={() =>
                          setSelectedDays((cur) =>
                            cur.map((s, i) => (i === index ? !s : s))
                          )
                        }
                        className={`w-12 h-10 rounded-xl border transition-colors text-sm ${
                          selectedDays[index]
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background/80 text-foreground border-border hover:bg-accent"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Remove Device ──────────────────────────────────────────── */}
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full bg-destructive/10 text-destructive border border-destructive/30 py-3 rounded-xl hover:bg-destructive/20 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Remove Device
            </button>
          ) : (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-3">
              <p className="text-center text-sm text-destructive">
                Remove <strong>{device.name}</strong>? This cannot be undone.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border hover:bg-accent transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className="flex-1 py-2.5 rounded-xl bg-destructive text-white hover:bg-destructive/90 transition-all text-sm disabled:opacity-70"
                >
                  {isRemoving ? "Removing..." : "Yes, Remove"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}