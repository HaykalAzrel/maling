import { useState } from "react";
import { useNavigate } from "react-router";
import { QrCode, Clipboard, ArrowLeft, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";
import { getDeviceById, upsertDevice } from "../../services/deviceService";
import { recordUserActivity } from "../../services/activityHistoryService";

type Step = "input" | "naming" | "validating" | "success" | "failed";

export function AddDevicePage() {
  const [step, setStep] = useState<Step>("input");
  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const currentStepLabel = step === "naming" ? "Step 2 of 2" : "Step 1 of 2";

  const handleValidate = async () => {
    setError("");
    setSaving(true);
    setStep("validating");

    try {
      const trimmedDeviceId = deviceId.trim();

      if (trimmedDeviceId.length <= 5) {
        setError("Device ID must be at least 6 characters.");
        setStep("failed");
        return;
      }

      // ✅ Fetch device dulu, kalau permission denied / tidak ada → null (tidak crash)
      let existingDevice = null;
      try {
        existingDevice = await getDeviceById(trimmedDeviceId);
      } catch (fetchError) {
        console.warn("Could not fetch device, assuming unclaimed:", fetchError);
      }

      // ✅ Cek owner dari field yang sudah dinormalisasi oleh device service
      const existingOwner = existingDevice?.ownerId ?? null;
      const ownerIsEmpty = !existingOwner || existingOwner === "";

      if (!ownerIsEmpty && existingOwner !== user?.uid) {
        setError("Device ID is already registered by another account.");
        setStep("failed");
        return;
      }

      setDeviceName(existingDevice?.name && existingDevice.name !== trimmedDeviceId ? existingDevice.name : trimmedDeviceId);
      setStep("naming");
    } catch (addDeviceError) {
      const message =
        addDeviceError instanceof Error ? addDeviceError.message : "Unable to validate device.";
      setError(message);
      console.error("Add device validation failed:", addDeviceError);
      setStep("failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDevice = async () => {
    setError("");
    setSaving(true);
    setStep("validating");

    try {
      const trimmedDeviceId = deviceId.trim();
      const trimmedDeviceName = deviceName.trim();

      if (trimmedDeviceName.length < 3) {
        setError("Device name must be at least 3 characters.");
        setStep("naming");
        return;
      }

      await upsertDevice({
        deviceId: trimmedDeviceId,
        name: trimmedDeviceName,
        location: "Firebase Device",
        monitoring: true,
        ownerId: user?.uid,
      });

      recordUserActivity({
        title: "Added device",
        device: trimmedDeviceId,
        severity: "success",
        detail: "Device saved to Firebase",
      });

      setStep("success");
      setTimeout(() => {
        navigate("/devices");
      }, 900);
    } catch (addDeviceError) {
      const message =
        addDeviceError instanceof Error ? addDeviceError.message : "Unable to save device.";
      setError(message);
      console.error("Add device failed:", addDeviceError);
      setStep("failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setDeviceId(text);
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-28 sm:pb-32">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="py-6 sm:py-8 lg:py-10 space-y-6 lg:space-y-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/devices")}
              className="p-2 hover:bg-accent rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl truncate">Add Device</h1>
              <p className="text-sm text-muted-foreground">
                {step === "input" && currentStepLabel}
                {step === "naming" && currentStepLabel}
                {step === "validating" && "Saving to Firebase"}
                {step === "success" && "Device saved"}
                {step === "failed" && "Save failed"}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-3">
                  <label className="text-sm text-muted-foreground">Device ID</label>
                  <input
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="Enter device ID"
                    className="w-full bg-input-background border border-border rounded-xl px-4 py-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-status-alert/30 bg-status-alert/10 px-4 py-3 text-sm text-status-alert">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handlePasteFromClipboard}
                    className="flex-1 bg-card border border-border py-3 rounded-xl hover:bg-accent transition-all flex items-center justify-center gap-2"
                  >
                    <Clipboard className="w-5 h-5" />
                    Paste from Clipboard
                  </button>
                  <button className="flex-1 bg-card border border-border py-3 rounded-xl hover:bg-accent transition-all flex items-center justify-center gap-2">
                    <QrCode className="w-5 h-5" />
                    Scan QR Code
                  </button>
                </div>

                <button
                  onClick={handleValidate}
                  disabled={!deviceId || saving}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Checking..." : "Continue"}
                </button>
              </motion.div>
            )}

            {step === "naming" && (
              <motion.div
                key="naming"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Device ID</p>
                    <p className="break-words">{deviceId.trim()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Device Name Preview</p>
                    <p className="break-words">{deviceName || "Unnamed Device"}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm text-muted-foreground">Device Name</label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="Example: Front Gate Sensor"
                    className="w-full bg-input-background border border-border rounded-xl px-4 py-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <p className="text-xs text-muted-foreground">
                    Give the device a clear name so it is easier to find in the dashboard.
                  </p>
                </div>

                {error && (
                  <div className="rounded-xl border border-status-alert/30 bg-status-alert/10 px-4 py-3 text-sm text-status-alert">
                    {error}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setStep("input")}
                    className="flex-1 bg-card border border-border py-3 rounded-xl hover:bg-accent transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSaveDevice}
                    disabled={!deviceName.trim() || saving}
                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : "Save Device"}
                  </button>
                </div>
              </motion.div>
            )}

            {step === "validating" && (
              <motion.div
                key="validating"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <Loader2 className="w-16 h-16 mx-auto mb-6 text-primary animate-spin" />
                <h3 className="text-xl mb-2">Saving Device</h3>
                <p className="text-muted-foreground">Please wait...</p>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 10 }}
                >
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-6 text-status-safe" />
                </motion.div>
                <h3 className="text-xl mb-2">Device Added</h3>
                <p className="text-muted-foreground">Saved to Firebase. Updating UI...</p>
              </motion.div>
            )}

            {step === "failed" && (
              <motion.div
                key="failed"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <XCircle className="w-16 h-16 mx-auto mb-6 text-status-alert" />
                <h3 className="text-xl mb-2">Device Cannot Be Added</h3>
                <p className="text-muted-foreground mb-6">
                  {error || "Please check the device ID and try again"}
                </p>
                <button
                  onClick={() => setStep("input")}
                  className="bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-all"
                >
                  Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}