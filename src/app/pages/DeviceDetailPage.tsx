import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Shield,
  Wifi,
  Trash2,
  Clock,
} from "lucide-react";
import { motion } from "motion/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useFirebaseDevices } from "../../hooks/useFirebaseDevices";
import { subscribeSensorData } from "../../services/sensorService";
import { removeDevice, setDevicePowered } from "../../services/deviceService";
import { recordUserActivity } from "../../services/activityHistoryService";

const RADAR_SIZE = 260;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_MAX_DISTANCE = 200;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const distanceToRadarRadius = (distance: number) => {
  const ratio = clamp(distance, 0, RADAR_MAX_DISTANCE) / RADAR_MAX_DISTANCE;
  return 24 + ratio * 80;
};

type SensorHistoryPoint = {
  label: string;
  distance: number;
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parseTimeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export function DeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deviceMap, loading } = useFirebaseDevices();
  const [pushNotification, setPushNotification] = useState(true);
  const [silentMode, setSilentMode] = useState(false);
  const [threshold, setThreshold] = useState(50);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [startTime, setStartTime] = useState("22:00");
  const [stopTime, setStopTime] = useState("06:00");
  const [selectedDays, setSelectedDays] = useState([true, true, true, true, true, false, false]);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [sensorData, setSensorData] = useState<any>(null);
  const [sensorHistory, setSensorHistory] = useState<SensorHistoryPoint[]>([]);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // ✅ State untuk loading saat toggle power
  const [isTogglingPower, setIsTogglingPower] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeSensorData(id, (data) => {
      setSensorData(data);
      if (typeof data?.distance === "number") {
        const distance = data.distance;
        const timestamp = typeof data?.timestamp === "number" ? data.timestamp : Date.now();
        const label = new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setSensorHistory((current) => [...current, { label, distance }].slice(-12));
      }
    });
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, [id]);

  const device = id ? deviceMap[id] : undefined;

  // ✅ Baca status monitoring langsung dari Firebase (via deviceMap)
  const isMonitoringEnabled = device?.monitoring !== false && device?.laserOn !== false;

  // ✅ Toggle monitoring — tulis ke Firebase
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

  const info = device?.info ?? {};
  const liveSensor = sensorData ?? device?.sensor;
  const liveDistance = typeof liveSensor?.distance === "number" ? liveSensor.distance : 0;
  const radarRadius = distanceToRadarRadius(liveDistance);
  const blipAngle = liveSensor?.motion || liveSensor?.pir ? 18 : 0;
  const blipX = RADAR_CENTER + Math.sin((blipAngle * Math.PI) / 180) * radarRadius;
  const blipY = RADAR_CENTER - Math.cos((blipAngle * Math.PI) / 180) * radarRadius;
  const chartData = sensorHistory.length ? sensorHistory : [{ label: "Now", distance: liveDistance }];
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const currentDay = currentTime.getDay();
  const previousDay = (currentDay + 6) % 7;
  const startMinutes = parseTimeToMinutes(startTime);
  const stopMinutes = parseTimeToMinutes(stopTime);
  const sameDayWindow = startMinutes <= stopMinutes;
  const scheduleDaySelected = selectedDays[currentDay] || selectedDays[previousDay];
  const isScheduleActive = scheduleEnabled
    ? sameDayWindow
      ? selectedDays[currentDay] && currentMinutes >= startMinutes && currentMinutes < stopMinutes
      : (selectedDays[currentDay] && currentMinutes >= startMinutes) || (selectedDays[previousDay] && currentMinutes < stopMinutes)
    : false;
  const effectiveMonitoringEnabled = scheduleEnabled ? isScheduleActive : isMonitoringEnabled;
  const scheduleStatusLabel = !scheduleEnabled
    ? "Manual mode"
    : isScheduleActive ? "Active now"
    : scheduleDaySelected ? "Waiting for time window"
    : "Waiting for selected day";

  if (loading && !device) {
    return (
      <div className="min-h-screen bg-background pb-24 flex items-center justify-center text-muted-foreground">
        Connecting to Firebase...
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-screen bg-background pb-24 flex items-center justify-center text-muted-foreground">
        Device not found in Firebase.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto">
        <div className="px-6 pt-8 pb-6">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => navigate("/devices")} className="p-2 hover:bg-accent rounded-xl transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl">{device.name}</h1>
              <p className="text-sm text-muted-foreground">{device.location}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-lg text-sm ${
              device.status === "offline" ? "bg-status-offline/20 text-status-offline" : "bg-status-safe/20 text-status-safe"
            }`}>
              {device.status === "online" ? (
                <div className="flex items-center gap-1.5">
                  <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-status-safe" />
                  ONLINE
                </div>
              ) : "OFFLINE"}
            </div>
          </div>

          {/* Live Sensor Radar */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6 overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-primary" />
              <h3 className="text-lg">Live Sensor Radar</h3>
            </div>
            <div className="grid gap-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-5xl mb-2">
                    {liveDistance} <span className="text-2xl text-muted-foreground">cm</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Ultrasonic reading from Firebase</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>{device.laserOn ? "Laser monitoring enabled" : "Laser monitoring disabled"}</p>
                  <p>{liveSensor?.pir ? "PIR motion detected" : "PIR idle"}</p>
                  <p>{liveSensor?.motion ? "Radar target active" : "Radar scanning"}</p>
                </div>
              </div>

              <div className="relative mx-auto w-[280px] h-[240px] rounded-3xl bg-[#0d1320] border border-white/10 shadow-[0_0_50px_rgba(79,124,255,0.12)] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_center,rgba(79,124,255,0.16)_0%,rgba(79,124,255,0.06)_30%,transparent_70%)]" />
                <svg viewBox="0 0 280 240" className="absolute inset-0 h-full w-full">
                  <defs>
                    <linearGradient id="fanGlow" x1="0%" y1="100%" x2="0%" y2="0%">
                      <stop offset="0%" stopColor="rgba(79,124,255,0.0)" />
                      <stop offset="100%" stopColor="rgba(79,124,255,0.35)" />
                    </linearGradient>
                    <linearGradient id="scanBeam" x1="50%" y1="100%" x2="50%" y2="0%">
                      <stop offset="0%" stopColor="rgba(79,124,255,0.0)" />
                      <stop offset="100%" stopColor="rgba(79,124,255,0.9)" />
                    </linearGradient>
                  </defs>
                  <path d="M 48 200 A 112 112 0 0 1 232 200" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                  <path d="M 62 188 A 98 98 0 0 1 218 188" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" />
                  <path d="M 78 174 A 82 82 0 0 1 202 174" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
                  <path d="M 140 202 L 62 188 A 98 98 0 0 1 218 188 Z" fill="url(#fanGlow)" opacity="0.8" />
                  <path d="M 140 202 L 140 92" stroke="url(#scanBeam)" strokeWidth="2.5" strokeLinecap="round" className="animate-[pulse_2.2s_ease-in-out_infinite]" />
                  <circle cx="140" cy="202" r="4.5" fill="#ffffff" opacity="0.8" />
                  <circle cx={blipX} cy={blipY} r={liveSensor?.motion || liveSensor?.pir ? 7 : 5}
                    fill={liveSensor?.motion || liveSensor?.pir ? "#f59e0b" : "#10b981"} opacity="0.95" />
                  <g opacity="0.7">
                    <line x1="140" y1="202" x2="92" y2="108" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                    <line x1="140" y1="202" x2="140" y2="92" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                    <line x1="140" y1="202" x2="188" y2="108" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                  </g>
                </svg>
                <div className="absolute inset-x-0 top-4 text-center text-[11px] text-primary/80 uppercase tracking-[0.22em]">Forward-Facing Ultrasonic Radar</div>
                <div className="absolute left-4 top-16 text-[11px] text-muted-foreground uppercase tracking-[0.2em]">Near</div>
                <div className="absolute left-1/2 top-10 -translate-x-1/2 text-[11px] text-muted-foreground uppercase tracking-[0.2em]">Mid</div>
                <div className="absolute right-4 top-16 text-[11px] text-muted-foreground uppercase tracking-[0.2em]">Far</div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Recent Sensor Trend</span>
                  <span>{chartData.length} samples</span>
                </div>
                <div className="h-48 w-full rounded-2xl border border-border bg-background/60 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.18)" />
                      <XAxis dataKey="label" stroke="#858a9d" style={{ fontSize: "12px" }} />
                      <YAxis stroke="#858a9d" style={{ fontSize: "12px" }} />
                      <Tooltip contentStyle={{ background: "#141824", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                        formatter={(value) => [`${value} cm`, "Distance"]} />
                      <Line type="monotone" dataKey="distance" stroke="#4f7cff" strokeWidth={2.5}
                        dot={{ fill: "#4f7cff", r: 3 }} activeDot={{ r: 5, fill: "#10b981" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Device Controls */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h3 className="text-lg mb-4">Device Controls</h3>
            <div className="space-y-4">

              {/* ✅ Monitoring toggle — terhubung ke Firebase */}
              <div className="flex items-center justify-between">
                <div>
                  <p>Monitoring</p>
                  <p className="text-sm text-muted-foreground">
                    {scheduleEnabled
                      ? "Controlled by schedule automation"
                      : isTogglingPower
                      ? "Updating Firebase..."
                      : effectiveMonitoringEnabled
                      ? "Laser & detection active"
                      : "Laser & detection off"}
                  </p>
                </div>
                <button
                  onClick={handleToggleMonitoring}
                  disabled={scheduleEnabled || isTogglingPower}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    effectiveMonitoringEnabled ? "bg-primary" : "bg-muted"
                  } ${scheduleEnabled || isTogglingPower ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  <motion.div
                    animate={{ x: effectiveMonitoringEnabled ? 24 : 0 }}
                    className={`w-6 h-6 bg-white rounded-full shadow-md ${isTogglingPower ? "animate-pulse" : ""}`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p>Push Notification</p>
                  <p className="text-sm text-muted-foreground">Get alerts on your phone</p>
                </div>
                <button onClick={() => setPushNotification(!pushNotification)}
                  className={`w-12 h-6 rounded-full transition-colors ${pushNotification ? "bg-primary" : "bg-muted"}`}>
                  <motion.div animate={{ x: pushNotification ? 24 : 0 }} className="w-6 h-6 bg-white rounded-full shadow-md" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p>Silent Mode</p>
                  <p className="text-sm text-muted-foreground">Disable sound alerts</p>
                </div>
                <button onClick={() => setSilentMode(!silentMode)}
                  className={`w-12 h-6 rounded-full transition-colors ${silentMode ? "bg-primary" : "bg-muted"}`}>
                  <motion.div animate={{ x: silentMode ? 24 : 0 }} className="w-6 h-6 bg-white rounded-full shadow-md" />
                </button>
              </div>
            </div>
          </div>

          {/* Firebase Payload */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h3 className="text-lg mb-4">Firebase Payload</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border p-3">
                <p className="text-muted-foreground mb-1">Laser</p>
                <p>{device.laserOn ? "ON" : "OFF"}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-muted-foreground mb-1">Schedule</p>
                <p>{device.schedule ? "Configured" : "Not configured"}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-muted-foreground mb-1">Boot At</p>
                <p>{device.bootAt ? new Date(device.bootAt).toLocaleString() : "Unknown"}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-muted-foreground mb-1">Last Seen</p>
                <p>{device.lastSeen ? new Date(device.lastSeen).toLocaleString() : "Unknown"}</p>
              </div>
            </div>
          </div>

          {/* Threshold */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h3 className="text-lg mb-4">Threshold Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Detection Distance</span>
                <span className="text-lg">{threshold} cm</span>
              </div>
              <input type="range" min="10" max="200" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary" />
            </div>
          </div>

          {/* Schedule Automation */}
          <div className="bg-card/95 border border-border rounded-2xl p-6 mb-6 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="text-lg">Schedule Automation</h3>
              </div>
              <button onClick={() => setScheduleEnabled(!scheduleEnabled)}
                className={`w-12 h-6 rounded-full transition-colors ${scheduleEnabled ? "bg-primary" : "bg-switch-background"}`}>
                <motion.div animate={{ x: scheduleEnabled ? 24 : 0 }} className="w-6 h-6 bg-white rounded-full shadow-md" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Set when the ultrasonic monitoring should run and pause.</p>
            <div className="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 mb-4">
              <span className="text-sm text-muted-foreground">Automation status</span>
              <span className={`text-sm ${isScheduleActive ? "text-status-safe" : "text-muted-foreground"}`}>
                {scheduleStatusLabel}
              </span>
            </div>
            {scheduleEnabled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 pt-4 border-t border-border">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <label className="text-sm text-muted-foreground mb-2 block">Start Time</label>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-background/80 text-foreground border border-border rounded-xl px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-sm text-muted-foreground mb-2 block">Stop Time</label>
                    <input type="time" value={stopTime} onChange={(e) => setStopTime(e.target.value)}
                      className="w-full bg-background/80 text-foreground border border-border rounded-xl px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-3 block">Repeat Days</label>
                  <div className="flex flex-wrap gap-2">
                    {dayLabels.map((day, index) => (
                      <button key={`${day}-${index}`} type="button"
                        onClick={() => setSelectedDays((current) => current.map((s, i) => i === index ? !s : s))}
                        className={`w-12 h-10 rounded-xl border transition-colors ${
                          selectedDays[index] ? "bg-primary text-primary-foreground border-primary" : "bg-background/80 text-foreground border-border hover:bg-accent"
                        }`}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Device Output */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h3 className="text-lg mb-4">Device Output</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Values below are read from the Firebase <span className="text-foreground">info</span> payload.
            </p>
            <div className="space-y-3">
              {[
                { label: "Device ID", value: device.id },
                { label: "Device Type", value: info.device_type ?? device.deviceType ?? device.name ?? "Unknown" },
                { label: "Firmware", value: info.firmware ?? device.firmware ?? "Unknown" },
                { label: "Boot At", value: (info.boot_at ?? device.bootAt) ? new Date((info.boot_at ?? device.bootAt) as number).toLocaleString() : "Unknown" },
                { label: "Free Heap", value: String(info.free_heap ?? device.freeheap ?? device.freeHeap ?? "Unknown") },
                { label: "IP", value: info.ip ?? device.ip ?? "Unknown" },
                { label: "MAC", value: info.mac ?? device.mac ?? "Unknown" },
                { label: "MDNS", value: info.mdns ?? device.mdns ?? "Unknown" },
                { label: "SSID", value: info.ssid ?? device.ssid ?? "Unknown" },
                { label: "Uptime Sec", value: String(info.uptime_sec ?? device.uptimeSec ?? device.uptime ?? "Unknown") },
                { label: "Online", value: (info.online ?? device.online) ? "true" : "false" },
                { label: "Laser", value: device.sensor?.laser ?? "Unknown" },
                { label: "LDR Raw", value: String(device.sensor?.ldr_raw ?? "Unknown") },
                { label: "Updated At", value: device.sensor?.updated_at ? new Date(device.sensor.updated_at).toLocaleString() : "Unknown" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  {label === "RSSI" ? (
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-status-safe" />
                      <span className="text-sm">{String(info.rssi ?? device.rssi ?? 0)}</span>
                    </div>
                  ) : (
                    <span className="text-sm">{value}</span>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">RSSI</span>
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-status-safe" />
                  <span className="text-sm">{String(info.rssi ?? device.rssi ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Remove Device */}
          {!showConfirm ? (
            <button onClick={() => setShowConfirm(true)}
              className="w-full bg-destructive/10 text-destructive border border-destructive/30 py-3 rounded-xl hover:bg-destructive/20 transition-all flex items-center justify-center gap-2">
              <Trash2 className="w-5 h-5" />
              Remove Device
            </button>
          ) : (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-3">
              <p className="text-center text-sm text-destructive">
                Are you sure you want to remove <strong>{device.name}</strong>? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-accent transition-all text-sm">
                  Cancel
                </button>
                <button onClick={handleRemove} disabled={isRemoving}
                  className="flex-1 py-2.5 rounded-xl bg-destructive text-white hover:bg-destructive/90 transition-all text-sm disabled:opacity-70">
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