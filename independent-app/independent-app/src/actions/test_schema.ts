import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
    const { data: t } = await supabaseAdmin.from('tasks').select('*').limit(1);
    if (t && t.length) {
        console.log('tasks columns:', Object.keys(t[0]));
    }
    const { data: p } = await supabaseAdmin.from('profiles').select('*').limit(1);
    if (p && p.length) {
        console.log('profiles columns:', Object.keys(p[0]));
    }
}
run();
