import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Vibrate } from "lucide-react";
import { useNavigate } from "react-router";
import { Haptics } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { useUserAlertPreferences } from "../../hooks/useUserAlertPreferences";
import { PullIndicator, SafeTopSpacer, usePullToRefresh } from "../../hooks/usePullToRefresh";

const vibrationOptions = [
  {
    id: "short",
    title: "Short repeat",
    description: "Quick buzz every half second",
  },
  {
    id: "long",
    title: "Long repeat",
    description: "Longer pulses every second",
  },
  {
    id: "continuous",
    title: "Continuous",
    description: "Keeps buzzing until alert dismissed",
  },
] as const;

const getPattern = (mode: typeof vibrationOptions[number]["id"]) => {
  if (mode === "short") {
    return { duration: 120, interval: 500, pulses: 3 };
  }
  if (mode === "long") {
    return { duration: 350, interval: 900, pulses: 3 };
  }
  return { duration: 600, interval: 700, pulses: 4 };
};

export function VibrationPage() {
  const navigate = useNavigate();
  const { preferences, updatePreferences } = useUserAlertPreferences();
  const [testing, setTesting] = useState(false);
  const [localMode, setLocalMode] = useState(preferences.vibrationMode);

  // ── Pull-to-refresh ────────────────────────────────────────────────────
    const handleRefresh = useCallback(async () => {
      await new Promise((res) => setTimeout(res, 800));
    }, []);
  
    const { refreshing, pullDistance, threshold, touchHandlers } =
      usePullToRefresh(handleRefresh);
  

  useEffect(() => {
    setLocalMode(preferences.vibrationMode);
  }, [preferences.vibrationMode]);

  const runTest = async () => {
    if (testing) return;
    setTesting(true);

    const { duration, interval, pulses } = getPattern(localMode);
    let count = 0;

    const tick = async () => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.vibrate({ duration });
      } else if ("vibrate" in navigator) {
        navigator.vibrate(duration);
      }
      count += 1;
      if (count < pulses) {
        window.setTimeout(tick, interval);
      } else {
        setTesting(false);
      }
    };

    void tick();
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

      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div
          className="space-y-6 lg:space-y-8 pb-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/profile")}
              className="p-2 hover:bg-accent rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl">Vibration</h1>
              <p className="text-sm text-muted-foreground">Pick a haptic pattern</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-3">
            {vibrationOptions.map((option) => {
              const selected = localMode === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    setLocalMode(option.id);
                    void updatePreferences({ vibrationMode: option.id });
                  }}
                  className={`w-full text-left border rounded-xl px-4 py-3 transition-colors ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base">{option.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                    {selected && <Check className="w-5 h-5 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Vibrate className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-base">Test vibration</p>
                  <p className="text-xs text-muted-foreground">
                    Feel the selected pattern
                  </p>
                </div>
              </div>
              <button
                onClick={runTest}
                className="px-3 py-2 rounded-xl border border-border hover:bg-accent transition-colors"
                disabled={testing}
              >
                {testing ? "Testing" : "Test"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
