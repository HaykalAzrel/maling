import { FormEvent, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Shield, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { motion } from "motion/react";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { auth } from "../../firebase/config";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, sendPasswordResetEmail, signOut, sendEmailVerification, signInWithEmailAndPassword} from "firebase/auth";
import { signInWithEmail } from "../../services/authService";
import { Capacitor } from "@capacitor/core";

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const registrationMessage = (location.state as { message?: string })?.message;

  const getFriendlyError = (err: unknown): string => {
    const code = (err as { code?: string }).code ?? "";
    if (code === "auth/user-not-found")      return "Email tidak terdaftar.";
    if (code === "auth/invalid-email")       return "Format email tidak valid.";
    if (code === "auth/too-many-requests")   return "Terlalu banyak percobaan. Coba lagi nanti.";
    if (code === "auth/network-request-failed") return "Tidak ada koneksi internet.";
    if (code === "auth/invalid-credential")  return "Email tidak valid atau tidak terdaftar.";
    return err instanceof Error ? err.message : "Gagal kirim email reset.";
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    try {
      // Login sementara untuk dapat user object
      const firebaseAuth = auth!;
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      await sendEmailVerification(credential.user);
      await signOut(firebaseAuth); // logout lagi setelahnya
      setResendSent(true);
    } catch {
      setError("Gagal kirim ulang. Coba lagi.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
        setResetError("Masukkan email kamu.");
        return;
    }

    setResetError("");
    setResetLoading(true);

    try {
        if (!auth) throw new Error("Auth not initialized");
        await sendPasswordResetEmail(auth, resetEmail.trim());
        setResetSent(true);
    } catch (err) {
        setResetError(getFriendlyError(err)); // ← pakai getFriendlyError
    } finally {
        setResetLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Enter both email and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      navigate("/dashboard");
    } catch (authError) {
      const code = (authError as { code?: string }).code ?? "";
      if (code === "auth/email-not-verified") {
        setShowResendVerification(true); // tampilkan opsi kirim ulang
        setError("Email belum diverifikasi. Cek inbox kamu.");
      } else {
        setError(authError instanceof Error ? authError.message : "Unable to sign in.");
      }
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      if (Capacitor.isNativePlatform()) {
        await GoogleAuth.initialize({
          clientId: '383764904540-qvo1e4vt1c5744b3i09ua77gjf5evff8.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });
        const googleUser = await GoogleAuth.signIn();
        const credential = GoogleAuthProvider.credential(
          googleUser.authentication.idToken
        );
        if (!auth) throw new Error("Auth not initialized");
        await signInWithCredential(auth, credential);
      } else {
        const provider = new GoogleAuthProvider();
        if (!auth) throw new Error("Auth not initialized");
        await signInWithPopup(auth, provider);
      }
      navigate("/dashboard");
    } catch (authError) {
      await GoogleAuth.signOut().catch(() => {});
      setError(
        authError instanceof Error ? authError.message : "Google sign-in failed."
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ Class input yang konsisten untuk dark mode
  const inputClass =
    "w-full bg-card text-foreground placeholder:text-muted-foreground border border-border rounded-xl px-12 py-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all autofill:bg-card";

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4 sm:px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[480px]"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {registrationMessage && (
            <div className="rounded-xl border border-status-safe/30 bg-status-safe/10 px-4 py-3 text-sm text-status-safe">
              {registrationMessage}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-status-alert/30 bg-status-alert/10 px-4 py-3 text-sm text-status-alert">
              {error}
            </div>
          )}

          {showResendVerification && !resendSent && (
            <button
              type="button"
              onClick={() => void handleResendVerification()}
              disabled={resendLoading}
              className="w-full text-sm text-primary border border-primary/30 rounded-xl py-2.5 hover:bg-primary/10 transition-all disabled:opacity-70"
            >
              {resendLoading ? "Mengirim..." : "Kirim ulang email verifikasi"}
            </button>
          )}

          {resendSent && (
            <div className="rounded-xl border border-status-safe/30 bg-status-safe/10 px-4 py-3 text-sm text-status-safe">
              Email verifikasi sudah dikirim ulang. Cek inbox kamu.
            </div>
          )}

          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={inputClass}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => {
                setResetEmail(email); // ← pre-fill dari input email
                setResetSent(false);
                setResetError("");
                setShowForgotPassword(true);
              }}
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              {/* ✅ bg-background agar teks divider ikut tema */}
              <span className="px-4 bg-background text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-card text-foreground border border-border py-3 rounded-xl hover:bg-accent transition-all flex items-center justify-center gap-3 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {loading ? "Connecting..." : "Sign in with Google"}
          </button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="text-primary hover:underline"
            >
              Create account
            </button>
          </p>
        </form>
        {/* ── Forgot Password Modal ─────────────────────────────── */}
        {showForgotPassword && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowForgotPassword(false)}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4"
                    onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-1">
                      <h3 className="text-lg">Reset Password</h3>
                      <p className="text-sm text-muted-foreground">
                        Masukkan email kamu dan kami akan kirim link reset password.
                      </p>
                  </div>

                    {resetSent ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-status-safe/30 bg-status-safe/10 px-4 py-3 text-sm text-status-safe">
                          Email reset sudah dikirim ke <strong>{resetEmail}</strong>. Cek inbox kamu.
                      </div>
                      <button
                        onClick={() => setShowForgotPassword(false)}
                        className="w-full bg-primary text-primary-foreground py-3 rounded-xl hover:bg-primary/90 transition-all"
                      >
                        Tutup
                      </button>
                    </div>
                    ) : (
                      <div className="space-y-4">
                        {resetError && (
                          <div className="rounded-xl border border-status-alert/30 bg-status-alert/10 px-4 py-3 text-sm text-status-alert">
                            {resetError}
                          </div>
                        )}

                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                        <input
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            placeholder="your@email.com"
                            className={inputClass}
                            onKeyDown={(e) => e.key === "Enter" && void handleForgotPassword()}
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowForgotPassword(false)}
                            className="flex-1 py-3 rounded-xl border border-border hover:bg-accent transition-all text-sm"
                        >
                            Batal
                        </button>
                        <button
                            onClick={() => void handleForgotPassword()}
                            disabled={resetLoading}
                            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm disabled:opacity-70"
                        >
                            {resetLoading ? "Mengirim..." : "Kirim Email"}
                        </button>
                    </div>
                </div>
                )}
                </motion.div>
        </motion.div>
        )}
      </motion.div>
    </div>
  );
}