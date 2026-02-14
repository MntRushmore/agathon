'use client';

import { useState, useEffect, useRef } from 'react';
import { TutorialTooltip } from './TutorialTooltip';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface FirstBoardTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

const TUTORIAL_STEPS = [
  {
    id: 'canvas',
    title: 'Welcome to your whiteboard!',
    description: 'This is your infinite canvas. Draw, write, or add shapes anywhere. Try drawing something to get started!',
    targetSelector: '.tl-background',
    position: 'bottom' as const,
  },
  {
    id: 'ai-modes',
    title: 'Choose your AI assistance level',
    description: 'Select how much help you want: Off (no AI), Feedback (hints), Suggest (guided steps), or Answer (full solution).',
    targetSelector: '[data-tutorial="ai-mode-selector"]',
    position: 'bottom' as const,
  },
  {
    id: 'chat',
    title: 'Ask the AI tutor anything',
    description: 'Stuck? Click here to open the chat panel and ask questions about your work!',
    targetSelector: '[data-tutorial="chat-button"]',
    position: 'left' as const,
  },
  {
    id: 'toolbar',
    title: 'Drawing tools',
    description: 'Use these tools to add shapes, text, sticky notes, and images to your canvas.',
    targetSelector: '.tlui-toolbar',
    position: 'bottom' as const,
  },
  {
    id: 'complete',
    title: "You're all set!",
    description: 'Your work auto-saves every few seconds. Start exploring and learning!',
    targetSelector: null,
    position: 'bottom' as const,
  },
];

export function FirstBoardTutorial({ onComplete, onSkip }: FirstBoardTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElements, setTargetElements] = useState<Record<string, HTMLElement | null>>({});
  const supabase = createClient();

  useEffect(() => {
    // Find all target elements
    const elements: Record<string, HTMLElement | null> = {};
    TUTORIAL_STEPS.forEach((step) => {
      if (step.targetSelector) {
        const element = document.querySelector(step.targetSelector) as HTMLElement;
        elements[step.id] = element;
      }
    });
    setTargetElements(elements);

    // Retry finding elements after a delay (for dynamically loaded content)
    const timeout = setTimeout(() => {
      const retryElements: Record<string, HTMLElement | null> = {};
      TUTORIAL_STEPS.forEach((step) => {
        if (step.targetSelector && !elements[step.id]) {
          const element = document.querySelector(step.targetSelector) as HTMLElement;
          retryElements[step.id] = element;
        }
      });
      setTargetElements((prev) => ({ ...prev, ...retryElements }));
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    // Mark tutorial as complete in database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ has_completed_board_tutorial: true })
          .eq('id', user.id);

        // Also store in localStorage
        localStorage.setItem('board_tutorial_completed', 'true');

        toast.success('Tutorial completed! 🎉');
      }
    } catch (error) {
      console.error('Error marking tutorial complete:', error);
    }

    onComplete();
  };

  const handleSkip = async () => {
    // Mark as skipped (same as complete - they chose not to see it)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ has_completed_board_tutorial: true })
          .eq('id', user.id);

        localStorage.setItem('board_tutorial_completed', 'true');
      }
    } catch (error) {
      console.error('Error marking tutorial skipped:', error);
    }

    onSkip();
  };

  const currentStepData = TUTORIAL_STEPS[currentStep];
  const targetElement = currentStepData.targetSelector
    ? targetElements[currentStepData.id]
    : null;

  // Don't show tooltip if target element not found (except for final step)
  if (currentStepData.targetSelector && !targetElement) {
    return null;
  }

  // Create ref for the target element
  const targetRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    targetRef.current = targetElement;
  }, [targetElement]);

  return (
    <TutorialTooltip
      show={true}
      title={currentStepData.title}
      description={currentStepData.description}
      position={currentStepData.position}
      targetRef={targetElement ? (targetRef as React.RefObject<HTMLElement>) : undefined}
      onNext={handleNext}
      onSkip={handleSkip}
      nextLabel={currentStep === TUTORIAL_STEPS.length - 1 ? 'Start Working!' : 'Next'}
      step={currentStep + 1}
      totalSteps={TUTORIAL_STEPS.length}
      highlightTarget={!!currentStepData.targetSelector}
    />
  );
}
