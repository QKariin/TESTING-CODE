// src/lib/lookup.ts
// Centralized identifier resolution for UUID/email lookups.
// Every table uses `member_id` (email) and some use `ID` (UUID).
// This module eliminates the 200+ copy-pasted lookup patterns.

import { supabaseAdmin } from './supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Check if a string is a UUID */
export function isUuid(str: string): boolean {
    return UUID_RE.test(str);
}

/**
 * Given a UUID or email, resolve BOTH the UUID and email
 * by cross-referencing the profiles table.
 * Returns { uuid, email } — either may be null if not found.
 */
export async function resolveIdentifier(memberId: string): Promise<{ uuid: string | null; email: string | null }> {
    if (isUuid(memberId)) {
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('ID, member_id')
            .eq('ID', memberId)
            .maybeSingle();
        return { uuid: memberId, email: data?.member_id || null };
    } else {
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('ID, member_id')
            .ilike('member_id', memberId)
            .maybeSingle();
        return { uuid: data?.ID || null, email: memberId.toLowerCase() };
    }
}

/**
 * Find a single row in any table, handling UUID vs email automatically.
 *
 * @param table     - Supabase table name
 * @param memberId  - UUID or email string
 * @param selectCols - columns to select (default '*')
 * @param opts.idColumn    - UUID column name (default 'ID')
 * @param opts.emailColumn - email column name (default 'member_id')
 *
 * Lookup order:
 * 1. If UUID → try by idColumn
 * 2. If not found → resolve email via profiles → try by emailColumn (ilike)
 * 3. If email → try by emailColumn (ilike)
 */
export async function findRow(
    table: string,
    memberId: string,
    selectCols: string = '*',
    opts?: { idColumn?: string; emailColumn?: string }
): Promise<any | null> {
    const idCol = opts?.idColumn ?? 'ID';
    const emailCol = opts?.emailColumn ?? 'member_id';

    if (isUuid(memberId)) {
        // Try direct UUID match
        const { data } = await supabaseAdmin
            .from(table)
            .select(selectCols)
            .eq(idCol, memberId)
            .maybeSingle();
        if (data) return data;

        // Fallback: resolve email from profiles, then try email lookup
        const { email } = await resolveIdentifier(memberId);
        if (email) {
            const { data: row } = await supabaseAdmin
                .from(table)
                .select(selectCols)
                .ilike(emailCol, email)
                .maybeSingle();
            if (row) return row;
        }
        return null;
    } else {
        // Direct email lookup (case-insensitive)
        const { data } = await supabaseAdmin
            .from(table)
            .select(selectCols)
            .ilike(emailCol, memberId)
            .maybeSingle();
        return data || null;
    }
}

/**
 * Find a profile by UUID or email.
 * Shortcut for findRow('profiles', ...) with correct column mapping.
 */
export async function findProfile(
    memberId: string,
    selectCols: string = '*'
): Promise<any | null> {
    return findRow('profiles', memberId, selectCols);
}

/**
 * Find a tasks row by UUID or email.
 * Uses the same fallback chain as findRow but with tasks-specific defaults.
 */
export async function findTaskRow(
    memberId: string,
    selectCols: string = '*'
): Promise<any | null> {
    return findRow('tasks', memberId, selectCols);
}

/**
 * Build a Supabase filter for a query that needs to match by UUID OR email.
 * Useful for .or() clauses and .update() operations where you can't use findRow.
 *
 * Returns { column, value, method } to apply to your query.
 * method is 'eq' for UUID, 'ilike' for email.
 */
export function identifierFilter(memberId: string, opts?: { idColumn?: string; emailColumn?: string }) {
    const idCol = opts?.idColumn ?? 'ID';
    const emailCol = opts?.emailColumn ?? 'member_id';

    if (isUuid(memberId)) {
        return { column: idCol, value: memberId, method: 'eq' as const };
    } else {
        return { column: emailCol, value: memberId, method: 'ilike' as const };
    }
}
