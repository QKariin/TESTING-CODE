import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKneel() {
    const { data, error } = await supabase.from('tasks').select('member_id, lastWorship, "today kneeling"').ilike('member_id', '%livi%').limit(5);
    console.log("Data:", data);
    console.log("Error:", error);
}

checkKneel();
