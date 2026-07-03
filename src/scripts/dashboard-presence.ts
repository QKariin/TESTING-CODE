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
export const memberPlatforms = new Map<string, string>(); // presenceKey → 'app' | 'mobile' | 'desktop'
let _lastValidSync = 0; // timestamp of last sync that had members

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
            const state = _channel!.presenceState<{ id?: string; email?: string; platform?: string }>();

            // Build the set of keys present in this sync event
            const nowPresent = new Set<string>();
            Object.values(state)
                .flat()
                .forEach((p: any) => {
                    const key = p?.id || (p?.email ? presenceKey(p.email) : null);
                    if (key) {
                        nowPresent.add(key);
                        if (p?.platform) memberPlatforms.set(key, p.platform);
                    }
                });

            // If sync returned 0 members but we had members before, it might be a reconnect glitch.
            // Skip only if the last valid sync was recent (< 30s). Otherwise accept it — everyone is offline.
            if (nowPresent.size === 0 && onlineMembers.size > 0) {
                if (Date.now() - _lastValidSync < 30000) return;
            }
            if (nowPresent.size > 0) _lastValidSync = Date.now();

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
                        memberPlatforms.delete(key);
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

/** Returns the platform the member is using: 'app', 'mobile', 'desktop', or null if offline. */
export function getMemberPlatform(email: string): string | null {
    if (!email) return null;
    return memberPlatforms.get(presenceKey(email)) || null;
}

/** Unsubscribe and clean up the presence channel. Call on page unload. */
export function cleanupPresenceTracking() {
    if (_channel) {
        _channel.unsubscribe();
        _channel = null;
    }
    onlineMembers.clear();
    memberPlatforms.clear();
}
