import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Check, Upload } from "lucide-react";
import { useNavigate } from "react-router";
import { useUserAlertPreferences } from "../../hooks/useUserAlertPreferences";
import { type RingtonePreference } from "../../services/userPreferencesService";
import { usePullToRefresh, PullIndicator, SafeTopSpacer } from "../../hooks/usePullToRefresh";

const ringtonePresets = [
  {
    id: "default",
    name: "Default",
    description: "Use system alert sound",
  },
  {
    id: "beacon",
    name: "Beacon",
    description: "Soft repeating tone",
  },
  {
    id: "siren",
    name: "Siren",
    description: "Loud repeating tone",
  },
] as const;

const MAX_CUSTOM_SIZE = 512 * 1024;

export function RingtonePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { preferences, updatePreferences } = useUserAlertPreferences();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Local state prevents Firebase listener from overriding the user's selection
  const [localRingtone, setLocalRingtone] = useState<RingtonePreference>(preferences.ringtone);

  useEffect(() => {
    setLocalRingtone(preferences.ringtone);
  }, [preferences.ringtone]);

  const playPresetPreview = (id: typeof ringtonePresets[number]["id"]) => {
    const ctx = new AudioContext();

    if (id === "default") {
      // Single beep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);

    } else if (id === "beacon") {
      // Ping... ping... seperti sonar/radar beacon asli
      [0, 0.6, 1.2].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(1046, ctx.currentTime + offset);       // C6
        osc.frequency.exponentialRampToValueAtTime(523, ctx.currentTime + offset + 0.3); // C5
        gain.gain.setValueAtTime(0.35, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.35);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.35);
      });

    } else if (id === "siren") {
      // Wee-woo wee-woo seperti sirine darurat asli
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sawtooth"; // lebih kasar seperti sirine asli

        const base = ctx.currentTime + i * 0.9;
        // Naik (wee)
        osc.frequency.setValueAtTime(600, base);
        osc.frequency.linearRampToValueAtTime(1200, base + 0.45);
        // Turun (woo)
        osc.frequency.linearRampToValueAtTime(600, base + 0.9);

        gain.gain.setValueAtTime(0.3, base);
        gain.gain.setValueAtTime(0.3, base + 0.85);
        gain.gain.exponentialRampToValueAtTime(0.001, base + 0.9);
        osc.start(base);
        osc.stop(base + 0.9);
      }
    }

    setTimeout(() => ctx.close(), 3000);
  };

  const selectPreset = async (presetId: typeof ringtonePresets[number]["id"]) => {
    const preset = ringtonePresets.find((item) => item.id === presetId);
    if (!preset) return;

    const newRingtone: RingtonePreference = {
      type: preset.id === "default" ? "default" : "preset",
      name: preset.name,
    };

    // Update local state immediately so UI reflects the choice without waiting for Firebase
    setLocalRingtone(newRingtone);
    playPresetPreview(presetId);

    await updatePreferences({ ringtone: newRingtone });
  };

  // ── Pull-to-refresh ────────────────────────────────────────────────────
    const handleRefresh = useCallback(async () => {
      await new Promise((res) => setTimeout(res, 800));
    }, []);
  
    const { refreshing, pullDistance, threshold, touchHandlers } =
      usePullToRefresh(handleRefresh);
  

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_CUSTOM_SIZE) {
      setUploadError("File too large. Max 512 KB.");
      event.target.value = "";
      return;
    }

    setUploadError(null);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const newRingtone: RingtonePreference = {
        type: "custom",
        name: file.name,
        customDataUrl: dataUrl,
      };
      setLocalRingtone(newRingtone);
      await updatePreferences({ ringtone: newRingtone });
      setUploading(false);
    };
    reader.onerror = () => {
      setUploadError("Upload failed. Try another file.");
      setUploading(false);
    };

    reader.readAsDataURL(file);
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

      {/* ← Hapus div "min-h-dvh bg-background pb-24" yang duplikat */}
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
              <h1 className="text-2xl sm:text-3xl">Ringtone</h1>
              <p className="text-sm text-muted-foreground">Choose alert sound</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-sm text-muted-foreground mb-2">Current</h2>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Check className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-base">{localRingtone.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {localRingtone.type === "custom" ? "Custom upload" : "Preset tone"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {ringtonePresets.map((preset) => {
                const selected =
                  localRingtone.type !== "custom" &&
                  localRingtone.name === preset.name;

                return (
                  <button
                    key={preset.id}
                    onClick={() => void selectPreset(preset.id)}
                    className={`w-full text-left border rounded-xl px-4 py-3 transition-colors ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-base">{preset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {preset.description}
                        </p>
                      </div>
                      {selected && <Check className="w-5 h-5 text-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base">Custom upload</h2>
                <p className="text-xs text-muted-foreground">
                  MP3 or WAV up to 512 KB
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-accent transition-colors"
                disabled={uploading}
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Uploading" : "Upload"}
              </button>
            </div>
            {uploadError && (
              <p className="text-xs text-destructive">{uploadError}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
