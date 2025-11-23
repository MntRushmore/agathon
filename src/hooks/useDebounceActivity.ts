import { useEffect, useRef } from "react";

/**
 * Hook that detects when the user stops drawing/writing on the canvas
 * for a specified duration (debounce period).
 */
export function useDebounceActivity(
  callback: () => void,
  delay: number = 3000
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    const clearTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    // Set up a new timer, to be called whenever there's activity
    const resetTimer = () => {
      clearTimer();
      timeoutRef.current = setTimeout(() => {
        callback();
      }, delay);
    };

    // Consider basic input events as \"activity\" for debouncing
    const handleActivity = () => {
      resetTimer();
    };

    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("pointermove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("wheel", handleActivity);

    // Initial timer setup
    resetTimer();

    return () => {
      clearTimer();
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("pointermove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("wheel", handleActivity);
    };
  }, [callback, delay]);
}

