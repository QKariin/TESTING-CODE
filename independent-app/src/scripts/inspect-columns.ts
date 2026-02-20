// scripts/inspect-columns.ts
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
    console.log("--- COLUMN INSPECTION ---")

    const { data: tasks, error: tErr } = await supabaseAdmin.from('tasks').select('*').limit(1)
    if (tErr) console.error("Tasks error:", tErr)
    else console.log("Tasks columns:", Object.keys(tasks[0] || {}))

    const { data: profiles, error: pErr } = await supabaseAdmin.from('profiles').select('*').limit(1)
    if (pErr) console.error("Profiles error:", pErr)
    else console.log("Profiles columns:", Object.keys(profiles[0] || {}))
}

check()
