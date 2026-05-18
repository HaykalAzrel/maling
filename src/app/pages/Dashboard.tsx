import { Bell, Shield, Wifi, Activity, AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { useFirebaseDevices } from "../../hooks/useFirebaseDevices";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";

const formatLastSeen = (timestamp?: number) => {
  if (!timestamp) {
    return "Unknown";
  }

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

export function Dashboard() {
  const navigate = useNavigate();
  const { devices, loading } = useFirebaseDevices();
  const { user } = useFirebaseAuth();
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? "Good Morning" : currentHour < 18 ? "Good Afternoon" : "Good Evening";
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "SecureSense User";
  const displayEmail = user?.email ?? "No Firebase account";

  const onlineDevices = devices.filter((device) => device.status === "online");
  const offlineDevices = devices.filter((device) => device.status === "offline");
  const monitoringDevices = devices.filter((device) => device.monitoring);
  const health = devices.length ? Math.round((onlineDevices.length / devices.length) * 100) : 0;
  const visibleDevices = devices.slice(0, 4);

  return (
    <div className="min-h-dvh bg-background pb-28 sm:pb-32">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="py-6 sm:py-8 lg:py-10 space-y-6 lg:space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-muted-foreground mb-1 text-sm sm:text-base">
                {greeting}, {displayName}
              </p>
              <p className="text-xs text-muted-foreground">{displayEmail}</p>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-status-safe"
              />
              <button
                onClick={() => navigate("/notifications")}
                className="relative p-2 hover:bg-accent rounded-xl transition-colors"
              >
                <Bell className="w-6 h-6" />
                {offlineDevices.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-status-warning rounded-full" />
                )}
              </button>
              <button className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                <span className="text-lg">👤</span>
              </button>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-5 sm:p-6 rounded-2xl border ${
                offlineDevices.length > 0
                  ? "bg-status-warning/10 border-status-warning/30"
                  : "bg-card border-border"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  {offlineDevices.length > 0 ? (
                    <AlertTriangle className="w-8 h-8 text-status-warning shrink-0" />
                  ) : (
                    <Shield className="w-8 h-8 text-status-safe shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-xl sm:text-2xl">
                      {offlineDevices.length > 0 ? "DEVICES NEED ATTENTION" : "SYSTEM ACTIVE"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                      {offlineDevices.length > 0
                        ? "Some Firebase devices are offline"
                        : "All Firebase devices are operating normally"}
                    </p>
                  </div>
                </div>
                {offlineDevices.length === 0 && (
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-3 h-3 rounded-full bg-status-safe self-start sm:self-auto"
                  />
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{onlineDevices.length} devices online</span>
                <span className="hidden sm:inline">•</span>
                <span>{monitoringDevices.length} monitoring</span>
              </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-card border border-border rounded-xl p-4 sm:p-5"
              >
                <Wifi className="w-6 h-6 text-status-safe mb-3" />
                <div className="text-2xl mb-1">{onlineDevices.length}</div>
                <div className="text-sm text-muted-foreground">Online Devices</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-card border border-border rounded-xl p-4 sm:p-5"
              >
                <AlertTriangle className="w-6 h-6 text-status-warning mb-3" />
                <div className="text-2xl mb-1">{offlineDevices.length}</div>
                <div className="text-sm text-muted-foreground">Offline Devices</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-card border border-border rounded-xl p-4 sm:p-5"
              >
                <Activity className="w-6 h-6 text-primary mb-3" />
                <div className="text-2xl mb-1">{monitoringDevices.length}</div>
                <div className="text-sm text-muted-foreground">Monitoring</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-card border border-border rounded-xl p-4 sm:p-5"
              >
                <Shield className="w-6 h-6 text-status-safe mb-3" />
                <div className="text-2xl mb-1">{health}%</div>
                <div className="text-sm text-muted-foreground">Health</div>
              </motion.div>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg sm:text-xl">Live Devices</h3>
            <div className="flex gap-2 self-start sm:self-auto">
              <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate("/devices/add")}
                className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loading && devices.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Connecting to Firebase...
            </div>
          ) : visibleDevices.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              No devices found in Firebase.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleDevices.map((device, index) => (
                <motion.div
                  key={device.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  onClick={() => navigate(`/devices/${device.id}`)}
                  className={`p-4 sm:p-5 rounded-xl border cursor-pointer transition-all ${
                    device.status === "offline"
                      ? "bg-status-warning/10 border-status-warning/30"
                      : "bg-card border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="truncate">{device.name}</h4>
                        <motion.div
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className={`w-2 h-2 rounded-full ${
                            device.status === "offline" ? "bg-status-offline" : "bg-status-safe"
                          }`}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground break-words">{device.location}</p>
                    </div>
                    <div className="text-right self-start">
                      <div
                        className={`text-sm px-2 py-1 rounded-lg inline-flex ${
                          device.status === "offline"
                            ? "bg-status-offline/20 text-status-offline"
                            : "bg-status-safe/20 text-status-safe"
                        }`}
                      >
                        {device.status.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
                    <span className="min-w-0">
                      Type: <span className="text-foreground">{device.deviceType ?? device.name}</span>
                    </span>
                    <span>{device.monitoring ? "Monitoring active" : "Monitoring off"}</span>
                  </div>

                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
                    <span>
                      Heap: <span className="text-foreground">{device.freeHeap ?? device.freeheap}</span>
                    </span>
                    <span>
                      Uptime: <span className="text-foreground">{device.uptimeSec ?? device.uptime} sec</span>
                    </span>
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
