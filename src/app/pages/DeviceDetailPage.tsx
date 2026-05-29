import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Clock, Trash2, Shield, Wifi, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { useFirebaseDevices } from "../../hooks/useFirebaseDevices";
import { recordUserActivity } from "../../services/activityHistoryService";
import { usePullToRefresh, PullIndicator, SafeTopSpacer } from "../../hooks/usePullToRefresh";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";
import { Device } from "../../types/device";
import { useDeviceAlive } from "../../hooks/useDeviceAlive";
import { removeDevice, setDevicePowered, updateDeviceNotificationPreference, updateDeviceSchedule, searchUserByEmail, shareDeviceWithUser, removeSharedUser, getUserByUid } from "../../services/deviceService";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const defaultDays = [true, true, true, true, true, false, false];

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
  const [selectedDays, setSelectedDays] = useState(defaultDays);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isRemoving, setIsRemoving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isTogglingPower, setIsTogglingPower] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  const [sharedUserDetails, setSharedUserDetails] = useState<Record<string, { email: string; displayName: string | null }>>({});

  // ── Clock tick ────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setInterval(
      () => setCurrentTime(new Date()),
      60_000
    );
    return () => window.clearInterval(timer);
  }, []);

  const { user } = useFirebaseAuth();

  const device = id ? deviceMap[id] : undefined;
  const isAlive = useDeviceAlive(device);

  const deviceOwner =
  (device as (Device & { owner?: string }) | undefined)?.ownerId ||
  (device as (Device & { owner?: string }) | undefined)?.owner;

  const isOwner = device
  ? !deviceOwner || deviceOwner === user?.uid
  : true;

  const isSharedUser = device
  ? (device.sharedWith ?? []).includes(user?.uid ?? "")
  : false;

  useEffect(() => {
  if (!loading && device && !isOwner && !isSharedUser) {
    navigate("/devices");
  }
}, [loading, device, isOwner, isSharedUser, navigate]);

  const isMonitoringEnabled =
  (device?.monitoring ?? device?.config?.monitoring) !== false &&
  (device?.laser_on ?? device?.laserOn ?? device?.config?.laser_on) !== false;

  const effectiveOnline = isAlive;
  const isOfflineByTimeout = device !== undefined && !isAlive;
  
  const deviceNotificationEnabled = device?.config?.notifications?.enabled;

  useEffect(() => {
    if (!device?.schedule) {
      return;
    }

    setScheduleEnabled(device.schedule.enabled ?? false);
    setStartTime(device.schedule.start ?? "22:00");
    setStopTime(device.schedule.stop ?? "06:00");
    setSelectedDays(device.schedule.days ?? defaultDays);
  }, [device?.schedule]);

  useEffect(() => {
    if (deviceNotificationEnabled === undefined) {
      setPushNotification(true);
      return;
    }

    setPushNotification(deviceNotificationEnabled);
  }, [deviceNotificationEnabled]);

  useEffect(() => {
  const sharedWith = device?.sharedWith ?? [];
  if (sharedWith.length === 0) {
    setSharedUserDetails({});
    return;
  }

  const fetchUsers = async () => {
    const results = await Promise.all(
      sharedWith.map((uid) => getUserByUid(uid))
    );

    const details: Record<string, { email: string; displayName: string | null }> = {};
    results.forEach((userData, index) => {
      if (userData) {
        details[sharedWith[index]] = {
          email: userData.email,
          displayName: userData.displayName,
        };
      }
    });

    setSharedUserDetails(details);
  };

  void fetchUsers();
}, [device?.sharedWith]);

  const persistSchedule = useCallback(
    async (nextSchedule: {
      enabled: boolean;
      start: string;
      stop: string;
      days: boolean[];
    }) => {
      if (!device) {
        return;
      }

      try {
        await updateDeviceSchedule(device.id, nextSchedule);
      } catch (error) {
        console.error("Failed to update schedule:", error);
      }
    },
    [device]
  );

  // ── Pull-to-refresh ────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    await new Promise((res) => setTimeout(res, 800));
  }, []);

  const { refreshing, pullDistance, threshold, touchHandlers } =
    usePullToRefresh(handleRefresh);

  // ── Toggle device ─────────────────────────────────────────────────
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
      console.error("Failed to toggle device:", error);
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

  const handleShareDevice = async () => {
  if (!device || !shareEmail.trim()) return;
  setShareLoading(true);
  setShareError(null);
  setShareSuccess(null);

  try {
    const found = await searchUserByEmail(shareEmail);
    if (!found) {
      setShareError("User dengan email tersebut tidak ditemukan.");
      return;
    }
    if (found.uid === user?.uid) {
      setShareError("Tidak bisa berbagi device ke diri sendiri.");
      return;
    }
    await shareDeviceWithUser(device.id, found.uid);
    setShareSuccess(`Akses diberikan ke ${found.email}.`);
    setShareEmail("");
  } catch (error) {
    setShareError(
      error instanceof Error ? error.message : "Gagal memberikan akses."
    );
  } finally {
    setShareLoading(false);
  }
};

