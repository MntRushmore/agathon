'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { width: 32, height: 32 },
  md: { width: 40, height: 40 },
  lg: { width: 80, height: 80 },
};

export function Logo({ size = 'md', showText = false, className }: LogoProps) {
  const { width, height } = sizeConfig[size];

  if (showText) {
    // Use the wide logo with text
    return (
      <div className={cn('flex items-center', className)}>
        <Image
          src="/logo/agathonwide.png"
          alt="Agathon"
          width={width * 3}
          height={height}
          className="h-auto"
          style={{ width: 'auto', height: size === 'sm' ? 24 : size === 'md' ? 32 : 48 }}
          priority
        />
      </div>
    );
  }

  // Use the square logo (agathon.png is light bg, agathon1.png is dark bg)
  return (
    <div className={cn('flex items-center', className)}>
      {/* Light mode: show dark logo (agathon1.png - white A on black) */}
      <Image
        src="/logo/agathon1.png"
        alt="Agathon"
        width={width}
        height={height}
        className="dark:hidden rounded-lg"
        style={{ width, height }}
        priority
      />
      {/* Dark mode: show light logo (agathon.png - black A on white) */}
      <Image
        src="/logo/agathon.png"
        alt="Agathon"
        width={width}
        height={height}
        className="hidden dark:block rounded-lg"
        style={{ width, height }}
        priority
      />
    </div>
  );
}

export function LogoIcon({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/logo/agathon1.png"
        alt="Agathon"
        width={size}
        height={size}
        className="dark:hidden rounded-lg"
        style={{ width: size, height: size }}
      />
      <Image
        src="/logo/agathon.png"
        alt="Agathon"
        width={size}
        height={size}
        className="hidden dark:block rounded-lg"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
