'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { Profile, UserRole } from '@/types/database';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MoreVertical, Search, Eye, Trash2, Shield, GraduationCap,
  Users as UsersIcon, RotateCcw, ChevronLeft, ChevronRight,
  Coins, Plus, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistance } from 'date-fns';

const PAGE_SIZE = 25;

export default function AdminUsersPage() {
  const supabase = createClient();
  const { user, startImpersonation, refreshProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  // Credit dialog
  const [creditDialog, setCreditDialog] = useState<{ open: boolean; userId: string; email: string; currentCredits: number }>({
    open: false, userId: '', email: '', currentCredits: 0,
  });
  const [creditAmount, setCreditAmount] = useState('100');
  const [updatingCredits, setUpdatingCredits] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const targetUser = users.find((u) => u.id === userId);
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
      await supabase.from('admin_audit_logs').insert({
        admin_id: user?.id, action_type: 'user_role_change', target_type: 'user', target_id: userId,
        target_details: { previous_role: targetUser?.role, new_role: newRole, email: targetUser?.email },
      });
      toast.success('Role updated');
      loadUsers();
    } catch {
      toast.error('Failed to update role');
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (userId === user?.id) { toast.error('Cannot delete yourself'); return; }
    if (!confirm(`Delete ${email}? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      await supabase.from('admin_audit_logs').insert({
        admin_id: user?.id, action_type: 'user_delete', target_type: 'user', target_id: userId,
        target_details: { email },
      });
      toast.success('User deleted');
      loadUsers();
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const handleImpersonate = async (userId: string) => {
    if (userId === user?.id) { toast.error('Cannot impersonate yourself'); return; }
    await startImpersonation(userId);
    toast.success('Impersonating user. Use banner to stop.');
  };

  const handleResetOnboarding = async (userId: string, email: string) => {
    if (!confirm(`Reset onboarding for ${email}?`)) return;
    try {
      const { error } = await supabase.from('profiles').update({
        onboarding_completed: false, onboarding_completed_at: null,
        has_completed_board_tutorial: false, milestones_achieved: [],
      }).eq('id', userId);
      if (error) throw error;
      await supabase.from('admin_audit_logs').insert({
        admin_id: user?.id, action_type: 'user_onboarding_reset' as any, target_type: 'user', target_id: userId,
        target_details: { email },
      });
      toast.success('Onboarding reset');
      loadUsers();
    } catch {
      toast.error('Failed to reset onboarding');
    }
  };

  const handleAddCredits = async () => {
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount === 0) { toast.error('Enter a valid amount'); return; }
    setUpdatingCredits(true);
    try {
      const newCredits = creditDialog.currentCredits + amount;
      const { error } = await supabase.from('profiles').update({
        credits: Math.max(0, newCredits), credits_updated_at: new Date().toISOString(),
      }).eq('id', creditDialog.userId);
      if (error) throw error;
      await supabase.from('admin_audit_logs').insert({
        admin_id: user?.id, action_type: 'admin_adjustment' as any, target_type: 'user',
        target_id: creditDialog.userId,
        target_details: { email: creditDialog.email, amount, previous: creditDialog.currentCredits, new: newCredits },
      });
      toast.success(`${amount > 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} credits`);
      setCreditDialog({ open: false, userId: '', email: '', currentCredits: 0 });
      loadUsers();
    } catch {
      toast.error('Failed to update credits');
    } finally {
      setUpdatingCredits(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, roleFilter]);

  const getRoleBadge = (role: UserRole) => {
    const config = {
      student: { cls: 'bg-muted text-muted-foreground', icon: GraduationCap, label: 'Student' },
      teacher: { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: UsersIcon, label: 'Teacher' },
      admin: { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: Shield, label: 'Admin' },
    };
    const { cls, icon: Icon, label } = config[role];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium ${cls}`}>
        <Icon className="h-3 w-3" /> {label}
      </span>
    );
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    return email[0].toUpperCase();
  };

  const roleCounts = useMemo(() => {
    const counts = { all: users.length, student: 0, teacher: 0, admin: 0 };
    users.forEach((u) => { counts[u.role] = (counts[u.role] || 0) + 1; });
    return counts;
  }, [users]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Users</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {users.length} total &middot; {roleCounts.student} students &middot; {roleCounts.teacher} teachers &middot; {roleCounts.admin} admins
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="rounded-none h-8 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-none h-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px] rounded-none h-9">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles ({roleCounts.all})</SelectItem>
            <SelectItem value="student">Students ({roleCounts.student})</SelectItem>
            <SelectItem value="teacher">Teachers ({roleCounts.teacher})</SelectItem>
            <SelectItem value="admin">Admins ({roleCounts.admin})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs uppercase tracking-wider font-semibold">User</TableHead>
              <TableHead className="text-xs uppercase tracking-wider font-semibold">Email</TableHead>
              <TableHead className="text-xs uppercase tracking-wider font-semibold">Role</TableHead>
              <TableHead className="text-xs uppercase tracking-wider font-semibold">Credits</TableHead>
              <TableHead className="text-xs uppercase tracking-wider font-semibold">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wider font-semibold">Joined</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7 rounded-none">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="rounded-none text-xs">{getInitials(u.full_name, u.email)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{u.full_name || 'Unknown'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{getRoleBadge(u.role)}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => setCreditDialog({ open: true, userId: u.id, email: u.email, currentCredits: u.credits || 0 })}
                      className="text-sm tabular-nums hover:underline"
                    >
                      {u.credits || 0}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${u.onboarding_completed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      {u.onboarding_completed ? 'Active' : 'New'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistance(new Date(u.created_at), new Date(), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none">
                        <DropdownMenuItem onClick={() => handleImpersonate(u.id)}>
                          <Eye className="mr-2 h-4 w-4" /> Impersonate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setCreditDialog({ open: true, userId: u.id, email: u.email, currentCredits: u.credits || 0 })}>
                          <Coins className="mr-2 h-4 w-4" /> Adjust Credits
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleRoleChange(u.id, 'student')}>
                          <GraduationCap className="mr-2 h-4 w-4" /> Set Student
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(u.id, 'teacher')}>
                          <UsersIcon className="mr-2 h-4 w-4" /> Set Teacher
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(u.id, 'admin')}>
                          <Shield className="mr-2 h-4 w-4" /> Set Admin
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleResetOnboarding(u.id, u.email)}>
                          <RotateCcw className="mr-2 h-4 w-4" /> Reset Onboarding
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteUser(u.id, u.email)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm" className="rounded-none h-7 w-7 p-0"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-none h-7 w-7 p-0 text-xs"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              );
            })}
            <Button
              variant="outline" size="sm" className="rounded-none h-7 w-7 p-0"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Credit Adjustment Dialog */}
      <Dialog open={creditDialog.open} onOpenChange={(open) => {
        if (!open) setCreditDialog({ open: false, userId: '', email: '', currentCredits: 0 });
      }}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Adjust Credits</DialogTitle>
            <DialogDescription>{creditDialog.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current balance</span>
              <span className="font-semibold tabular-nums">{creditDialog.currentCredits}</span>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Amount to add (negative to deduct)</Label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="rounded-none"
              />
            </div>
            <div className="flex gap-2">
              {[50, 100, 500, 1000].map((amt) => (
                <Button key={amt} variant="outline" size="sm" className="rounded-none text-xs flex-1"
                  onClick={() => setCreditAmount(String(amt))}>
                  +{amt}
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground">New balance</span>
              <span className="font-semibold tabular-nums">
                {Math.max(0, creditDialog.currentCredits + (parseInt(creditAmount) || 0))}
              </span>
            </div>
            <Button className="w-full rounded-none" onClick={handleAddCredits} disabled={updatingCredits}>
              {updatingCredits ? 'Updating...' : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
