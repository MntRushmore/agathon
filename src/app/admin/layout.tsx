'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { sileo } from 'sileo';
import {
  ShieldCheck,
  UsersThree,
  FileText,
  ChartBar,
  CaretLeft,
  Ticket,
  Pulse,
  Scroll,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { href: '/admin', label: 'Overview', icon: ChartBar },
  { href: '/admin/users', label: 'Users', icon: UsersThree },
  { href: '/admin/content', label: 'Content', icon: FileText },
  { href: '/admin/analytics', label: 'Analytics', icon: Pulse },
  { href: '/admin/invite-codes', label: 'Invite Codes', icon: Ticket },
  { href: '/admin/logs', label: 'System Logs', icon: Scroll },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, isImpersonating, stopImpersonation } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/?auth=required');
        setAuthChecked(true);
        return;
      }

      if (user && !profile) {
        return;
      }

      if (profile?.role !== 'admin') {
        sileo.error({ title: 'Access denied. Admin privileges required.' });
        router.push('/?error=admin_only');
      }

      setAuthChecked(true);
    }
  }, [user, profile, loading, router]);

  const isLoading = loading || (user && !profile) || !authChecked;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground animate-spin" />
          <p className="mt-4 text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user || profile?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border min-h-screen bg-card fixed left-0 top-0 flex flex-col">
          <div className="px-4 py-5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-foreground flex items-center justify-center">
                <ShieldCheck weight="duotone" className="h-3.5 w-3.5 text-background" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-foreground">Admin Panel</span>
            </div>
          </div>

          <nav className="flex-1 py-2">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors border-r-2',
                    isActive
                      ? 'bg-accent text-foreground border-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground border-transparent'
                  )}
                >
                  <item.icon className="h-4 w-4" />
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

        {/* Main Content */}
        <main className="flex-1 ml-52">
          <div className="max-w-[1100px] mx-auto px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
