'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth/auth-provider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, Trash2, Eye, Edit3, UserIcon } from 'lucide-react';
import type { Profile, BoardShare } from '@/types/database';

interface ShareBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  boardTitle: string;
}

type ShareWithProfile = BoardShare & {
  profiles: Profile;
};

export function ShareBoardDialog({
  open,
  onOpenChange,
  boardId,
  boardTitle,
}: ShareBoardDialogProps) {
  const { user } = useAuth();
  const supabase = createClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [existingShares, setExistingShares] = useState<ShareWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<'view' | 'edit'>('view');

  // Fetch existing shares when dialog opens
  useEffect(() => {
    if (open && boardId) {
      fetchExistingShares();
    }
  }, [open, boardId]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      await searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function fetchExistingShares() {
    try {
      const { data, error } = await supabase
        .from('board_shares')
        .select(`
          *,
          profiles!shared_with_user_id (
            id,
            full_name,
            email,
            role,
            avatar_url
          )
        `)
        .eq('board_id', boardId);

      if (error) throw error;
      setExistingShares((data as ShareWithProfile[]) || []);
    } catch (error) {
      console.error('Error fetching shares:', error);
      toast.error('Failed to load existing shares');
    }
  }

  async function searchUsers(query: string) {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
        .neq('id', user?.id) // Exclude current user
        .limit(5);

      if (error) throw error;

      // Filter out users who already have access
      const sharedUserIds = existingShares.map(s => s.shared_with_user_id);
      const filteredResults = (data || []).filter(u => !sharedUserIds.includes(u.id));

      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    } finally {
      setSearching(false);
    }
  }

  async function shareBoard(userId: string) {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('board_shares')
        .insert([{
          board_id: boardId,
          shared_with_user_id: userId,
          permission: selectedPermission,
          created_by: user.id,
        }]);

      if (error) throw error;

      toast.success(`Board shared with ${selectedPermission} permission`);

      // Refresh shares list
      await fetchExistingShares();

      // Clear search
      setSearchQuery('');
      setSearchResults([]);
    } catch (error: any) {
      console.error('Error sharing board:', error);
      if (error.code === '23505') {
        toast.error('This board is already shared with this user');
      } else {
        toast.error('Failed to share board');
      }
    } finally {
      setLoading(false);
    }
  }

  async function removeShare(shareId: string) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('board_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;

      toast.success('Access removed');

      // Refresh shares list
      await fetchExistingShares();
    } catch (error) {
      console.error('Error removing share:', error);
      toast.error('Failed to remove access');
    } finally {
      setLoading(false);
    }
  }

  const getInitials = (name: string | null, email: string) => {
    if (!name) return email.substring(0, 2).toUpperCase();
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share &quot;{boardTitle}&quot;</DialogTitle>
          <DialogDescription>
            Share this board with other users via email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Section */}
          <div className="space-y-2">
            <Label htmlFor="search">Search by email or name</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Enter email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Search Results */}
            {searchQuery && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {searching ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="divide-y">
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center justify-between p-3 hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-primary">
                              {getInitials(result.full_name, result.email)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {result.full_name || result.email}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {result.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedPermission}
                            onChange={(e) => setSelectedPermission(e.target.value as 'view' | 'edit')}
                            className="text-xs border rounded px-2 py-1"
                            disabled={loading}
                          >
                            <option value="view">View</option>
                            <option value="edit">Edit</option>
                          </select>
                          <Button
                            size="sm"
                            onClick={() => shareBoard(result.id)}
                            disabled={loading}
                          >
                            Share
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No users found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Existing Shares */}
          {existingShares.length > 0 && (
            <div className="space-y-2">
              <Label>People with access</Label>
              <div className="border rounded-lg divide-y">
                {existingShares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-primary">
                          {getInitials(share.profiles.full_name, share.profiles.email)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {share.profiles.full_name || share.profiles.email}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {share.profiles.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {share.permission === 'edit' ? (
                          <>
                            <Edit3 className="w-3 h-3" />
                            <span>Can edit</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Can view</span>
                          </>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeShare(share.id)}
                        disabled={loading}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {existingShares.length === 0 && !searchQuery && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <UserIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No one has access yet</p>
              <p className="text-xs mt-1">Search for users to share this board</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
