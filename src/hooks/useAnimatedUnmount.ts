import { useState, useEffect, useRef } from 'react';

type AnimationState = 'entering' | 'entered' | 'exiting';

interface UseAnimatedUnmountOptions {
  isOpen: boolean;
  exitDurationMs?: number;
}

export function useAnimatedUnmount({ isOpen, exitDurationMs = 200 }: UseAnimatedUnmountOptions) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animationState, setAnimationState] = useState<AnimationState>(isOpen ? 'entered' : 'exiting');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isOpen) {
      setShouldRender(true);
      setAnimationState('entering');
      // Move to 'entered' on next frame so CSS transitions trigger
      timerRef.current = setTimeout(() => setAnimationState('entered'), 10);
    } else {
      setAnimationState('exiting');
      timerRef.current = setTimeout(() => setShouldRender(false), exitDurationMs);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, exitDurationMs]);

  return { shouldRender, animationState };
}
