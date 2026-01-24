'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  User,
  Coins,
  Mail,
  Shield,
  Loader2,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) {
      router.push('/?auth=required');
    }
  }, [user, router]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.97_0.01_210)] via-background to-background">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold">Settings</h1>
            <p className="text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>

        {/* Account Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              Your basic account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </Label>
              <Input value={user.email || ''} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label>Role</Label>
              <Badge variant="outline" className="capitalize">
                <Shield className="h-3 w-3 mr-1" />
                {profile.role}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Credits Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              AI Credits
            </CardTitle>
            <CardDescription>
              Your credit balance for premium AI features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-3xl font-bold">{profile.credits ?? 0}</p>
                <p className="text-xs text-muted-foreground">credits available</p>
              </div>
              <Button onClick={() => router.push('/credits')}>
                Manage Credits
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Credits are used for premium AI features like image understanding and canvas analysis.
              When you run out, you&apos;ll still have access to text-only AI assistance.
            </p>
          </CardContent>
        </Card>

        {/* Plan Info */}
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              Your subscription status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Badge variant={profile.plan_tier === 'premium' ? 'default' : 'secondary'}>
                  {profile.plan_tier === 'premium' ? 'Premium' : profile.plan_tier === 'free' ? 'Free' : profile.plan_tier || 'Free'}
                </Badge>
                {profile.plan_status && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Status: {profile.plan_status}
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={() => router.push('/billing')}>
                View Plans
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
