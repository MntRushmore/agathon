'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { toast } from 'sonner';
import { Shield, Users, FileText, BarChart3, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/content', label: 'Content', icon: FileText },
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
        return; // Profile still loading
      }

      if (profile?.role !== 'admin') {
        toast.error('Access denied. Admin privileges required.');
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!user || profile?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-4">
          <span>You are impersonating a user</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={stopImpersonation}
          >
            Stop Impersonating
          </Button>
        </div>
      )}

      {/* Admin Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Admin Console</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to App
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r min-h-[calc(100vh-65px)] bg-card">
          <nav className="p-4 space-y-1">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-200 dark:shadow-none'
                        : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive ? "text-white" : "text-zinc-400")} />
                    {item.label}
                  </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
