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
    bg: 'bg-[#e0f7ec]',
    text: 'text-[#166534]',
    hover: 'hover:bg-[#d0f0e0]',
  },
  pink: {
    bg: 'bg-[#fce4ec]',
    text: 'text-[#9a1b30]',
    hover: 'hover:bg-[#f8d0d8]',
  },
  blue: {
    bg: 'bg-[#e0f2f7]',
    text: 'text-[#007ba5]',
    hover: 'hover:bg-[#cce9f0]',
  },
  orange: {
    bg: 'bg-[#fff3e0]',
    text: 'text-[#b36b00]',
    hover: 'hover:bg-[#ffe8cc]',
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
