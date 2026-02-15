'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Profile } from '@/types/database';
import { X, Search, ArrowLeftRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_SESSION_KEY = 'agathon_admin_session';
const SWITCH_ACTIVE_KEY = 'agathon_switch_active';

function getSavedAdminSession() {
  if (typeof window === 'undefined') return null;
  const saved = sessionStorage.getItem(ADMIN_SESSION_KEY);
  return saved ? JSON.parse(saved) : null;
}

function isSessionSwitchActive() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SWITCH_ACTIVE_KEY) === 'true';
}

export function ImpersonationBar() {
  const { user, profile } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [isSwitched, setIsSwitched] = useState(isSessionSwitchActive);

  // Determine if the real user (or the saved admin session) is an admin
  const savedSession = getSavedAdminSession();
  const isRealAdmin = isSwitched ? !!savedSession : profile?.role === 'admin';

  if (!isRealAdmin || !user) return null;

  const handleSwitch = async (targetUserId: string) => {
    setSwitching(true);
    try {
      const supabase = createClient();

      // Save the current admin session before switching (only if not already switched)
      if (!isSwitched) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }));
        }
      }

      // Request a sign-in token for the target user
      // If already switched, send the saved admin access token for authorization
      const saved = getSavedAdminSession();
      const res = await fetch('/api/admin/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          ...(isSwitched && saved?.access_token ? { adminAccessToken: saved.access_token } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to switch');
      }

      const { token_hash } = await res.json();

      // Sign in as the target user using the magic link token
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'magiclink',
      });

      if (error) throw error;

      sessionStorage.setItem(SWITCH_ACTIVE_KEY, 'true');
      setIsSwitched(true);
      setSwitcherOpen(false);

      // Reload so all components pick up the new session
      window.location.reload();
    } catch (err) {
      console.error('Switch error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to switch user');
    } finally {
      setSwitching(false);
    }
  };

  const handleExit = async () => {
    const saved = getSavedAdminSession();
    if (!saved) {
      toast.error('No admin session saved');
      return;
    }

    try {
      const supabase = createClient();

      // Restore the admin session
      const { error } = await supabase.auth.setSession({
        access_token: saved.access_token,
        refresh_token: saved.refresh_token,
      });

      if (error) throw error;

      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem(SWITCH_ACTIVE_KEY);
      sessionStorage.removeItem('agathon_impersonating');
      sessionStorage.removeItem('agathon_impersonated_profile');

      window.location.reload();
    } catch (err) {
      console.error('Exit error:', err);
      toast.error('Failed to restore admin session. Try signing in again.');
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem(SWITCH_ACTIVE_KEY);
    }
  };

  // When switched: show the banner
  if (isSwitched && !switcherOpen) {
    return (
      <>
        <div className="bg-amber-500 text-white px-4 py-1.5 text-center text-sm font-medium flex items-center justify-center gap-3 z-50 relative">
          <span>
            Signed in as <strong>{profile?.full_name || profile?.email || 'another user'}</strong>
            {profile?.role && <span className="ml-1.5 opacity-80">({profile.role})</span>}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSwitcherOpen(true)}
            className="border-white/40 text-white hover:bg-white/10 h-6 text-xs px-2"
          >
            <ArrowLeftRight className="h-3 w-3 mr-1" />
            Switch
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExit}
            className="border-white/40 text-white hover:bg-white/10 h-6 text-xs px-2"
          >
            <X className="h-3 w-3 mr-1" />
            Back to Admin
          </Button>
        </div>

        {switcherOpen && (
          <ProfileSwitcher
            currentUserId={user.id}
            onSwitch={handleSwitch}
            onStop={handleExit}
            onClose={() => setSwitcherOpen(false)}
            switching={switching}
          />
        )}
      </>
    );
  }

  // When not switched: show the floating trigger button
  if (!switcherOpen) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <Button
          size="sm"
          variant="outline"
          className="shadow-lg bg-background border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 text-amber-700 dark:text-amber-400 gap-2"
          onClick={() => setSwitcherOpen(true)}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Switch Profile
        </Button>
      </div>
    );
  }

  return (
    <ProfileSwitcher
      currentUserId={user.id}
      onSwitch={handleSwitch}
      onStop={isSwitched ? handleExit : undefined}
      onClose={() => setSwitcherOpen(false)}
      switching={switching}
    />
  );
}

function ProfileSwitcher({
  currentUserId,
  onSwitch,
  onStop,
  onClose,
  switching,
}: {
  currentUserId: string;
  onSwitch: (userId: string) => void;
  onStop?: () => void;
  onClose: () => void;
  switching: boolean;
}) {
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    loadUsers();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Try the admin API first (works even when switched to a non-admin)
      const res = await fetch('/api/admin/switch-user/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setLoading(false);
        return;
      }
    } catch {
      // fall through to direct query
    }
    // Fallback: direct Supabase query (works when signed in as admin)
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .order('role', { ascending: true })
      .order('full_name', { ascending: true })
      .limit(50);
    setUsers((data as Profile[]) || []);
    setLoading(false);
  };

  const filtered = search.trim()
    ? users.filter(
        (u) =>
          u.email?.toLowerCase().includes(search.toLowerCase()) ||
          u.full_name?.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const roleOrder = { admin: 0, teacher: 1, student: 2 };
  const grouped = filtered.reduce<Record<string, Profile[]>>((acc, u) => {
    const role = u.role || 'student';
    if (!acc[role]) acc[role] = [];
    acc[role].push(u);
    return acc;
  }, {});

  const sortedRoles = Object.keys(grouped).sort(
    (a, b) => (roleOrder[a as keyof typeof roleOrder] ?? 3) - (roleOrder[b as keyof typeof roleOrder] ?? 3)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/20">
      <div
        ref={panelRef}
        className="bg-background border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className="p-3 border-b flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name or email..."
            className="border-0 shadow-none focus-visible:ring-0 h-8 px-0"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
          ) : (
            sortedRoles.map((role) => (
              <div key={role}>
                <div className="px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider sticky top-0">
                  {role}s
                </div>
                {grouped[role].map((u) => (
                  <button
                    key={u.id}
                    disabled={switching || u.id === currentUserId}
                    onClick={() => onSwitch(u.id)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                      {(u.full_name || u.email)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {u.full_name || 'No name'}
                        {u.id === currentUserId && (
                          <span className="text-xs text-muted-foreground ml-1.5">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {onStop && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
              onClick={onStop}
            >
              Return to admin profile
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
