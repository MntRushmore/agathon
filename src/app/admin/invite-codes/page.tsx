'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus, Copy, MoreHorizontal, Ticket, CheckCircle, XCircle, Loader2,
  Hash, Users, Shield, RefreshCw,
} from 'lucide-react';
import type { InviteCode } from '@/types/database';

function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export default function AdminInviteCodesPage() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [usageType, setUsageType] = useState<'single' | 'multi' | 'unlimited'>('single');
  const [expiresAt, setExpiresAt] = useState('');

  const fetchCodes = async () => {
    try {
      const res = await fetch('/api/admin/invite-codes');
      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
      }
    } catch {
      toast.error('Failed to load invite codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) fetchCodes(); }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCodes();
    setRefreshing(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const effectiveMaxUses = usageType === 'single' ? 1 : usageType === 'unlimited' ? 0 : maxUses;
      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label || null, max_uses: effectiveMaxUses, expires_at: expiresAt || null }),
      });
      if (!res.ok) throw new Error('Failed to generate');
      const data = await res.json();
      setGeneratedCode(data.code.code);
      setCodes((prev) => [data.code, ...prev]);
      toast.success('Invite code generated');
    } catch {
      toast.error('Failed to generate invite code');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleActive = async (code: InviteCode) => {
    try {
      const res = await fetch('/api/admin/invite-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: code.id, is_active: !code.is_active }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setCodes((prev) => prev.map((c) => (c.id === code.id ? { ...c, is_active: !c.is_active } : c)));
      toast.success(code.is_active ? 'Code deactivated' : 'Code activated');
    } catch {
      toast.error('Failed to update code');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(formatCode(code));
    toast.success('Copied to clipboard');
  };

  const resetDialog = () => {
    setLabel('');
    setMaxUses(1);
    setUsageType('single');
    setExpiresAt('');
    setGeneratedCode(null);
  };

  const totalCodes = codes.length;
  const activeCodes = codes.filter((c) => c.is_active).length;
  const totalRedemptions = codes.reduce((sum, c) => sum + c.current_uses, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Invite Codes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Generate and manage signup invite codes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="rounded-none h-8 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetDialog(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-none h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Generate Code
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-none">
              <DialogHeader>
                <DialogTitle>Generate Invite Code</DialogTitle>
                <DialogDescription>Create a new invite code for user signups</DialogDescription>
              </DialogHeader>

              {generatedCode ? (
                <div className="space-y-4 py-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-2">Your invite code</p>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-3xl font-mono font-bold tracking-wider">{formatCode(generatedCode)}</span>
                      <Button variant="outline" size="icon" onClick={() => copyCode(generatedCode)} className="rounded-none">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button className="w-full rounded-none" onClick={() => { setDialogOpen(false); resetDialog(); }}>
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Label (optional)</Label>
                    <Input placeholder="e.g. Spring 2026 batch" value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Usage limit</Label>
                    <div className="flex gap-px bg-border border border-border">
                      {(['single', 'multi', 'unlimited'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setUsageType(type)}
                          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                            usageType === type ? 'bg-foreground text-background' : 'bg-card text-foreground hover:bg-muted'
                          }`}
                        >
                          {type === 'single' ? 'Single use' : type === 'multi' ? 'Multi-use' : 'Unlimited'}
                        </button>
                      ))}
                    </div>
                    {usageType === 'multi' && (
                      <Input type="number" min={2} value={maxUses} onChange={(e) => setMaxUses(parseInt(e.target.value) || 2)} placeholder="Number of uses" className="mt-2 rounded-none" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Expiration (optional)</Label>
                    <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="rounded-none" />
                  </div>
                  <Button className="w-full rounded-none" onClick={handleGenerate} disabled={generating}>
                    {generating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>) : 'Generate Code'}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
        {[
          { label: 'Total Codes', value: totalCodes, icon: Hash },
          { label: 'Active', value: activeCodes, icon: Shield },
          { label: 'Redemptions', value: totalRedemptions, icon: Users },
        ].map((s) => (
          <div key={s.label} className="bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-semibold mt-1.5 tabular-nums">{s.value}</p>
              </div>
              <s.icon className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">Code</th>
              <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">Label</th>
              <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">Uses</th>
              <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">Status</th>
              <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">Expires</th>
              <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">Created</th>
              <th className="px-5 py-3 w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-muted-foreground text-sm">
                  No invite codes yet. Generate your first one.
                </td>
              </tr>
            ) : codes.map((code) => {
              const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
              const isMaxed = code.max_uses > 0 && code.current_uses >= code.max_uses;

              const statusText = !code.is_active ? 'Inactive' : isExpired ? 'Expired' : isMaxed ? 'Used up' : 'Active';
              const statusColor = !code.is_active ? 'text-muted-foreground' : isExpired ? 'text-red-600 dark:text-red-400' : isMaxed ? 'text-muted-foreground' : 'text-green-600 dark:text-green-400';

              return (
                <tr key={code.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <button onClick={() => copyCode(code.code)} className="font-mono font-medium text-sm hover:underline" title="Click to copy">
                      {formatCode(code.code)}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{code.label || '\u2014'}</td>
                  <td className="px-5 py-3.5 text-sm tabular-nums">
                    {code.current_uses} / {code.max_uses === 0 ? '\u221E' : code.max_uses}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium ${statusColor}`}>{statusText}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">
                    {code.expires_at ? formatDistanceToNow(new Date(code.expires_at), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(code.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-5 py-3.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none">
                        <DropdownMenuItem onClick={() => copyCode(code.code)}>
                          <Copy className="mr-2 h-4 w-4" /> Copy Code
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(code)}>
                          {code.is_active ? (
                            <><XCircle className="mr-2 h-4 w-4" /> Deactivate</>
                          ) : (
                            <><CheckCircle className="mr-2 h-4 w-4" /> Activate</>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
