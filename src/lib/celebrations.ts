import { sileo } from 'sileo';
import confetti from 'canvas-confetti';

interface MilestoneConfig {
  title: string;
  message: string;
  icon?: string;
  showConfetti?: boolean;
}

const MILESTONES: Record<string, MilestoneConfig> = {
  first_class_joined: {
    title: 'First Class Joined!',
    message: "Great! You joined your first class!",
    icon: '🎉',
    showConfetti: true,
  },
  first_board_created: {
    title: 'First Board Created!',
    message: "Your first board is ready! Let's create something amazing!",
    icon: '✨',
    showConfetti: true,
  },
  first_ai_used: {
    title: 'AI Tutoring Unlocked!',
    message: "Nice! You're making great use of AI tutoring!",
    icon: '🤖',
    showConfetti: false,
  },
  first_assignment_submitted: {
    title: 'Assignment Submitted!',
    message: "Awesome work! Assignment submitted!",
    icon: '🎊',
    showConfetti: true,
  },
  five_boards_created: {
    title: "You're on a roll!",
    message: "5 boards created!",
    icon: '🚀',
    showConfetti: true,
  },
  tutorial_completed: {
    title: 'Tutorial Complete!',
    message: "You're all set! Start exploring and learning!",
    icon: '✅',
    showConfetti: false,
  },
};

// Simple confetti burst
function fireConfetti() {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 10000,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });

  fire(0.2, {
    spread: 60,
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
}

export function celebrateMilestone(milestoneKey: string) {
  const milestone = MILESTONES[milestoneKey];

  if (!milestone) {
    console.warn(`Unknown milestone: ${milestoneKey}`);
    return;
  }

  // Show toast notification
  sileo.success({ title: `${milestone.icon} ${milestone.title}`, description: milestone.message, duration: 4000 });

  // Fire confetti for major milestones
  if (milestone.showConfetti) {
    setTimeout(() => fireConfetti(), 200);
  }
}

export async function checkAndCelebrateMilestone(
  milestoneKey: string,
  achievedMilestones: string[],
  trackMilestone: (milestone: string) => Promise<boolean | undefined>
): Promise<boolean> {
  // Check if already achieved
  if (achievedMilestones.includes(milestoneKey)) {
    return false;
  }

  // Track in database
  const tracked = await trackMilestone(milestoneKey);

  if (tracked) {
    // Celebrate!
    celebrateMilestone(milestoneKey);
    return true;
  }

  return false;
}
