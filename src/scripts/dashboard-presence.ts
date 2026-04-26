// src/scripts/dashboard-presence.ts
// Supabase Realtime presence - tracks which members are currently online.
// Profile pages track() themselves; dashboard subscribes and gates all polling.
// Emails are hashed before broadcast so they never appear in WebSocket frames.

import { createClient } from '@/utils/supabase/client';

/** Deterministic hash of an email — opaque ID safe to broadcast over realtime. */
export function presenceKey(email: string): string {
    const e = email.toLowerCase();
    let h = 0;
    for (let i = 0; i < e.length; i++) {
        h = Math.imul(31, h) + e.charCodeAt(i) | 0;
    }
    return 'p' + Math.abs(h).toString(36);
}

export const onlineMembers = new Set<string>();

type PresenceListener = () => void;
const _listeners: PresenceListener[] = [];
let _channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;

/** Subscribe to online-state changes (sidebar re-render, poll gate checks). */
export function onPresenceChange(cb: PresenceListener) {
    _listeners.push(cb);
}

function _notify() {
    _listeners.forEach(cb => cb());
}

/**
 * Dashboard: subscribe to the shared presence channel.
 * Builds onlineMembers from whoever is currently tracked (hashed keys).
 * Safe to call multiple times - only subscribes once.
 */
export function initPresenceTracking() {
    if (_channel) return;

    const supabase = createClient();
    _channel = supabase.channel('members-online');

    // Grace period tracking — don't mark someone offline on a single missing sync
    const _absentCount: Record<string, number> = {};
    const OFFLINE_THRESHOLD = 2; // must be absent from 2+ consecutive syncs

    _channel
        .on('presence', { event: 'sync' }, () => {
            const state = _channel!.presenceState<{ id?: string; email?: string }>();

            // Build the set of keys present in this sync event
            const nowPresent = new Set<string>();
            Object.values(state)
                .flat()
                .forEach((p: any) => {
                    if (p?.id) {
                        nowPresent.add(p.id);
                    } else if (p?.email) {
                        nowPresent.add(presenceKey(p.email));
                    }
                });

            // If sync returned 0 members but we had members before, it's a reconnect — skip
            if (nowPresent.size === 0 && onlineMembers.size > 0) return;

            let changed = false;

            // Add newly appeared members immediately
            for (const key of nowPresent) {
                delete _absentCount[key];
                if (!onlineMembers.has(key)) {
                    onlineMembers.add(key);
                    changed = true;
                }
            }

            // For members that disappeared, increment absent counter
            // Only remove after they've been absent for OFFLINE_THRESHOLD consecutive syncs
            for (const key of onlineMembers) {
                if (!nowPresent.has(key)) {
                    _absentCount[key] = (_absentCount[key] || 0) + 1;
                    if (_absentCount[key] >= OFFLINE_THRESHOLD) {
                        onlineMembers.delete(key);
                        delete _absentCount[key];
                        changed = true;
                    }
                }
            }

            if (changed) {
                _notify();
            }
        })
        .subscribe((status: string) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn('[PRESENCE] channel lost, will reconnect on visibility');
            }
        });
}

/** Force-reconnect presence channel. Called on tab visibility restore. */
export function reconnectPresence() {
    if (_channel) {
        const state = (_channel as any).state;
        if (state === 'errored' || state === 'closed') {
            console.log('[PRESENCE] reconnecting...');
            cleanupPresenceTracking();
            initPresenceTracking();
        }
    }
}

/** True if the member is currently connected. Hashes email before lookup. */
export function isMemberOnline(email: string): boolean {
    if (!email) return false;
    return onlineMembers.has(presenceKey(email));
}

/** Unsubscribe and clean up the presence channel. Call on page unload. */
export function cleanupPresenceTracking() {
    if (_channel) {
        _channel.unsubscribe();
        _channel = null;
    }
    onlineMembers.clear();
}
