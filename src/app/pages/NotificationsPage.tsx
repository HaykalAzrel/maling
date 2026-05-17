import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle, Shield, Activity, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { updateAlertStatus, deleteAlert } from "../../services/alertService";
import { useNavigate } from "react-router";
import { subscribeAlertsForDevices } from "../../services/alertService";
import { useFirebaseDevices } from "../../hooks/useFirebaseDevices";
import { Alert } from "../../types/alert";

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

  if (elapsed < 60_000) {
    return "Just now";
  }

  const minutes = Math.floor(elapsed / 60_000);

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const toNotificationType = (status: Alert["status"]): Notification["type"] => {
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
  const navigate = useNavigate();
  const { devices, loading: devicesLoading, error: devicesError } = useFirebaseDevices();

  useEffect(() => {
    if (devicesLoading) {
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeAlertsForDevices(devices.map((device) => device.id), (alertRecords) => {
      setAlerts(alertRecords);
      setLoading(false);
    }, () => {
      setAlerts({});
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [devices, devicesLoading]);

  const notifications = useMemo(
    () =>
      Object.entries(alerts)
        .map(([id, alert]) => ({
          id,
          type: toNotificationType(alert.status),
          title: alert.type === "intruder_detected" ? "Intrusion Alert" : "Device Alert",
          message: `Distance ${alert.distance} cm${alert.pirTriggered ? " • PIR triggered" : ""}${alert.ultraSonicTriggered ? " • ultrasonic" : ""}`,
          device: alert.deviceName || alert.deviceId,
          time: formatTimeAgo(alert.timestamp),
          read: alert.status === "read" || alert.status === "resolved",
          timestamp: alert.timestamp,
          status: alert.status,
        }))
        .sort((left, right) => right.timestamp - left.timestamp),
    [alerts]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = async () => {
    await Promise.all(
      notifications.map(
          async (notification) => {
            const alert =
              alerts[notification.id];
            if (!alert) {
              return;
            }

          await updateAlertStatus(
            alert.deviceId,
            notification.id,
            "read"
          );
        }
      )
    );
  };

  const deleteNotification = async (
    id: string
  ) => {
    const alert = alerts[id];
    if (!alert) {
      return;
    }
    await deleteAlert(
      alert.deviceId,
      id
    );

  };

  const getIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <AlertTriangle className="w-5 h-5" />;
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
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto">
        <div className="px-6 pt-8 pb-6">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 hover:bg-accent rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl">Notifications</h1>
              <p className="text-sm text-muted-foreground">
                {unreadCount} unread
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {devicesError ? (
            <div className="rounded-xl border border-status-alert/30 bg-status-alert/10 p-4 text-sm text-status-alert text-center py-16">
              {devicesError}
            </div>
          ) : loading ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground text-center py-16">
              Loading Firebase notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-muted/50 rounded-3xl flex items-center justify-center">
                <Shield className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl mb-2">No Notifications</h3>
              <p className="text-muted-foreground">
                You're all caught up!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className={`border rounded-xl p-4 ${
                    notification.read
                      ? "bg-card border-border opacity-70"
                      : getColor(notification.type)
                  } relative group`}
                >
                  {!notification.read && (
                    <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary" />
                  )}
                  <div className="flex gap-4 pr-8">
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
                      <div className="flex items-center gap-2 mb-1">
                        <h4>{notification.title}</h4>
                        {notification.type === "critical" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-status-alert/20 text-status-alert">
                            URGENT
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
