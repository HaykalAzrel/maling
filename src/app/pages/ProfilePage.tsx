import { useNavigate } from "react-router";
import {
  Bell, Shield, Moon, Lock, User, LogOut, ChevronRight,
  Volume2, RefreshCw, Speaker, Vibrate,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useCallback } from "react";
import { useAppTheme } from "../theme-provider";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";
import { signOutCurrentUser } from "../../services/authService";
import { useUserAlertPreferences } from "../../hooks/useUserAlertPreferences";
import { unregisterFCMToken } from "../../services/notificationService";


// ★ KEY FIX: guaranteed minimum padding even if env() returns 0
const SAFE_TOP_STYLE = {
  paddingTop: "max(env(safe-area-inset-top, 0px), 3rem)",
};

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${
        value ? "bg-primary" : "bg-muted"
      }`}
      role="switch"
      aria-checked={value}
    >
      <motion.div
        animate={{ x: value ? 24 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow-md"
      />
    </button>
  );
}

function LogoutDialog({
  open, onConfirm, onCancel,
}: { open: boolean; onConfirm: () => void; onCancel: () => void; }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed z-[101] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl"
          >
            <div className="w-12 h-12 mx-auto mb-4 bg-destructive/10 rounded-2xl flex items-center justify-center">
              <LogOut className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="text-xl text-center mb-1">Logout?</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Anda akan keluar dari akun ini.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-border bg-muted/50 text-sm font-medium hover:bg-muted transition-colors"
              >
                Batal
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                Logout
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PullIndicator({
  pullDistance, refreshing, threshold,
}: { pullDistance: number; refreshing: boolean; threshold: number; }) {
  const progress = Math.min(pullDistance / threshold, 1);
  const triggered = pullDistance >= threshold;
  return (
    <AnimatePresence>
      {(pullDistance > 5 || refreshing) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center justify-center pt-2"
          style={{ height: refreshing ? 44 : Math.max(pullDistance * 0.5, 0) }}
        >
          <motion.div
            animate={refreshing ? { rotate: 360 } : { rotate: progress * 180 }}
            transition={
              refreshing
                ? { repeat: Infinity, duration: 0.8, ease: "linear" }
                : { duration: 0 }
            }
            className={`w-6 h-6 transition-colors ${
              triggered || refreshing ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <RefreshCw className="w-6 h-6" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useAppTheme();
  const { user } = useFirebaseAuth();

  const { preferences, updatePreferences } = useUserAlertPreferences();
  const isDarkTheme = theme === "dark";

  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const PULL_THRESHOLD = 70;

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const displayName =
    user?.displayName ?? user?.email?.split("@")[0] ?? "SecureSense User";
  const displayEmail = user?.email ?? "No user account";

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((res) => setTimeout(res, 900));
    setRefreshing(false);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    const distance = e.touches[0].clientY - touchStartY.current;
    if (distance > 0) setPullDistance(Math.min(distance, PULL_THRESHOLD * 1.5));
  };
  const handleTouchEnd = async () => {
    if (pullDistance >= PULL_THRESHOLD && !refreshing) await handleRefresh();
    setPullDistance(0);
  };

  const handleLogout = async () => {
  // ✅ Hapus FCM token sebelum logout
  if (user?.uid) {
    await unregisterFCMToken(user.uid);
  }
  await signOutCurrentUser();
  navigate("/login");
  };

  const settingsItems = [
    {
      icon: Volume2, label: "Sound",
      toggle: {
        value: preferences.soundEnabled,
        onChange: () => updatePreferences({ soundEnabled: !preferences.soundEnabled }),
      },
    },
    {
      icon: Bell, label: "Notifications",
      toggle: {
        value: preferences.pushNotifications,
        onChange: () => updatePreferences({ pushNotifications: !preferences.pushNotifications }),
      },
    },
    {
      icon: Moon, label: "Appearance",
      toggle: { value: isDarkTheme, onChange: toggleTheme },
    },
    { icon: Speaker, label: "Ringtone", path: "/settings/ringtone" },
    { icon: Vibrate, label: "Vibration", path: "/settings/vibration" },
  ] as const;

  return (
    <>
      <LogoutDialog
        open={showLogoutDialog}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutDialog(false)}
      />

      <div
        className="min-h-dvh bg-background pb-28 sm:pb-32"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* ★ Status bar spacer — guaranteed minimum 3rem */}
        <div style={SAFE_TOP_STYLE} />

        <PullIndicator
          pullDistance={pullDistance}
          refreshing={refreshing}
          threshold={PULL_THRESHOLD}
        />

        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="space-y-6 lg:space-y-8 pt-4 pb-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl sm:text-4xl mb-0 leading-tight">Profile</h1>
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
                </div>
              </div>
            </motion.div>

            <div>
              <h3 className="text-sm text-muted-foreground mb-3 px-2">SETTINGS</h3>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {settingsItems.map((item, index) => {
                  const hasToggle = "toggle" in item;
                  const hasPath = "path" in item;
                  return (
                    <div
                      key={index}
                      onClick={() => {
                        if (hasToggle) {
                          item.toggle.onChange();
                          return;
                        }
                        if (hasPath) {
                          navigate(item.path);
                        }
                      }}
                      className={`w-full flex items-center gap-4 px-4 py-4 transition-colors border-b border-border last:border-b-0 ${
                        hasPath || hasToggle ? "cursor-pointer hover:bg-accent" : "cursor-default"
                      }`}
                    >
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="flex-1 min-w-0 text-left">{item.label}</span>
                      {hasToggle ? (
                        <Toggle value={item.toggle.value} onChange={item.toggle.onChange} />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setShowLogoutDialog(true)}
              className="w-full bg-destructive/10 text-destructive border border-destructive/30 py-3 rounded-xl hover:bg-destructive/20 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>

            <div className="pt-2 text-center text-sm text-muted-foreground">
              <p>Securo v1.1.0</p>
              <p className="mt-1">© 2026 Securo. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}