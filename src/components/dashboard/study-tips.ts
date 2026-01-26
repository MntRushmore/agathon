// Daily rotating study tips and motivational quotes
export const studyTips = [
  "Break complex problems into smaller steps. You've got this!",
  "The best time to review is right before you forget.",
  "Teaching others is the fastest way to master a concept.",
  "Take a 5-minute break every 25 minutes to stay sharp.",
  "Mistakes are proof that you're trying. Keep going!",
  "Visualize the problem - drawing helps understanding.",
  "Sleep consolidates memory. Rest is part of learning.",
  "Active recall beats passive reading every time.",
  "Struggle is where growth happens. Embrace it.",
  "Consistency beats intensity. Small daily progress wins.",
  "Ask 'why' more than 'what' to deepen understanding.",
  "Your brain is a muscle - the more you use it, the stronger it gets.",
  "Celebrate small wins. Progress is progress.",
  "Confusion is the first step to clarity.",
  "The Feynman Technique: If you can't explain it simply, you don't understand it well enough.",
  "Spaced repetition is your superpower for long-term retention.",
  "Focus on understanding, not memorization.",
  "Write by hand to boost memory and comprehension.",
  "Start with the hardest task when your energy is highest.",
  "Connect new concepts to things you already know.",
  "Review your notes within 24 hours to lock in learning.",
  "Practice problems are more valuable than re-reading.",
  "Your mindset shapes your abilities. Believe in growth.",
  "Curiosity is the engine of achievement.",
  "Learning is not a spectator sport - get actively involved.",
  "Set specific goals for each study session.",
  "The more senses you engage, the better you'll remember.",
  "Take notes in your own words, not verbatim.",
  "Quality of study time matters more than quantity.",
  "Every expert was once a beginner. Keep learning!",
];

export function getDailyTip(): string {
  // Use date to get consistent tip for the day
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return studyTips[dayOfYear % studyTips.length];
}

export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  } else if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  } else if (hour >= 17 && hour < 21) {
    return "Good evening";
  } else {
    return "Good night";
  }
}

export function getFriendlyTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 14) {
    return "Last week";
  } else if (diffDays < 30) {
    return `${Math.floor(diffDays / 7)} weeks ago`;
  } else if (diffDays < 60) {
    return "Last month";
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
