import { createClient } from '@supabase/supabase-js'

// Anon key - used client-side (respects RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Export singleton instances that are initialized only when accessed
let clientInstance: any = null
let adminInstance: any = null

// --- THE FIX: Configuration options to force PKCE Flow ---
const clientConfig = {
    auth: {
        flowType: 'pkce' as const, // Forces ?code= instead of #access_token
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
    }
};

export const supabase = {
    get auth() {
        if (!clientInstance) clientInstance = createClient(supabaseUrl, supabaseAnonKey, clientConfig)
        return clientInstance.auth
    },
    get storage() {
        if (!clientInstance) clientInstance = createClient(supabaseUrl, supabaseAnonKey, clientConfig)
        return clientInstance.storage
    },
    from(table: string) {
        if (!clientInstance) clientInstance = createClient(supabaseUrl, supabaseAnonKey, clientConfig)
        return clientInstance.from(table)
    }
} as any

export const supabaseAdmin = {
    get auth() {
        if (!adminInstance) adminInstance = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
        return adminInstance.auth
    },
    get storage() {
        if (!adminInstance) adminInstance = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
        return adminInstance.storage
    },
    from(table: string) {
        if (!adminInstance) adminInstance = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
        return adminInstance.from(table)
    }
} as any

export const getSupabase = () => {
    if (!clientInstance) clientInstance = createClient(supabaseUrl, supabaseAnonKey, clientConfig)
    return clientInstance
}
export const getSupabaseAdmin = () => {
    if (!adminInstance) adminInstance = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    return adminInstance
}
