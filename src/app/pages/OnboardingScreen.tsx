import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Activity, Bell, Shield, ArrowRight } from "lucide-react";

const slides = [
  {
    icon: Activity,
    title: "Realtime Security Monitoring",
    description: "Monitor your IoT security devices anytime and anywhere.",
  },
  {
    icon: Bell,
    title: "Instant Intrusion Alerts",
    description: "Receive realtime notifications when suspicious movement is detected.",
  },
  {
    icon: Shield,
    title: "Control Devices Easily",
    description: "Manage monitoring schedules and device status directly from your smartphone.",
  },
];

export function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigate("/login");
    }
  };

  const handleSkip = () => {
    navigate("/login");
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3 }}
            className="text-center w-full max-w-[520px]"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-40 h-40 sm:w-48 sm:h-48 mx-auto mb-10 sm:mb-12 bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/20"
            >
              {(() => {
                const IconComponent = slides[currentSlide].icon;
                return IconComponent ? <IconComponent className="w-20 h-20 sm:w-24 sm:h-24 text-primary" /> : null;
              })()}
            </motion.div>

            <h2 className="text-2xl sm:text-3xl mb-4">{slides[currentSlide].title}</h2>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              {slides[currentSlide].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-4 sm:px-6 pb-8">
        <div className="flex gap-2 justify-center mb-8">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index === currentSlide
                  ? "w-8 bg-primary"
                  : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-4 w-full max-w-[520px] mx-auto">
          {currentSlide < slides.length - 1 && (
            <button
              onClick={handleSkip}
              className="px-6 py-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
          >
            {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
