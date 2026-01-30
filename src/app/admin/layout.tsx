'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { toast } from 'sonner';
import { Shield, Users, FileText, BarChart3, ChevronLeft, Ticket } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { href: '/admin', label: 'Overview', icon: BarChart3 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/content', label: 'Content', icon: FileText },
  { href: '/admin/invite-codes', label: 'Invite Codes', icon: Ticket },
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
          <p className="mt-4 text-muted-foreground">Verifying access...</p>
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
        <div className="bg-amber-100 border-b border-amber-200 text-amber-800 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-4">
          <span>You are viewing as another user</span>
          <Button
            variant="outline"
            size="sm"
            onClick={stopImpersonation}
            className="border-amber-300 hover:bg-amber-50"
          >
            Exit
          </Button>
        </div>
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border min-h-screen bg-card fixed left-0 top-0 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                <Shield className="h-4 w-4 text-background" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Admin</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Back to App */}
          <div className="p-3 border-t border-border">
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to App
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-56">
          <div className="max-w-6xl mx-auto p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
