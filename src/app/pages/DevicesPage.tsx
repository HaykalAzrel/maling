import { useState } from "react";
import { Shield, Search, Wifi, WifiOff, AlertTriangle, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { useFirebaseDevices } from "../../hooks/useFirebaseDevices";

type FilterType = "all" | "online" | "offline" | "alert";

const toSignalStrength = (rssi?: number) => {
  if (typeof rssi !== "number") {
    return 0;
  }

  return Math.max(0, Math.min(100, 100 + rssi));
};

export function DevicesPage() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { devices, loading } = useFirebaseDevices();

  const filteredDevices = devices
    .filter((device) => {
      if (filter === "all") return true;
      if (filter === "online") return device.status === "online";
      if (filter === "offline") return device.status === "offline";
      if (filter === "alert") return device.monitoring === false;
      return true;
    })
    .filter(
      (device) =>
        device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto">
        <div className="px-6 pt-8 pb-6">
          <div className="mb-6">
            <h1 className="text-3xl mb-2">Devices</h1>
            <p className="text-muted-foreground">Live Firebase devices</p>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search devices..."
              className="w-full bg-card/90 text-foreground placeholder:text-muted-foreground border border-border shadow-sm rounded-xl px-12 py-3 backdrop-blur-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card"
            />
          </div>

          <div className="flex gap-2 mb-6 overflow-x-auto">
            {(["all", "online", "offline", "alert"] as FilterType[]).map((f) => (
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
          </div>

          {loading && devices.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">Connecting to Firebase...</div>
          ) : filteredDevices.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-24 h-24 mx-auto mb-6 bg-muted/50 rounded-3xl flex items-center justify-center">
                <Shield className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl mb-2">No Devices Found</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery ? "Try adjusting your search" : "No Firebase records yet"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => navigate("/devices/add")}
                  className="bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-all inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Your First Device
                </button>
              )}
            </motion.div>
          ) : (
            <div className="space-y-3">
              {filteredDevices.map((device, index) => (
                <motion.div
                  key={device.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                  onClick={() => navigate(`/devices/${device.id}`)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    device.status === "offline"
                      ? "bg-status-warning/10 border-status-warning/30"
                      : "bg-card border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        device.status === "offline" ? "bg-status-offline/20" : "bg-primary/10"
                      }`}
                    >
                      {device.status === "offline" ? (
                        <WifiOff className="w-7 h-7 text-status-offline" />
                      ) : (
                        <Shield className="w-7 h-7 text-primary" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="mb-1">{device.name}</h4>
                          <p className="text-sm text-muted-foreground">{device.location}</p>
                        </div>
                        <div
                          className={`text-sm px-3 py-1 rounded-lg ${
                            device.status === "offline"
                              ? "bg-status-offline/20 text-status-offline"
                              : "bg-status-safe/20 text-status-safe"
                          }`}
                        >
                          {device.status.toUpperCase()}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          {device.status === "online" ? (
                            <Wifi className="w-4 h-4 text-status-safe" />
                          ) : (
                            <WifiOff className="w-4 h-4 text-status-offline" />
                          )}
                          <span className="text-muted-foreground">
                            {device.status === "online" ? `${toSignalStrength(device.rssi)}%` : "Offline"}
                          </span>
                        </div>

                        <>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            {device.monitoring ? "Monitoring Active" : "Monitoring Off"}
                          </span>
                        </>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{device.info?.device_type ?? device.deviceType ?? "Unknown type"}</span>
                        <span>
                          {device.sensor?.laser === "BLOCKED"
                            ? "Laser blocked"
                            : device.laserOn
                            ? "Laser enabled"
                            : "Laser clear"}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Heap: {device.freeHeap ?? device.freeheap}</span>
                        <span>{device.schedule ? "Schedule set" : `Uptime: ${device.uptimeSec ?? device.uptime} sec`}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate("/devices/add")}
            className="fixed bottom-24 right-6 bg-primary text-primary-foreground w-14 h-14 rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 transition-transform"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
