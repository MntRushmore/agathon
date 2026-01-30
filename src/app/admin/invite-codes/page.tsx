'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Copy,
  MoreHorizontal,
  Ticket,
  CheckCircle,
  XCircle,
  Loader2,
  Hash,
  Users,
  Shield,
} from 'lucide-react';
import type { InviteCode } from '@/types/database';

function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export default function AdminInviteCodesPage() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate dialog state
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
    } catch (error) {
      console.error('Failed to fetch codes:', error);
      toast.error('Failed to load invite codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchCodes();
  }, [user]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const effectiveMaxUses = usageType === 'single' ? 1 : usageType === 'unlimited' ? 0 : maxUses;

      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label || null,
          max_uses: effectiveMaxUses,
          expires_at: expiresAt || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate');

      const data = await res.json();
      setGeneratedCode(data.code.code);
      setCodes(prev => [data.code, ...prev]);
      toast.success('Invite code generated!');
    } catch (error) {
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

      setCodes(prev =>
        prev.map(c => c.id === code.id ? { ...c, is_active: !c.is_active } : c)
      );
      toast.success(code.is_active ? 'Code deactivated' : 'Code activated');
    } catch (error) {
      toast.error('Failed to update code');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(formatCode(code));
    toast.success('Code copied to clipboard');
  };

  const resetDialog = () => {
    setLabel('');
    setMaxUses(1);
    setUsageType('single');
    setExpiresAt('');
    setGeneratedCode(null);
  };

  const totalCodes = codes.length;
  const activeCodes = codes.filter(c => c.is_active).length;
  const totalRedemptions = codes.reduce((sum, c) => sum + c.current_uses, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Ticket className="h-6 w-6" />
            Invite Codes
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate and manage signup invite codes
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialog();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Generate Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Invite Code</DialogTitle>
              <DialogDescription>
                Create a new invite code for user signups
              </DialogDescription>
            </DialogHeader>

            {generatedCode ? (
              <div className="space-y-4 py-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Your invite code</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-3xl font-mono font-bold tracking-wider">
                      {formatCode(generatedCode)}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => copyCode(generatedCode)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button className="w-full" onClick={() => {
                  setDialogOpen(false);
                  resetDialog();
                }}>
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Label (optional)</Label>
                  <Input
                    placeholder="e.g. Spring 2026 batch"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Usage limit</Label>
                  <div className="flex gap-2">
                    {(['single', 'multi', 'unlimited'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setUsageType(type)}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                          usageType === type
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-background text-foreground border-border hover:bg-muted'
                        }`}
                      >
                        {type === 'single' ? 'Single use' : type === 'multi' ? 'Multi-use' : 'Unlimited'}
                      </button>
                    ))}
                  </div>
                  {usageType === 'multi' && (
                    <Input
                      type="number"
                      min={2}
                      value={maxUses}
                      onChange={(e) => setMaxUses(parseInt(e.target.value) || 2)}
                      placeholder="Number of uses"
                      className="mt-2"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Expiration (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>

                <Button className="w-full" onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Code'
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <Hash className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCodes}</p>
              <p className="text-sm text-muted-foreground">Total Codes</p>
            </div>
          </div>
        </div>
        <div className="p-5 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Shield className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCodes}</p>
              <p className="text-sm text-muted-foreground">Active Codes</p>
            </div>
          </div>
        </div>
        <div className="p-5 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalRedemptions}</p>
              <p className="text-sm text-muted-foreground">Total Redemptions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-3 text-sm font-medium text-muted-foreground">Code</th>
              <th className="px-5 py-3 text-sm font-medium text-muted-foreground">Label</th>
              <th className="px-5 py-3 text-sm font-medium text-muted-foreground">Uses</th>
              <th className="px-5 py-3 text-sm font-medium text-muted-foreground">Status</th>
              <th className="px-5 py-3 text-sm font-medium text-muted-foreground">Expires</th>
              <th className="px-5 py-3 text-sm font-medium text-muted-foreground">Created</th>
              <th className="px-5 py-3 text-sm font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                  No invite codes yet. Generate your first one!
                </td>
              </tr>
            ) : (
              codes.map((code) => {
                const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                const isMaxed = code.max_uses > 0 && code.current_uses >= code.max_uses;

                return (
                  <tr key={code.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-5 py-4">
                      <span className="font-mono font-medium text-sm">
                        {formatCode(code.code)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {code.label || '\u2014'}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {code.current_uses} / {code.max_uses === 0 ? '\u221E' : code.max_uses}
                    </td>
                    <td className="px-5 py-4">
                      {!code.is_active ? (
                        <Badge variant="secondary">Inactive</Badge>
                      ) : isExpired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : isMaxed ? (
                        <Badge variant="secondary">Used up</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {code.expires_at
                        ? formatDistanceToNow(new Date(code.expires_at), { addSuffix: true })
                        : 'Never'}
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(code.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-5 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => copyCode(code.code)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Code
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(code)}>
                            {code.is_active ? (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
