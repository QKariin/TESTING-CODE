import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoutine() {
    console.log("Checking routines...");
    const { data, error } = await supabase.from('profiles').select('member_id, routine, routine_history').not('routine', 'is', null).limit(10);
    if (error) {
        console.error("Error fetching", error);
    } else {
        console.log("Profiles with routine set:", JSON.stringify(data, null, 2));
    }
}

checkRoutine();
