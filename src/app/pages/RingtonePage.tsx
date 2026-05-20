import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Check, Music, Upload, X } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useUserAlertPreferences } from "../../hooks/useUserAlertPreferences";
import { type RingtonePreference } from "../../services/userPreferencesService";
import { usePullToRefresh, PullIndicator, SafeTopSpacer } from "../../hooks/usePullToRefresh";

const ringtonePresets = [
  { id: "default", name: "Default", description: "Default alert sound" },
  { id: "beacon",  name: "Beacon",  description: "Soft repeating tone" },
  { id: "siren",   name: "Siren",   description: "Loud emergency siren" },
] as const;

// Audio files must be placed in public/sounds/ with these exact names:
//   public/sounds/default.mp3
//   public/sounds/beacon.mp3
//   public/sounds/siren.mp3
const soundPath = (id: string) => `/sounds/${id}.mp3`;

const MAX_CUSTOM_SIZE = 2 * 1024 * 1024; // 2 MB

// Plays a local file and stops after `durationMs`.
// Falls back to Web Audio API synthesis if file is missing.
const playLocalPreview = (
  id: typeof ringtonePresets[number]["id"],
  durationMs = 3000
) => {
  const audio = new Audio(soundPath(id));
  audio.volume = 0.8;
  const stop = () => { audio.pause(); audio.currentTime = 0; };

  audio.play().then(() => {
    setTimeout(stop, durationMs);
  }).catch(() => {
    // File not found — fall back to Web Audio API
    playWebAudioPreview(id);
  });
};

const playWebAudioPreview = (id: typeof ringtonePresets[number]["id"]) => {
  const ctx = new AudioContext();

  if (id === "default") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);

  } else if (id === "beacon") {
    [0, 0.6, 1.2].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(1046, ctx.currentTime + offset);
      osc.frequency.exponentialRampToValueAtTime(523, ctx.currentTime + offset + 0.3);
      gain.gain.setValueAtTime(0.35, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.35);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.35);
    });

  } else if (id === "siren") {
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sawtooth";
      const base = ctx.currentTime + i * 0.9;
      osc.frequency.setValueAtTime(600, base);
      osc.frequency.linearRampToValueAtTime(1200, base + 0.45);
      osc.frequency.linearRampToValueAtTime(600, base + 0.9);
      gain.gain.setValueAtTime(0.3, base);
      gain.gain.exponentialRampToValueAtTime(0.001, base + 0.9);
      osc.start(base);
      osc.stop(base + 0.9);
    }
  }

  setTimeout(() => ctx.close(), 3000);
};

export function RingtonePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { preferences, updatePreferences } = useUserAlertPreferences();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Local state — prevents Firebase listener from reverting the UI on every emit
  const [localRingtone, setLocalRingtone] = useState<RingtonePreference>(preferences.ringtone);

  useEffect(() => {
    setLocalRingtone(preferences.ringtone);
  }, [preferences.ringtone]);

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    await new Promise((res) => setTimeout(res, 800));
  }, []);
  const { refreshing, pullDistance, threshold, touchHandlers } = usePullToRefresh(handleRefresh);

  // ── Select preset ─────────────────────────────────────────────────────────
  const selectPreset = async (presetId: typeof ringtonePresets[number]["id"]) => {
    const preset = ringtonePresets.find((item) => item.id === presetId);
    if (!preset) return;

    const newRingtone: RingtonePreference = {
      type: preset.id === "default" ? "default" : "preset",
      name: preset.name,
    };

    setLocalRingtone(newRingtone);
    playLocalPreview(presetId);          // preview local file (or fallback)

    try {
      await updatePreferences({ ringtone: newRingtone });
    } catch {
      toast.error("Gagal menyimpan ringtone. Periksa koneksi internet.");
      setLocalRingtone(preferences.ringtone);
    }
  };

  // ── Custom upload ─────────────────────────────────────────────────────────
  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_CUSTOM_SIZE) {
      setUploadError(`File terlalu besar. Maks ${MAX_CUSTOM_SIZE / 1024 / 1024} MB.`);
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

      // Play 3-second preview of the uploaded file
      const preview = new Audio(dataUrl);
      void preview.play().catch(() => undefined);
      setTimeout(() => { preview.pause(); preview.currentTime = 0; }, 3000);

      try {
        await updatePreferences({ ringtone: newRingtone });
        toast.success(`Ringtone "${file.name}" berhasil disimpan.`);
      } catch {
        toast.error("Gagal menyimpan ringtone. Coba file lebih kecil atau periksa koneksi.");
        setLocalRingtone(preferences.ringtone);
      }
      setUploading(false);
    };

    reader.onerror = () => {
      setUploadError("Gagal membaca file. Coba file lain.");
      setUploading(false);
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  // Clear custom ringtone back to default
  const clearCustom = async () => {
    const newRingtone: RingtonePreference = { type: "default", name: "Default" };
    setLocalRingtone(newRingtone);
    try {
      await updatePreferences({ ringtone: newRingtone });
    } catch {
      toast.error("Gagal menghapus ringtone custom.");
      setLocalRingtone(preferences.ringtone);
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-28 sm:pb-32" {...touchHandlers}>
      <SafeTopSpacer />
      <PullIndicator pullDistance={pullDistance} refreshing={refreshing} threshold={threshold} />

      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div
          className="space-y-6 lg:space-y-8 pb-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}
        >
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/profile")}
              className="p-2 hover:bg-accent rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl">Ringtone</h1>
              <p className="text-sm text-muted-foreground">Pilih suara notifikasi alarm</p>
            </div>
          </div>

          {/* Preset list */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-sm text-muted-foreground mb-2">Aktif sekarang</h2>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Music className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-base">{localRingtone.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {localRingtone.type === "custom" ? "File upload" : "Preset bawaan"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
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
                        <p className="text-xs text-muted-foreground">{preset.description}</p>
                      </div>
                      {selected && <Check className="w-5 h-5 text-primary shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom upload */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base">Upload ringtone sendiri</h2>
                <p className="text-xs text-muted-foreground">
                  MP3 / WAV / OGG — maks 2 MB
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-accent transition-colors shrink-0"
                disabled={uploading}
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Menyimpan…" : "Upload"}
              </button>
            </div>

            {/* Show active custom file */}
            {localRingtone.type === "custom" && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-primary bg-primary/10 px-4 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm truncate">{localRingtone.name}</span>
                </div>
                <button
                  onClick={() => void clearCustom()}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Hapus"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

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
