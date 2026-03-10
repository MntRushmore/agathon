'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap,
  ChartBar,
  BookOpenText,
  Plus,
  FileText,
  GearSix,
  CaretLeft,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const teacherNavItems = [
  { href: '/teacher', label: 'Dashboard', icon: ChartBar },
  { href: '/teacher/classes', label: 'My Classes', icon: BookOpenText },
  { href: '/teacher/assignments/create', label: 'New Assignment', icon: Plus },
  { href: '/teacher/templates', label: 'Templates', icon: FileText },
  { href: '/teacher/settings', label: 'Settings', icon: GearSix },
];

export function TeacherSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/teacher') return pathname === '/teacher';
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-52 border-r border-border min-h-screen bg-card fixed left-0 top-0 flex flex-col z-40">
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary flex items-center justify-center rounded-md">
            <GraduationCap weight="duotone" className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">Teacher Panel</span>
        </div>
      </div>

      <nav className="flex-1 py-2">
        {teacherNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors border-r-2',
                active
                  ? 'bg-accent text-foreground border-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground border-transparent'
              )}
            >
              <item.icon weight={active ? 'duotone' : 'regular'} className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <CaretLeft weight="duotone" className="h-4 w-4" />
          Back to App
        </Link>
      </div>
    </aside>
  );
}
