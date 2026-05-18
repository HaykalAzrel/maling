import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCw } from "lucide-react";

// ── Hook ──────────────────────────────────────────────────────────────────
export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  threshold = 70
) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (window.scrollY > 0) return;
      const distance = e.touches[0].clientY - touchStartY.current;
      if (distance > 0)
        setPullDistance(Math.min(distance, threshold * 1.5));
    },
    [threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, threshold, refreshing, onRefresh]);

  return {
    refreshing,
    pullDistance,
    threshold,
    // Spread these onto your scroll container
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

// ── Visual Indicator — drop this right below the safe-top spacer ──────────
export function PullIndicator({
  pullDistance,
  refreshing,
  threshold,
}: {
  pullDistance: number;
  refreshing: boolean;
  threshold: number;
}) {
  const progress = Math.min(pullDistance / threshold, 1);
  const triggered = pullDistance >= threshold;

  return (
    <AnimatePresence>
      {(pullDistance > 5 || refreshing) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center justify-center"
          style={{ height: refreshing ? 44 : Math.max(pullDistance * 0.45, 0) }}
        >
          <motion.div
            animate={
              refreshing ? { rotate: 360 } : { rotate: progress * 200 }
            }
            transition={
              refreshing
                ? { repeat: Infinity, duration: 0.75, ease: "linear" }
                : { duration: 0 }
            }
            className={`transition-colors ${
              triggered || refreshing
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <RefreshCw className="w-5 h-5" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Safe-top spacer — reuse this in every page ────────────────────────────
// Guarantees header is NEVER hidden behind the status bar on any Android/iOS.
export const SAFE_TOP: React.CSSProperties = {
  paddingTop: "max(env(safe-area-inset-top, 0px), 3rem)",
};

export function SafeTopSpacer() {
  return <div style={SAFE_TOP} />;
}
