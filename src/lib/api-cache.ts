/**
 * Simple in-memory TTL cache for API routes.
 * Runs in the Node.js process — avoids redundant DB round-trips
 * for the same data within a short window.
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

const store = new Map<string, CacheEntry<any>>();

export function cacheGet<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(pattern: string): void {
    for (const key of store.keys()) {
        if (key.startsWith(pattern)) store.delete(key);
    }
}

/** Fetch-or-compute: returns cached value or runs fn() and caches result. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const hit = cacheGet<T>(key);
    if (hit !== null) {
        console.log(`[CACHE HIT] ${key}`);
        return hit;
    }
    console.log(`[CACHE MISS] ${key} — fetching from DB`);
    const value = await fn();
    cacheSet(key, value, ttlMs);
    return value;
}
