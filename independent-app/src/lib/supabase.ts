import { createClient } from '@supabase/supabase-js'

// Anon key — used client-side (respects RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Service role key — used server-side only (bypasses RLS)
// NEVER expose this to the browser
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

export const getSupabase = () => supabase
export const getSupabaseAdmin = () => supabaseAdmin
