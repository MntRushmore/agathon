"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

interface UseRealtimeBoardProps {
	boardId: string;
	userId: string;
	onBoardUpdate?: (data: any) => void;
	onError?: (error: string) => void;
}

interface ActiveUser {
	userId: string;
	userName: string;
	lastSeen: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export function useRealtimeBoard({
	boardId,
	userId,
	onBoardUpdate,
	onError,
}: UseRealtimeBoardProps) {
	const supabase = useMemo(() => createClient(), []);
	const channelRef = useRef<RealtimeChannel | null>(null);
	const onBoardUpdateRef = useRef(onBoardUpdate);
	const onErrorRef = useRef(onError);
	const retryCountRef = useRef(0);
	const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Keep callback refs up to date without re-subscribing
	useEffect(() => {
		onBoardUpdateRef.current = onBoardUpdate;
	}, [onBoardUpdate]);

	useEffect(() => {
		onErrorRef.current = onError;
	}, [onError]);

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
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "whiteboards",
					filter: `id=eq.${boardId}`,
				},
				(payload) => {
					// Only notify if update was from another user
					onBoardUpdateRef.current?.(payload.new);
				},
			)
			// Track presence (who's online)
			.on("presence", { event: "sync" }, () => {
				const state = channel.presenceState();
				const users: ActiveUser[] = [];

				Object.keys(state).forEach((key) => {
					const presences = state[key];
					if (presences && presences.length > 0) {
						const presence = presences[0] as any;
						users.push({
							userId: key,
							userName: presence.userName || "Anonymous",
							lastSeen: presence.lastSeen || new Date().toISOString(),
						});
					}
				});

				setActiveUsers(users);
			})
			.subscribe(async (status, err) => {
				if (status === "SUBSCRIBED") {
					setIsConnected(true);
					setError(null);
					retryCountRef.current = 0;

					// Track our presence
					const { data: userData, error: userError } =
						await supabase.auth.getUser();
					const user = userData?.user ?? null;
					if (userError) {
						// Authentication/user fetch failed — track with fallback name
						await channel.track({
							userId,
							userName: user?.email || "Anonymous",
							lastSeen: new Date().toISOString(),
						});
						return;
					}
					const { data: profile } = await supabase
						.from("profiles")
						.select("full_name")
						.eq("id", userId)
						.single();

					await channel.track({
						userId,
						userName: profile?.full_name || user?.email || "Anonymous",
						lastSeen: new Date().toISOString(),
					});
				} else if (
					status === "CHANNEL_ERROR" ||
					status === "TIMED_OUT" ||
					status === "CLOSED"
				) {
					setIsConnected(false);
					const message =
						err?.message ??
						`Realtime subscription ${status.toLowerCase().replace("_", " ")}`;
					setError(message);
					onErrorRef.current?.(message);

					// Retry with exponential back-off
					if (retryCountRef.current < MAX_RETRIES) {
						const delay =
							RETRY_DELAY_MS * 2 ** retryCountRef.current;
						retryCountRef.current += 1;
						retryTimeoutRef.current = setTimeout(() => {
							channel.subscribe();
						}, delay);
					}
				}
			});

			// Cleanup on unmount
			return () => {
				if (retryTimeoutRef.current) {
					clearTimeout(retryTimeoutRef.current);
					retryTimeoutRef.current = null;
				}
				if (channelRef.current) {
					channelRef.current.unsubscribe();
					channelRef.current = null;
				}
			};
			}, [boardId, userId, supabase.from, supabase.auth.getUser, supabase.channel]);

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
		activeUsers: activeUsers.filter((u) => u.userId !== userId), // Exclude self
		isConnected,
		error,
	};
}
