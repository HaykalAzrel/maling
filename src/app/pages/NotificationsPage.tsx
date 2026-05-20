import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  Shield,
  Activity,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { updateAlertStatus, deleteAlert } from "../../services/alertService";
import { useNavigate } from "react-router";
import { subscribeAlertsForDevices } from "../../services/alertService";
import { useFirebaseDevices } from "../../hooks/useFirebaseDevices";
import { Alert } from "../../types/alert";
import { PullIndicator, SafeTopSpacer, usePullToRefresh } from "../../hooks/usePullToRefresh";

// FIX 5 — Only show notifications from the last N days
const NOTIF_MAX_AGE_DAYS = 7;
const NOTIF_MAX_AGE_MS = NOTIF_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

type Notification = {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  message: string;
  device: string;
  time: string;
  read: boolean;
  timestamp: number;
  status: Alert["status"];
};

const formatTimeAgo = (timestamp: number) => {
  const elapsed = Date.now() - timestamp;
  if (elapsed < 60_000) return "Just now";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const toNotificationType = (
  status: Alert["status"]
): Notification["type"] => {
  switch (status) {
    case "resolved":
      return "info";
    case "read":
      return "warning";
    default:
      return "critical";
  }
};

export function NotificationsPage() {
  const [alerts, setAlerts] = useState<Record<string, Alert>>({});
  const [loading, setLoading] = useState(true);
  // FIX 5 — Track "clearing" state for UI feedback
  const [clearing, setClearing] = useState(false);
  const navigate = useNavigate();
  const {
    devices,
    loading: devicesLoading,
    error: devicesError,
  } = useFirebaseDevices();

  useEffect(() => {
    if (devicesLoading) return;
    setLoading(true);
    const unsubscribe = subscribeAlertsForDevices(
      devices.map((d) => d.id),
      (alertRecords) => {
        setAlerts(alertRecords);
        setLoading(false);
      },
      () => {
        setAlerts({});
        setLoading(false);
      }
    );
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [devices, devicesLoading]);

  const handleRefresh = useCallback(async () => {
        await new Promise((res) => setTimeout(res, 800));
      }, []);
    
      const { refreshing, pullDistance, threshold, touchHandlers } =
        usePullToRefresh(handleRefresh);

  // FIX 5 — Filter out notifications older than NOTIF_MAX_AGE_DAYS
  const notifications = useMemo(() => {
    const cutoff = Date.now() - NOTIF_MAX_AGE_MS;
    return Object.entries(alerts)
      .map(([id, alert]) => ({
        id,
        type: toNotificationType(alert.status),
        title:
          alert.type === "intruder_detected"
            ? "Intrusion Alert"
            : "Device Alert",
        message: `Distance ${alert.distance} cm${
          alert.pirTriggered ? " • PIR triggered" : ""
        }${alert.ultraSonicTriggered ? " • ultrasonic" : ""}`,
        device: alert.deviceName || alert.deviceId,
        time: formatTimeAgo(alert.timestamp),
        read: alert.status === "read" || alert.status === "resolved",
        timestamp: alert.timestamp,
        status: alert.status,
      }))
      // ← Only keep recent alerts
      .filter((n) => n.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [alerts]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = async () => {
    await Promise.all(
      notifications.map(async (notification) => {
        const alert = alerts[notification.id];
        if (!alert) return;
        await updateAlertStatus(alert.deviceId, notification.id, "read");
      })
    );
  };

  const deleteNotification = async (id: string) => {
    const alert = alerts[id];
    if (!alert) return;
    await deleteAlert(alert.deviceId, id);
  };

  // FIX 5 — Delete ALL notifications from Firebase
  const clearAllNotifications = async () => {
    setClearing(true);
    try {
      await Promise.all(
        Object.entries(alerts).map(([id, alert]) =>
          deleteAlert(alert.deviceId, id)
        )
      );
    } finally {
      setClearing(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "critical":
      case "warning":
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-status-alert/10 text-status-alert border-status-alert/30";
      case "warning":
        return "bg-status-warning/10 text-status-warning border-status-warning/30";
      default:
        return "bg-primary/10 text-primary border-primary/30";
    }
  };

return (
  <div
    className="min-h-dvh bg-background pb-28 sm:pb-32"
    {...touchHandlers}
  >
    <SafeTopSpacer />

    <PullIndicator
      pullDistance={pullDistance}
      refreshing={refreshing}
      threshold={threshold}
    />

    {/* ✅ Hapus div duplikat min-h-dvh pb-28 yang ada di bawah PullIndicator */}
    <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
      <div
        className="space-y-6 lg:space-y-8 pb-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)",
        }}
      >
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 hover:bg-accent rounded-xl transition-colors shrink-0"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl truncate">Notifications</h1>
              <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-sm text-primary hover:underline">
                Mark all read
              </button>
            )}
            {Object.keys(alerts).length > 0 && (
              <button
                onClick={clearAllNotifications}
                disabled={clearing}
                className="flex items-center gap-1.5 text-sm text-destructive hover:underline disabled:opacity-50"
              >
                {clearing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Clear all
              </button>
            )}
          </div>
        </div>

        {devicesError ? (
          <div className="rounded-xl border border-status-alert/30 bg-status-alert/10 p-4 text-sm text-status-alert text-center py-16">
            {devicesError}
          </div>
        ) : loading ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground text-center py-16">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 px-4"
          >
            <div className="w-24 h-24 mx-auto mb-6 bg-muted/50 rounded-3xl flex items-center justify-center">
              <Shield className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl mb-2">No Notifications</h3>
            <p className="text-muted-foreground text-sm">
              Tidak ada notifikasi dalam {NOTIF_MAX_AGE_DAYS} hari terakhir.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {notifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className={`border rounded-xl p-4 sm:p-5 ${
                    notification.read
                      ? "bg-card border-border opacity-70"
                      : getColor(notification.type)
                  } relative group`}
                >
                  {!notification.read && (
                    <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary" />
                  )}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4 pr-8 sm:pr-10">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        notification.type === "critical"
                          ? "bg-status-alert/20"
                          : notification.type === "warning"
                          ? "bg-status-warning/20"
                          : "bg-primary/20"
                      }`}
                    >
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="break-words">{notification.title}</h4>
                        {notification.type === "critical" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-status-alert/20 text-status-alert">
                            URGENT
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground break-words">
                        {notification.device} • {notification.time}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  </div>
);
}