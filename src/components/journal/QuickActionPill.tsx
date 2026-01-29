'use client';

import { cn } from '@/lib/utils';

interface QuickActionPillProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: 'green' | 'pink' | 'blue' | 'orange';
  className?: string;
}

const variantStyles = {
  green: {
    bg: 'bg-[#D4DFC8]',
    text: 'text-[#3A5530]',
    hover: 'hover:bg-[#C4D0B4]',
  },
  pink: {
    bg: 'bg-[#F0DCD0]',
    text: 'text-[#7A3520]',
    hover: 'hover:bg-[#E4CCC0]',
  },
  blue: {
    bg: 'bg-[#C8D8E8]',
    text: 'text-[#1A4A7A]',
    hover: 'hover:bg-[#B8C8D8]',
  },
  orange: {
    bg: 'bg-[#F5E8C8]',
    text: 'text-[#7A5A15]',
    hover: 'hover:bg-[#E8D8B0]',
  },
};

export function QuickActionPill({
  icon,
  label,
  onClick,
  variant = 'green',
  className,
}: QuickActionPillProps) {
  const styles = variantStyles[variant];

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full',
        'text-sm font-medium transition-all duration-200',
        'active:scale-95 touch-manipulation',
        styles.bg,
        styles.text,
        styles.hover,
        className
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
