// src/scripts/dashboard-presence.ts
// Supabase Realtime presence — tracks which members are currently online.
// Profile pages track() themselves; dashboard subscribes and gates all polling.

import { createClient } from '@/utils/supabase/client';

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
 * Builds onlineMembers from whoever is currently tracked.
 * Safe to call multiple times — only subscribes once.
 */
export function initPresenceTracking() {
    if (_channel) return;

    const supabase = createClient();
    _channel = supabase.channel('members-online');

    _channel
        .on('presence', { event: 'sync' }, () => {
            const state = _channel!.presenceState<{ email: string }>();
            const prev = new Set(onlineMembers);

            onlineMembers.clear();
            Object.values(state)
                .flat()
                .forEach((p: any) => {
                    if (p?.email) onlineMembers.add(p.email.toLowerCase());
                });

            // Only notify if the set actually changed
            const changed =
                onlineMembers.size !== prev.size ||
                [...onlineMembers].some(e => !prev.has(e));

            if (changed) {
                console.log('[PRESENCE] Online:', [...onlineMembers]);
                _notify();
            }
        })
        .subscribe();
}

/** True if the member is currently connected. */
export function isMemberOnline(email: string): boolean {
    if (!email) return false;
    return onlineMembers.has(email.toLowerCase());
}

/** Unsubscribe and clean up the presence channel. Call on page unload. */
export function cleanupPresenceTracking() {
    if (_channel) {
        _channel.unsubscribe();
        _channel = null;
    }
    onlineMembers.clear();
}
