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
    bg: 'bg-[#ECFDF5]',
    text: 'text-[#065F46]',
    hover: 'hover:bg-[#D1FAE5]',
  },
  pink: {
    bg: 'bg-[#FDF2F8]',
    text: 'text-[#9D174D]',
    hover: 'hover:bg-[#FCE7F3]',
  },
  blue: {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#1D4ED8]',
    hover: 'hover:bg-[#DBEAFE]',
  },
  orange: {
    bg: 'bg-[#FFF7ED]',
    text: 'text-[#9A3412]',
    hover: 'hover:bg-[#FFEDD5]',
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
