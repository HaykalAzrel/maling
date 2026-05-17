import { useState } from "react";
import { Search, AlertTriangle, Shield, Activity as ActivityIcon, Wifi, WifiOff, User } from "lucide-react";
import { motion } from "motion/react";
import { useFirebaseDevices } from "../../hooks/useFirebaseDevices";
import { useFirebaseActivity } from "../../hooks/useFirebaseActivity";

type FilterType = "today" | "alerts" | "devices" | "all";

export function ActivityPage() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { devices, loading: devicesLoading, error: deviceError } = useFirebaseDevices();
  const { activities, loading: activityLoading, error: activityError } = useFirebaseActivity(devices);

  const filteredActivities = activities
    .filter((activity) => {
      if (filter === "all") return true;
      if (filter === "today") return true;
      if (filter === "alerts") return activity.severity === "critical";
      if (filter === "devices") return activity.type === "success" || activity.type === "offline" || activity.type === "sensor";
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
        return <AlertTriangle className="w-5 h-5" />;
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

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto">
        <div className="px-6 pt-8 pb-6">
          <div className="mb-6">
            <h1 className="text-3xl mb-2">History User & Alat</h1>
            <p className="text-muted-foreground">Monitor user actions and device events in one timeline</p>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="w-full bg-card/90 text-foreground placeholder:text-muted-foreground border border-border shadow-sm rounded-xl px-12 py-3 backdrop-blur-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card"
            />
          </div>

          <div className="flex gap-2 mb-6 overflow-x-auto">
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
          </div>

          {deviceError || activityError ? (
            <div className="rounded-xl border border-status-alert/30 bg-status-alert/10 p-4 text-sm text-status-alert text-center py-16">
              {deviceError || activityError}
            </div>
          ) : devicesLoading || activityLoading ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground text-center py-16">
              Loading Firebase activity...
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-muted/50 rounded-3xl flex items-center justify-center">
                <ActivityIcon className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl mb-2">No Activities Found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search"
                  : devicesLoading || activityLoading
                  ? "Waiting for Firebase records"
                  : "No Firebase activity yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActivities.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className={`border rounded-xl p-4 ${getColor(activity.severity)}`}
                >
                  <div className="flex gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        activity.severity === "critical"
                          ? "bg-status-alert/20"
                          : activity.severity === "warning"
                          ? "bg-status-warning/20"
                          : activity.severity === "success"
                          ? "bg-status-safe/20"
                          : "bg-primary/20"
                      }`}
                    >
                      {getIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="mb-1">{activity.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {activity.device} • {activity.time}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(activity.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
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
