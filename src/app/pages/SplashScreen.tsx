import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Shield } from "lucide-react";
import { motion } from "motion/react";

export function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/onboarding");
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-[#0f1421] to-background flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(79,124,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(79,124,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center z-10"
      >
        <motion.div
          animate={{
            boxShadow: [
              "0 0 20px var(--glow-primary)",
              "0 0 60px var(--glow-primary)",
              "0 0 20px var(--glow-primary)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-32 h-32 mx-auto mb-8 bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/30"
        >
          <Shield className="w-16 h-16 text-primary" />
        </motion.div>

        <h1 className="text-4xl mb-2 tracking-tight">SecureSense</h1>
        <p className="text-muted-foreground text-lg">Smart IoT Security Monitoring</p>

        <motion.div
          className="mt-12 flex gap-2 justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
            className="w-2 h-2 rounded-full bg-primary"
          />
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            className="w-2 h-2 rounded-full bg-primary"
          />
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            className="w-2 h-2 rounded-full bg-primary"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
