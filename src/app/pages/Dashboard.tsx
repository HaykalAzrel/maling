import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Shield, Wifi, AlertTriangle, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { useFirebaseDevices } from "../../hooks/useFirebaseDevices";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";
import { usePullToRefresh, PullIndicator, SafeTopSpacer } from "../../hooks/usePullToRefresh";
import { isDeviceAlive } from "../../hooks/useDeviceAlive"; // ✅ import helper

const formatLastSeen = (timestamp?: number) => {
  if (!timestamp) return "Unknown";
  const elapsed = Date.now() - timestamp;
  if (elapsed < 60_000) return "Just now";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

export function Dashboard() {
  const navigate = useNavigate();
  const { devices, loading, refreshDevices } = useFirebaseDevices();
  const { user } = useFirebaseAuth();
  const loadingRef = useRef(loading);

  // ── Ticker 1 detik agar isDeviceAlive reaktif di UI ───────────────────
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? "Good Morning" : currentHour < 18 ? "Good Afternoon" : "Good Evening";
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "SecureSense User";
  const displayEmail = user?.email ?? "No account found";

  // ✅ Online/offline sepenuhnya dari lastSeen, bukan device.status dari Firebase
  const onlineDevices  = devices.filter((d) => isDeviceAlive(d));
  const offlineDevices = devices.filter((d) => !isDeviceAlive(d));
  const visibleDevices = devices.slice(0, 4);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const handleRefresh = useCallback(async () => {
    refreshDevices();
    await new Promise<void>((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (!loadingRef.current || Date.now() - start > 2000) { resolve(); return; }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }, [refreshDevices]);

  const { refreshing, pullDistance, threshold, touchHandlers } =
    usePullToRefresh(handleRefresh);

  return (
    <div className="min-h-dvh bg-background pb-28 sm:pb-32" {...touchHandlers}>
      <SafeTopSpacer />
      <PullIndicator pullDistance={pullDistance} refreshing={refreshing} threshold={threshold} />

      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="pt-4 pb-6 space-y-6 lg:space-y-8">

          {/* ── Header ───────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-muted-foreground mb-1 text-sm sm:text-base">
                {greeting}, {displayName}
              </p>
              <p className="text-xs text-muted-foreground">{displayEmail}</p>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
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
                {/* ✅ Badge merah hanya kalau ada yg benar-benar dead */}
                {offlineDevices.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-status-warning rounded-full" />
                )}
              </button>
              <button
                onClick={() => navigate("/profile")}
                className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20"
              >
                <span className="text-lg">👤</span>
              </button>
            </div>
          </div>

          {/* ── Status Banner ─────────────────────────────────────────── */}
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
                        ? `${offlineDevices.length} device tidak mengirim sinyal`
                        : "All devices are operating normally"}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Counter cards ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-card border border-border rounded-xl p-4 sm:p-5"
              >
                <Wifi className="w-6 h-6 text-status-safe mb-3" />
                {/* ✅ Pakai onlineDevices dari lastSeen */}
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
                {/* ✅ Pakai offlineDevices dari lastSeen */}
                <div className="text-2xl mb-1">{offlineDevices.length}</div>
                <div className="text-sm text-muted-foreground">Offline Devices</div>
              </motion.div>
            </div>
          </div>

          {/* ── Live Devices ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg sm:text-xl">Live Devices</h3>
            <div className="flex gap-2 self-end sm:self-auto">
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
              Connecting to Device...
            </div>
          ) : visibleDevices.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              No devices found.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleDevices.map((device, index) => {
                // ✅ Status visual sepenuhnya dari lastSeen, bukan device.status
                const alive = isDeviceAlive(device);

                return (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    onClick={() => navigate(`/devices/${device.id}`)}
                    className={`p-4 sm:p-5 rounded-xl border cursor-pointer transition-all ${
                      !alive
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
                              !alive ? "bg-status-offline" : "bg-status-safe"
                            }`}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground break-words">
                          {device.location}
                        </p>
                      </div>

                      {/* ✅ Badge status dari lastSeen */}
                      <div className="text-right self-start">
                        <div
                          className={`text-sm px-2 py-1 rounded-lg inline-flex ${
                            !alive
                              ? "bg-status-offline/20 text-status-offline"
                              : "bg-status-safe/20 text-status-safe"
                          }`}
                        >
                          {alive ? "ONLINE" : "NO SIGNAL"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
                      <span className="min-w-0">
                        Type:{" "}
                        <span className="text-foreground">
                          {device.deviceType ?? device.name}
                        </span>
                      </span>
                      <span>{device.monitoring ? "Device active" : "Device inactive"}</span>
                    </div>

                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
                      <span>
                        Heap:{" "}
                        <span className="text-foreground">
                          {device.freeHeap ?? device.freeheap}
                        </span>
                      </span>
                      {/* ✅ Tampilkan lastSeen sebagai info waktu */}
                      <span>
                        Last seen:{" "}
                        <span className={alive ? "text-foreground" : "text-status-warning"}>
                          {formatLastSeen(device.lastSeen)}
                        </span>
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}