const handleRemoveSharedUser = async (targetUid: string) => {
  if (!device) return;
  setRemovingUid(targetUid);
  try {
    await removeSharedUser(device.id, targetUid);
  } catch (error) {
    console.error("Failed to remove shared user:", error);
  } finally {
    setRemovingUid(null);
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
  const effectiveMonitoringEnabled =
  (scheduleEnabled ? isScheduleActive : isMonitoringEnabled) && isAlive;

  const scheduleStatusLabel = !scheduleEnabled
    ? "Manual mode"
    : isScheduleActive
    ? "Active now"
    : scheduleDaySelected
    ? "Waiting for time window"
    : "Waiting for selected day";


  console.log("DEBUG:", {
  monitoring: device?.monitoring,
  config_monitoring: device?.config?.monitoring,
  laser_on: device?.laser_on,
  laserOn: device?.laserOn,
  config_laser_on: device?.config?.laser_on,
  isMonitoringEnabled,
  effectiveMonitoringEnabled,
});
  // ── Loading / not found ───────────────────────────────────────────────
  if (loading && !device) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center text-muted-foreground">
        Connecting...
      </div>
    );
  }

  if (!device || (!isOwner && !isSharedUser)) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center text-muted-foreground">
        Device not found.
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
              className={`px-3 py-1.5 rounded-lg border text-sm self-start shrink-0 ${
              !effectiveOnline
                ? isOfflineByTimeout
                    ? "bg-muted/40 text-muted-foreground"        // NO SIGNAL → abu
                  : "bg-status-offline/20 text-status-warning"  // OFFLINE → kuning
                : effectiveMonitoringEnabled
                ? "bg-status-safe/20 text-status-safe"          // ONLINE → hijau
                : "bg-status-warning/20 text-status-warning"    // INACTIVE → kuning
              }`}
            >
              {effectiveOnline ? (
                <div className="flex items-center gap-1.5">
                  <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`w-2 h-2 rounded-full ${
                      effectiveMonitoringEnabled
                          ? "bg-status-safe"
                          : "bg-status-warning"
                  }`}
                />
                  {effectiveMonitoringEnabled ? "ONLINE" : "OFFLINE"}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <WifiOff className="w-4 h-4" />
                    {isOfflineByTimeout ? "NO SIGNAL" : "OFFLINE"}
                </div>
              )}
            </div>
          </div>

          {/* ── Device Status Card ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-4 sm:p-6 transition-colors duration-300 ${
              !effectiveOnline && isOfflineByTimeout
              ? "bg-muted/30 border-muted-foreground/20"         // NO SIGNAL — abu
              : !effectiveOnline
              ? "bg-status-offline/10 border-status-warning/30"  // OFFLINE — kuning
              : effectiveMonitoringEnabled
              ? "bg-status-safe/5 border-status-safe/30"         // ON — hijau
              : "bg-card border-border"                          // OFF — default
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                  !effectiveOnline
                    ? "bg-status-offline/20"
                    : effectiveMonitoringEnabled
                    ? "bg-status-safe/20"
                    : "bg-muted"
                }`}
              >
                {!effectiveOnline ? (
                <WifiOff className={`w-7 h-7 ${
                  isOfflineByTimeout ? "text-muted-foreground" : "text-status-offline"
                }`} />
                ) : (
                <Shield className={`w-7 h-7 ${
                  effectiveMonitoringEnabled ? "text-status-safe" : "text-muted-foreground"
                }`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-medium">
                  {!effectiveOnline
                  ? isOfflineByTimeout ? "No Signal" : "Device Offline"
                  : effectiveMonitoringEnabled
                  ? "Device Active"
                  : "Device Inactive"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {device.info?.device_type ?? device.deviceType ?? device.name}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
              {!effectiveOnline ? (
                <Wifi className="w-4 h-4 text-muted-foreground opacity-30" />
                ) : (
                <Wifi className="w-4 h-4 text-status-safe" />
                )}
                <span className={!effectiveOnline ? "opacity-30" : ""}>
                  {Math.max(0, Math.min(100, 100 + (device.rssi ?? -90)))}%
                </span>
              </div>
            </div>
          </motion.div>

          {/* ── Device Controls ────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
            <h3 className="text-lg mb-4">Device Controls</h3>
            <div className="space-y-5">
              {/* Monitoring */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p>Device Status</p>
                  <p className="text-sm text-muted-foreground">
                    {isOfflineByTimeout
                      ? "No Signal"
                      : scheduleEnabled
                      ? "Controlled by schedule"
                      : isTogglingPower
                      ? "Updating..."
                      : effectiveMonitoringEnabled
                      ? "Laser & detection active"
                      : "Laser & detection off"}
                  </p>
                </div>
                <Toggle
                  value={effectiveMonitoringEnabled}
                  onChange={handleToggleMonitoring}
                  disabled={scheduleEnabled || isTogglingPower || isOfflineByTimeout}
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
                  onChange={() => {
                    const next = !pushNotification;
                    setPushNotification(next);
                    if (device) {
                      void updateDeviceNotificationPreference(device.id, next);
                    }
                  }}
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

          {/* ── Share Device ──────────────────────────────────────────────── */}
{isOwner && (
  <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
    <h3 className="text-lg mb-1">Share Device</h3>
    <p className="text-sm text-muted-foreground mb-4">
      Tambahkan user lain untuk mengakses device ini.
    </p>

    <div className="flex gap-2 mb-4">
      <input
        type="email"
        placeholder="Email user..."
        value={shareEmail}
        onChange={(e) => {
          setShareEmail(e.target.value);
          setShareError(null);
          setShareSuccess(null);
        }}
        className="flex-1 bg-background/80 text-foreground border border-border rounded-xl px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
      />
      <button
        onClick={handleShareDevice}
        disabled={shareLoading || !shareEmail.trim()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
      >
        {shareLoading ? "..." : "Tambah"}
      </button>
    </div>

    {shareError && (
      <p className="text-sm text-destructive mb-3">{shareError}</p>
    )}
    {shareSuccess && (
      <p className="text-sm text-status-safe mb-3">{shareSuccess}</p>
    )}

    {(device.sharedWith ?? []).length > 0 ? (
      <div className="space-y-0 divide-y divide-border border border-border rounded-xl overflow-hidden">
        {(device.sharedWith ?? []).map((uid) => {
          const userDetail = sharedUserDetails[uid];
          return (
            <div
              key={uid}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm truncate">
                  {userDetail?.displayName || userDetail?.email || uid}
                </p>
                {userDetail?.displayName && (
                  <p className="text-xs text-muted-foreground truncate">
                    {userDetail.email}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleRemoveSharedUser(uid)}
                disabled={removingUid === uid}
                className="text-sm text-destructive hover:text-destructive/80 transition-colors shrink-0 disabled:opacity-50"
              >
                {removingUid === uid ? "..." : "Hapus"}
              </button>
            </div>
          );
        })}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground text-center py-3 border border-border rounded-xl">
        Belum ada user yang ditambahkan.
      </p>
    )}
  </div>
)}


          {/* ── Schedule Automation ────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="text-lg">Schedule Automation</h3>
              </div>
              <Toggle
                value={scheduleEnabled}
                onChange={() => {
                  const next = !scheduleEnabled;
                  setScheduleEnabled(next);
                  void persistSchedule({
                    enabled: next,
                    start: startTime,
                    stop: stopTime,
                    days: selectedDays,
                  });
                }}
              />
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Set when device should run and pause automatically.
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
                      onChange={(e) => {
                        const next = e.target.value;
                        setStartTime(next);
                        void persistSchedule({
                          enabled: scheduleEnabled,
                          start: next,
                          stop: stopTime,
                          days: selectedDays,
                        });
                      }}
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
                      onChange={(e) => {
                        const next = e.target.value;
                        setStopTime(next);
                        void persistSchedule({
                          enabled: scheduleEnabled,
                          start: startTime,
                          stop: next,
                          days: selectedDays,
                        });
                      }}
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
                          setSelectedDays((cur) => {
                            const next = cur.map((s, i) => (i === index ? !s : s));
                            void persistSchedule({
                              enabled: scheduleEnabled,
                              start: startTime,
                              stop: stopTime,
                              days: next,
                            });
                            return next;
                          })
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

          {/* ── Device Information ────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
            <h3 className="text-lg mb-4">Device Information</h3>
            <div className="space-y-0 divide-y divide-border">
              {[
                { label: "Device ID",   value: device.id },
                { label: "Device Type", value: device.deviceType ?? device.info?.device_type },
                { label: "Firmware",    value: device.firmware   ?? device.info?.firmware },
                { label: "IP Address",  value: device.ip         ?? device.info?.ip },
                { label: "MAC Address", value: device.mac        ?? device.info?.mac },
                { label: "mDNS",        value: device.mdns       ?? device.info?.mdns },
                { label: "SSID",        value: device.ssid       ?? device.info?.ssid },
                {
                  label: "Signal",
                  value:
                    (device.rssi ?? device.info?.rssi) !== undefined
                      ? `${device.rssi ?? device.info?.rssi} dBm (${Math.max(0, Math.min(100, 100 + (device.rssi ?? device.info?.rssi ?? -90)))}%)`
                      : undefined,
                },
                {
                  label: "Free Heap",
                  value:
                    (device.freeHeap ?? device.info?.free_heap) !== undefined
                      ? `${((device.freeHeap ?? device.info?.free_heap ?? 0) / 1024).toFixed(1)} KB`
                      : undefined,
                },
                {
                  label: "Uptime",
                  value: (() => {
                    const sec = device.uptimeSec ?? device.info?.uptime_sec ?? 0;
                    if (!sec) return undefined;
                    const h = Math.floor(sec / 3600);
                    const m = Math.floor((sec % 3600) / 60);
                    const s = sec % 60;
                    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
                  })(),
                },
                {
                  label: "Boot At",
                  value:
                    (device.bootAt ?? device.info?.boot_at)
                      ? new Date(device.bootAt ?? device.info?.boot_at ?? 0).toLocaleString()
                      : undefined,
                },
                {
                  label: "Last Seen",
                  value: device.lastSeen
                    ? new Date(device.lastSeen).toLocaleString()
                    : undefined,
                },
              ]
                .filter((row) => row.value !== undefined && row.value !== "Unknown" && row.value !== "")
                .map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 py-3">
                    <span className="text-sm text-muted-foreground shrink-0">{row.label}</span>
                    <span className="text-sm text-right break-all">{row.value}</span>
                  </div>
                  ))}
            </div>
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