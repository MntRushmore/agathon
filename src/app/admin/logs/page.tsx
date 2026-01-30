'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ScrollText, RefreshCw, ChevronLeft, ChevronRight, Clock,
  User, Trash2, Shield, Key, Eye, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

interface AuditLog {
  id: string;
  admin_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  target_details: Record<string, any> | null;
  created_at: string;
  admin?: { full_name: string | null; email: string } | null;
}

const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'user_role_change', label: 'Role Changes' },
  { value: 'user_delete', label: 'User Deletions' },
  { value: 'user_impersonate', label: 'Impersonations' },
  { value: 'invite_code_create', label: 'Invite Created' },
  { value: 'invite_code_deactivate', label: 'Invite Deactivated' },
  { value: 'invite_code_activate', label: 'Invite Activated' },
  { value: 'content_delete', label: 'Content Deleted' },
];

const PAGE_SIZE = 50;

export default function AdminLogsPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionFilter, setActionFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(async (page = 1, action = 'all') => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (action !== 'all') params.set('action_type', action);

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (!res.ok) throw new Error('Failed to load logs');
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin') loadLogs(currentPage, actionFilter);
  }, [profile, currentPage, actionFilter, loadLogs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs(currentPage, actionFilter);
    setRefreshing(false);
    toast.success('Logs refreshed');
  };

  const handleFilterChange = (value: string) => {
    setActionFilter(value);
    setCurrentPage(1);
  };

  const getActionIcon = (type: string) => {
    if (type.includes('delete')) return Trash2;
    if (type.includes('role')) return Shield;
    if (type.includes('impersonate')) return Eye;
    if (type.includes('invite')) return Key;
    if (type.includes('content')) return FileText;
    return User;
  };

  const getActionColor = (type: string): string => {
    if (type.includes('delete')) return 'text-red-600 dark:text-red-400';
    if (type.includes('create') || type.includes('activate')) return 'text-green-600 dark:text-green-400';
    if (type.includes('change') || type.includes('modify')) return 'text-blue-600 dark:text-blue-400';
    if (type.includes('impersonate')) return 'text-amber-600 dark:text-amber-400';
    if (type.includes('deactivate')) return 'text-orange-600 dark:text-orange-400';
    return 'text-muted-foreground';
  };

  const formatActionType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getDetailsSummary = (log: AuditLog): string => {
    const d = log.target_details;
    if (!d) return log.target_id.slice(0, 12);

    const parts: string[] = [];
    if (d.email) parts.push(d.email);
    if (d.name) parts.push(d.name);
    if (d.code) parts.push(`Code: ${d.code}`);
    if (d.previous_role && d.new_role) parts.push(`${d.previous_role} → ${d.new_role}`);
    if (d.amount !== undefined) parts.push(`${d.amount > 0 ? '+' : ''}${d.amount} credits`);
    if (d.is_active !== undefined) parts.push(d.is_active ? 'Activated' : 'Deactivated');

    return parts.length > 0 ? parts.join(' · ') : log.target_id.slice(0, 12);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-muted w-48 animate-pulse" />
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">System Logs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{totalCount} total audit log entries</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="rounded-none h-8 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={actionFilter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[200px] rounded-none h-9">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log Entries */}
      <div className="bg-card border border-border divide-y divide-border">
        {logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No log entries found
          </div>
        ) : (
          logs.map((log) => {
            const Icon = getActionIcon(log.action_type);
            return (
              <div key={log.id} className="px-5 py-4 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                <div className={`mt-0.5 ${getActionColor(log.action_type)}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${getActionColor(log.action_type)}`}>
                      {formatActionType(log.action_type)}
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-muted text-muted-foreground uppercase tracking-wider">
                      {log.target_type}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">
                    {getDetailsSummary(log)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    by {log.admin?.full_name || log.admin?.email || 'Unknown'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 tabular-nums">
                    {format(new Date(log.created_at), 'MMM d, HH:mm')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages} ({totalCount} entries)
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
    </div>
  );
}
