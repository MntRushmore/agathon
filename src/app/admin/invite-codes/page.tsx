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
import { sileo } from 'sileo';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus, Copy, DotsThree, CheckCircle, XCircle, CircleNotch,
  Hash, UsersThree, ShieldCheck, ArrowsClockwise, Timer,
} from '@phosphor-icons/react';
import type { InviteCode } from '@/types/database';

function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

interface TrialUser {
  id: string;
  full_name: string | null;
  role: string;
  trial_expires_at: string;
}

export default function AdminInviteCodesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'codes' | 'trials'>('codes');

  // ── Invite codes state ──
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

  // ── Dev trial state ──
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [trialGenerating, setTrialGenerating] = useState(false);
  const [trialGeneratedCode, setTrialGeneratedCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [trialLabel, setTrialLabel] = useState('');
  const [trialHours, setTrialHours] = useState(24);
  const [activeTrialUsers, setActiveTrialUsers] = useState<TrialUser[]>([]);
  const [trialsLoading, setTrialsLoading] = useState(false);

  const fetchCodes = async () => {
    try {
      const res = await fetch('/api/admin/invite-codes');
      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
      }
    } catch {
      sileo.error({ title: 'Failed to load invite codes' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTrials = async () => {
    setTrialsLoading(true);
    try {
      const res = await fetch('/api/admin/dev-trial');
      if (res.ok) {
        const data = await res.json();
        setActiveTrialUsers(data.active_trial_users || []);
      }
    } catch {
      sileo.error({ title: 'Failed to load trial data' });
    } finally {
      setTrialsLoading(false);
    }
  };

  useEffect(() => { if (user) fetchCodes(); }, [user]);
  useEffect(() => { if (user && tab === 'trials') fetchTrials(); }, [user, tab]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (tab === 'codes') await fetchCodes();
    else await fetchTrials();
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
      sileo.success({ title: 'Invite code generated' });
    } catch {
      sileo.error({ title: 'Failed to generate invite code' });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateTrial = async () => {
    setTrialGenerating(true);
    try {
      const res = await fetch('/api/admin/dev-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trialLabel || undefined, hours: trialHours }),
      });
      if (!res.ok) throw new Error('Failed to generate');
      const data = await res.json();
      setTrialGeneratedCode({ code: data.code, expires_at: data.expires_at });
      sileo.success({ title: 'Dev trial code generated' });
    } catch {
      sileo.error({ title: 'Failed to generate trial code' });
    } finally {
      setTrialGenerating(false);
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
      sileo.success({ title: code.is_active ? 'Code deactivated' : 'Code activated' });
    } catch {
      sileo.error({ title: 'Failed to update code' });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(formatCode(code));
    sileo.success({ title: 'Copied to clipboard' });
  };

  const resetDialog = () => {
    setLabel('');
    setMaxUses(1);
    setUsageType('single');
    setExpiresAt('');
    setGeneratedCode(null);
  };

  const resetTrialDialog = () => {
    setTrialLabel('');
    setTrialHours(24);
    setTrialGeneratedCode(null);
  };

  const regularCodes = codes.filter((c) => !c.is_trial);
  const totalCodes = regularCodes.length;
  const activeCodes = regularCodes.filter((c) => c.is_active).length;
  const totalRedemptions = regularCodes.reduce((sum, c) => sum + c.current_uses, 0);

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
            <ArrowsClockwise weight="duotone" className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {tab === 'codes' && (
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
                        <Input type="number" min={2} max={10000} value={maxUses} onChange={(e) => setMaxUses(Math.min(10000, Math.max(2, parseInt(e.target.value) || 2)))} placeholder="Number of uses" className="mt-2 rounded-none" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Expiration (optional)</Label>
                      <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="rounded-none" />
                    </div>
                    <Button className="w-full rounded-none" onClick={handleGenerate} disabled={generating}>
                      {generating ? (<><CircleNotch weight="duotone" className="h-4 w-4 mr-2 animate-spin" />Generating...</>) : 'Generate Code'}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}

          {tab === 'trials' && (
            <Dialog open={trialDialogOpen} onOpenChange={(open) => { setTrialDialogOpen(open); if (!open) resetTrialDialog(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-none h-8 text-xs gap-1.5">
                  <Timer className="h-3.5 w-3.5" /> New Dev Trial
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-none">
                <DialogHeader>
                  <DialogTitle>Create Dev Trial Access</DialogTitle>
                  <DialogDescription>
                    Generate a single-use code that gives a developer candidate temporary access.
                    Access is automatically revoked when the trial expires.
                  </DialogDescription>
                </DialogHeader>

                {trialGeneratedCode ? (
                  <div className="space-y-4 py-4">
                    <div className="text-center space-y-3">
                      <p className="text-xs text-muted-foreground">Share this code with the candidate</p>
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-3xl font-mono font-bold tracking-wider">{formatCode(trialGeneratedCode.code)}</span>
                        <Button variant="outline" size="icon" onClick={() => copyCode(trialGeneratedCode.code)} className="rounded-none">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="bg-muted px-4 py-2.5 text-xs text-muted-foreground">
                        Expires {formatDistanceToNow(new Date(trialGeneratedCode.expires_at), { addSuffix: true })} &mdash; access auto-revokes on first request after expiry
                      </div>
                    </div>
                    <Button className="w-full rounded-none" onClick={() => { setTrialDialogOpen(false); resetTrialDialog(); fetchTrials(); }}>
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Candidate label (optional)</Label>
                      <Input
                        placeholder="e.g. Jane Smith — frontend"
                        value={trialLabel}
                        onChange={(e) => setTrialLabel(e.target.value)}
                        className="rounded-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Trial duration</Label>
                      <div className="flex gap-px bg-border border border-border">
                        {([12, 24, 48, 72] as const).map((h) => (
                          <button
                            key={h}
                            onClick={() => setTrialHours(h)}
                            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                              trialHours === h ? 'bg-foreground text-background' : 'bg-card text-foreground hover:bg-muted'
                            }`}
                          >
                            {h}h
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button className="w-full rounded-none" onClick={handleGenerateTrial} disabled={trialGenerating}>
                      {trialGenerating
                        ? (<><CircleNotch weight="duotone" className="h-4 w-4 mr-2 animate-spin" />Generating...</>)
                        : `Generate ${trialHours}h Trial Code`}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-px bg-border border border-border w-fit">
        {(['codes', 'trials'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-foreground text-background' : 'bg-card text-foreground hover:bg-muted'
            }`}
          >
            {t === 'codes' ? 'Invite Codes' : 'Dev Trials'}
          </button>
        ))}
      </div>

      {tab === 'codes' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
            {[
              { label: 'Total Codes', value: totalCodes, icon: Hash },
              { label: 'Active', value: activeCodes, icon: ShieldCheck },
              { label: 'Redemptions', value: totalRedemptions, icon: UsersThree },
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
                {regularCodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-muted-foreground text-sm">
                      No invite codes yet. Generate your first one.
                    </td>
                  </tr>
                ) : regularCodes.map((code) => {
                  const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                  const isMaxed = code.max_uses > 0 && code.current_uses >= code.max_uses;

                  const statusText = !code.is_active ? 'Inactive' : isExpired ? 'Expired' : isMaxed ? 'Used up' : 'Active';
                  const statusColor = !code.is_active ? 'text-muted-foreground' : isExpired ? 'text-red-600' : isMaxed ? 'text-muted-foreground' : 'text-green-600';

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
                              <DotsThree weight="duotone" className="h-4 w-4" />
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
        </>
      )}

      {tab === 'trials' && (
        <div className="space-y-6">
          {/* Active trial users */}
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Timer weight="duotone" className="h-4 w-4" />
              Active Trial Users
            </h2>
            <div className="bg-card border border-border overflow-hidden">
              {trialsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-4 w-4 border-2 border-foreground/20 border-t-foreground animate-spin" />
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">Name</th>
                      <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">Role</th>
                      <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">Trial expires</th>
                      <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTrialUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground text-sm">
                          No active trial users. Create a dev trial code to get started.
                        </td>
                      </tr>
                    ) : activeTrialUsers.map((u) => {
                      const expiresDate = new Date(u.trial_expires_at);
                      const hoursLeft = Math.max(0, (expiresDate.getTime() - Date.now()) / 1000 / 3600);
                      const isExpiringSoon = hoursLeft < 4;

                      return (
                        <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3.5 text-sm font-medium">{u.full_name || 'Unknown'}</td>
                          <td className="px-5 py-3.5 text-sm text-muted-foreground capitalize">{u.role}</td>
                          <td className="px-5 py-3.5 text-sm text-muted-foreground">
                            {formatDistanceToNow(expiresDate, { addSuffix: true })}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-xs font-medium ${isExpiringSoon ? 'text-amber-600' : 'text-green-600'}`}>
                              {isExpiringSoon ? `Expiring soon (${hoursLeft.toFixed(1)}h)` : 'Active'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
