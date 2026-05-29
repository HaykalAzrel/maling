import { useState, useCallback } from "react";
import { Search, AlertTriangle, Shield, Activity as ActivityIcon, WifiOff, User, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useFirebaseDevices } from "../../hooks/useFirebaseDevices";
import { useFirebaseActivity } from "../../hooks/useFirebaseActivity";
import { usePullToRefresh, PullIndicator, SafeTopSpacer } from "../../hooks/usePullToRefresh";
import { clearStoredUserActivities } from "../../services/activityHistoryService";
import { clearAlertsForDevices } from "../../services/alertService";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";
import { Device } from "../../types/device";
import { saveClearedAt } from "../../services/activityHistoryService";

type FilterType = "today" | "alerts" | "devices" | "all";


export function ActivityPage() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  

  const { devices, loading: devicesLoading, error: deviceError } = useFirebaseDevices();
  const { user } = useFirebaseAuth();

  const { activities, loading: activityLoading, error: activityError, refreshClearedAt } = useFirebaseActivity(devices);

  // ── Pull-to-refresh ────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    await new Promise((res) => setTimeout(res, 800));
    setRefreshKey((k) => k + 1);
  }, []);

  const { refreshing, pullDistance, threshold, touchHandlers } =
    usePullToRefresh(handleRefresh);

  // ── Clear history ──────────────────────────────────────────────────────
  const handleClearHistory = async () => {
  setIsClearing(true);
  try {
    clearStoredUserActivities();
    const deviceIds = devices.map((d) => d.id);
    await clearAlertsForDevices(deviceIds);
    await saveClearedAt(deviceIds);

    // ← panggil keduanya
    refreshClearedAt();
    setRefreshKey((k) => k + 1);
  } catch (error) {
    console.error("Failed to clear history:", error);
  } finally {
    setIsClearing(false);
    setShowClearConfirm(false);
  }
};

  // ── Filtering ──────────────────────────────────────────────────────────
  const isAlertActivity = (activity: (typeof activities)[number]) =>
    activity.source === "alert" ||
    activity.type === "alert" ||
    activity.severity === "critical" ||
    activity.severity === "warning" ||
    activity.title.toLowerCase().includes("intrusion") ||
    activity.title.toLowerCase().includes("alert") ||
    (activity.type === "sensor" && activity.title.toLowerCase().includes("blocked"));

  const isDeviceActivity = (activity: (typeof activities)[number]) =>
    activity.source === "device" &&
    activity.type !== "alert" &&
    !activity.title.toLowerCase().includes("intrusion") &&
    !activity.title.toLowerCase().includes("alert");

  const filteredActivities = activities
    .filter((activity) => {
      if (filter === "all") return true;
      if (filter === "today") {
        const today = new Date();
        const activityDate = new Date(activity.timestamp);
        return (
          activityDate.getDate() === today.getDate() &&
          activityDate.getMonth() === today.getMonth() &&
          activityDate.getFullYear() === today.getFullYear()
        );
      }
      if (filter === "alerts") {
        return isAlertActivity(activity);
      }
      if (filter === "devices") {
        return isDeviceActivity(activity) && !isAlertActivity(activity);
      }
      return true;
    })
    .filter(
      (activity) =>
        activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.device.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const getIcon = (type: string) => {
    switch (type) {
      case "alert":
      case "warning":
        return <AlertTriangle className="w-5 h-5" />;
      case "sensor":
        return <ActivityIcon className="w-5 h-5" />;
      case "success":
        return <Shield className="w-5 h-5" />;
      case "offline":
        return <WifiOff className="w-5 h-5" />;
      case "user":
        return <User className="w-5 h-5" />;
      default:
        return <ActivityIcon className="w-5 h-5" />;
    }
  };

  const getColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-status-alert/10 text-status-alert border-status-alert/30";
      case "warning":
        return "bg-status-warning/10 text-status-warning border-status-warning/30";
      case "success":
        return "bg-status-safe/10 text-status-safe border-status-safe/30";
      default:
        return "bg-primary/10 text-primary border-primary/30";
    }
  };

  console.log('filteredActivities', filter, filteredActivities.map(a => ({ title: a.title, device: a.device, time: a.time, severity: a.severity })));

  return (
    <div className="min-h-dvh bg-background pb-28 sm:pb-32" {...touchHandlers}>
      <SafeTopSpacer />

      <PullIndicator
        pullDistance={pullDistance}
        refreshing={refreshing}
        threshold={threshold}
      />

      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="pt-4 pb-6 space-y-6 lg:space-y-8">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl sm:text-4xl mb-0 leading-tight">
                History User & Alat
              </h1>
              <p className="text-muted-foreground">
                Monitor user actions and device events in one timeline
              </p>
            </div>
          </div>

          {/* ── Search ─────────────────────────────────────────────────── */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="w-full bg-card/90 text-foreground placeholder:text-muted-foreground border border-border shadow-sm rounded-xl px-12 py-3 backdrop-blur-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card"
            />
          </div>

          {/* ── Filter Tabs ────────────────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0">
            {(["today", "alerts", "devices", "all"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border hover:bg-accent"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}

            {activities.length > 0 && (
              <button
              onClick={() => setShowClearConfirm(true)}
              className="shrink-0 ml-auto p-2 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
              title="Clear all history"
              >
              <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ── Konfirmasi Clear ───────────────────────────────────────── */}
          <AnimatePresence>
            {showClearConfirm && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-3"
              >
                <p className="text-center text-sm text-destructive">
                  Hapus semua history? Ini akan menghapus riwayat lokal dan alert di Firebase.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearing}
                    className="flex-1 py-2.5 rounded-xl border border-border hover:bg-accent transition-all text-sm disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleClearHistory}
                    disabled={isClearing}
                    className="flex-1 py-2.5 rounded-xl bg-destructive text-white hover:bg-destructive/90 transition-all text-sm disabled:opacity-70"
                  >
                    {isClearing ? "Menghapus..." : "Ya, Hapus Semua"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Activity List ──────────────────────────────────────────── */}
          {deviceError || activityError ? (
            <div className="rounded-xl border border-status-alert/30 bg-status-alert/10 p-4 text-sm text-status-alert text-center py-16">
              {deviceError || activityError}
            </div>
            ) : devicesLoading || activityLoading ? (
              <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground text-center py-16">
                Loading activity...
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-24 h-24 mx-auto mb-6 bg-muted/50 rounded-3xl flex items-center justify-center">
                  <ActivityIcon className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl mb-2">No Activities Found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? "Try adjusting your search" : "No activity yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-3" key={filter}>
                {filteredActivities.map((activity, index) => (
                  <motion.div
                  key={`${filter}-${activity.id}-${refreshKey}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className={`border rounded-xl p-4 sm:p-5 ${getColor(activity.severity)}`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      activity.severity === "critical" ? "bg-status-alert/20"
                      : activity.severity === "warning" ? "bg-status-warning/20"
                      : activity.severity === "success" ? "bg-status-safe/20"
                      : "bg-primary/20"
                    }`}>
                    {getIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="mb-1 break-words">{activity.title}</h4>
                      <p className="text-sm text-muted-foreground break-words">
                        {activity.device} • {activity.time}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-nowrap self-start sm:ml-auto">
                      {new Date(activity.timestamp).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                        timeZone: "Asia/Jakarta",
                      })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
