'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeBoardProps {
  boardId: string;
  userId: string;
  onBoardUpdate?: (data: any) => void;
}

interface ActiveUser {
  userId: string;
  userName: string;
  lastSeen: string;
}

export function useRealtimeBoard({ boardId, userId, onBoardUpdate }: UseRealtimeBoardProps) {
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!boardId || !userId) return;

    // Create a channel for this board
    const channel = supabase.channel(`board:${boardId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channelRef.current = channel;

    // Subscribe to board updates
    channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whiteboards',
        filter: `id=eq.${boardId}`,
      }, (payload) => {
        console.log('Board updated remotely:', payload);

        // Only notify if update was from another user
        if (onBoardUpdate) {
          onBoardUpdate(payload.new);
        }
      })
      // Track presence (who's online)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: ActiveUser[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key];
          if (presences && presences.length > 0) {
            const presence = presences[0] as any;
            users.push({
              userId: key,
              userName: presence.userName || 'Anonymous',
              lastSeen: presence.lastSeen || new Date().toISOString(),
            });
          }
        });

        setActiveUsers(users);
      })
      .subscribe(async (status) => {
        console.log('Realtime subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');

        if (status === 'SUBSCRIBED') {
          // Track our presence
          const { data: { user } } = await supabase.auth.getUser();
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();

          await channel.track({
            userId,
            userName: profile?.full_name || user?.email || 'Anonymous',
            lastSeen: new Date().toISOString(),
          });
        }
      });

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [boardId, userId]);

  // Send heartbeat every 30 seconds
  useEffect(() => {
    if (!isConnected || !channelRef.current) return;

    const interval = setInterval(() => {
      channelRef.current?.track({
        userId,
        lastSeen: new Date().toISOString(),
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, userId]);

  return {
    activeUsers: activeUsers.filter(u => u.userId !== userId), // Exclude self
    isConnected,
  };
}
