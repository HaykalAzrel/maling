import { useNavigate } from "react-router";
import {
  Bell,
  Shield,
  Moon,
  Lock,
  User,
  LogOut,
  ChevronRight,
  Vibrate,
  Volume2,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useAppTheme } from "../theme-provider";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";
import { signOutCurrentUser } from "../../services/authService";

export function ProfilePage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useAppTheme();
  const { user } = useFirebaseAuth();
  const [pushNotifications, setPushNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);
  const isDarkTheme = theme === "dark";
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "SecureSense User";
  const displayEmail = user?.email ?? "No Firebase account";

  const handleLogout = async () => {
    await signOutCurrentUser();
    navigate("/login");
  };

  const menuItems = [
    { icon: Bell, label: "Notifications", path: "/settings/notifications" },
    { icon: Moon, label: "Appearance", path: "/settings/appearance" },
    { icon: Lock, label: "Security", path: "/settings/security" },
    { icon: Shield, label: "Connected Devices", path: "/devices" },
    { icon: User, label: "Privacy", path: "/settings/privacy" },
  ];

  return (
    <div className="min-h-dvh bg-background pb-28 sm:pb-32">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="py-6 sm:py-8 lg:py-10 space-y-6 lg:space-y-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl sm:text-4xl mb-0">Profile</h1>
            <p className="text-muted-foreground">Manage your account settings</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-4 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shrink-0">
                <span className="text-4xl">👤</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl mb-1 break-words">{displayName}</h3>
                <p className="text-sm text-muted-foreground mb-2">{displayEmail}</p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-status-safe/10 text-status-safe rounded-lg text-sm">
                  <div className="w-2 h-2 rounded-full bg-status-safe" />
                  Premium Account
                </div>
              </div>
            </div>
          </motion.div>

          <div>
            <h3 className="text-sm text-muted-foreground mb-3 px-2">SETTINGS</h3>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center gap-4 px-4 py-4 hover:bg-accent transition-colors border-b border-border last:border-b-0 text-left"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="flex-1 min-w-0 text-left">{item.label}</span>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm text-muted-foreground mb-3 px-2">
              APP SETTINGS
            </h3>
            <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Moon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p>Theme</p>
                    <p className="text-sm text-muted-foreground break-words">
                      Switch between dark and calm light mode
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    isDarkTheme ? "bg-primary" : "bg-muted"
                  }`}
                  aria-label="Toggle theme"
                >
                  <motion.div
                    animate={{ x: isDarkTheme ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Bell className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p>Push Notifications</p>
                    <p className="text-sm text-muted-foreground break-words">
                      Receive alerts
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPushNotifications(!pushNotifications)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    pushNotifications ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <motion.div
                    animate={{ x: pushNotifications ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Volume2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p>Sound</p>
                    <p className="text-sm text-muted-foreground break-words">
                      Alert sound effects
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSound(!sound)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    sound ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <motion.div
                    animate={{ x: sound ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Vibrate className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p>Vibration</p>
                    <p className="text-sm text-muted-foreground break-words">
                      Haptic feedback
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setVibration(!vibration)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    vibration ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <motion.div
                    animate={{ x: vibration ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full bg-destructive/10 text-destructive border border-destructive/30 py-3 rounded-xl hover:bg-destructive/20 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>

          <div className="pt-2 text-center text-sm text-muted-foreground">
            <p>SecureSense v2.1.0</p>
            <p className="mt-1">© 2026 SecureSense. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
